import React, { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useAdGroup,
  useAdGroupScores,
  useAdGroupKeywords,
} from "../services/api";
import KeywordSparkline from "../components/KeywordSparkline";
import { KeywordDto } from "@/types/api.types";
import {
  format,
  parse,
  startOfWeek,
  addDays,
  subDays,
  isWithinInterval,
} from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";

// Skeleton Loader Component
const SkeletonLoader = ({
  className = "",
  count = 1,
}: {
  className?: string;
  count?: number;
}) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse bg-gray-200 rounded ${className}`}
      />
    ))}
  </>
);

const TIME_RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

const QS_COLORS = {
  "1-3": "#ef4444", // Red
  "4-6": "#f59e0b", // Amber
  "7-8": "#10b981", // Emerald
  "9-10": "#3b82f6", // Blue
};

const getColorForScore = (score: number) => {
  if (score >= 9) return QS_COLORS["9-10"];
  if (score >= 7) return QS_COLORS["7-8"];
  if (score >= 4) return QS_COLORS["4-6"];
  return QS_COLORS["1-3"];
};

// Helper functions for status display
const getStatusColor = (status?: string) => {
  return (
    {
      ENABLED: "bg-green-500",
      PAUSED: "bg-yellow-500",
      REMOVED: "bg-red-500",
    }[status || ""] || "bg-gray-400"
  );
};

const getStatusTextColor = (status?: string) => {
  return (
    {
      ENABLED: "text-green-600",
      PAUSED: "text-yellow-600",
      REMOVED: "text-red-600",
    }[status || ""] || "text-gray-600"
  );
};

// Badge component for status display
type StatusType = "ENABLED" | "PAUSED" | "REMOVED" | string;

const AdGroupPage: React.FC = () => {
  const { adGroupId } = useParams<{ adGroupId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "keywords">(
    "overview",
  );
  const [timeRange, setTimeRange] = useState(7); // Default to 7 days
  const {
    data: adGroupResponse,
    isLoading: isLoadingAdGroup,
    isError: isErrorAdGroup,
    error: adGroupError,
  } = useAdGroup(adGroupId!);

  const {
    data: scoresData,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
  } = useAdGroupScores(adGroupId!, timeRange);

  // Fetch keywords when component mounts
  const {
    data: keywordsData,
    isLoading: isLoadingKeywords,
    isError: isErrorKeywords,
    error: keywordsError,
    refetch: refetchKeywords,
  } = useAdGroupKeywords(adGroupId!, { enabled: true });

  // Keep track of whether we've requested keywords for the tab
  const [keywordsTabLoaded, setKeywordsTabLoaded] = useState(false);

  const isLoading =
    isLoadingAdGroup ||
    isLoadingScores ||
    (activeTab === "keywords" && isLoadingKeywords);
  const isError =
    isErrorAdGroup ||
    isErrorScores ||
    (activeTab === "keywords" && isErrorKeywords);
  const error =
    adGroupError ||
    scoresError ||
    (activeTab === "keywords" ? keywordsError : null);

  // Handle keywords tab click
  const handleKeywordsTabClick = () => {
    setActiveTab("keywords");
    refetchKeywords();
  };

  // Get bottom 5 keywords by average QS
  const bottomKeywords = useMemo(() => {
    if (!keywordsData?.data?.keywords) return [];

    return [...keywordsData.data.keywords]
      .filter((k) => k.scores && k.scores.length > 0)
      .map((keyword) => ({
        ...keyword,
        avgQs:
          keyword.scores!.reduce((sum, s) => sum + s.qs, 0) /
          keyword.scores!.length,
      }))
      .sort((a, b) => a.avgQs - b.avgQs)
      .slice(0, 5);
  }, [keywordsData]);

  const adGroup = adGroupResponse?.data;

  // Process scores data to include all dates in the time range
  const scores = useMemo(() => {
    if (!scoresData?.data?.scores) return [];

    const now = new Date();
    const startDate = subDays(now, timeRange - 1);

    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, { qs: number; keywordCount: number }>();
    scoresData.data.scores.forEach((score) => {
      // Parse the date string from the API (format: 'dd.MM.yyyy')
      const parsedDate = parse(score.date, "dd.MM.yyyy", new Date());
      const dateKey = format(parsedDate, "yyyy-MM-dd");
      scoreMap.set(dateKey, { qs: score.qs, keywordCount: score.keywordCount });
    });

    // Generate array of all dates in the time range
    const dateArray = [];
    for (let i = 0; i < timeRange; i++) {
      dateArray.push(addDays(startDate, i));
    }

    return dateArray.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const displayDate = format(
        date,
        timeRange >= 360 ? "MMM d, yyyy" : "MMM d",
      );
      return {
        axisDate: displayDate,
        date: dateKey,
        qs: (scoreMap.get(dateKey) || { qs: 0, keywordCount: 0 }).qs,
        keywordCount: (scoreMap.get(dateKey) || { qs: 0, keywordCount: 0 })
          .keywordCount,
      };
    });
  }, [scoresData, timeRange]);

  // Calculate current quality score and trend from scores data
  const { currentScore, trend } = useMemo(() => {
    if (!scoresData?.data?.scores?.length) return { currentScore: 0, trend: 0 };

    // Sort scores by date in descending order
    const sortedScores = [...scoresData.data.scores].sort(
      (a, b) =>
        new Date(parse(b.date, "dd.MM.yyyy", new Date())).getTime() -
        new Date(parse(a.date, "dd.MM.yyyy", new Date())).getTime(),
    );

    const current = sortedScores[0]?.qs || 0;
    const previous = sortedScores[1]?.qs || 0;

    // Calculate trend percentage (0 if no previous data)
    const trendValue =
      previous && current ? ((current - previous) / previous) * 100 : 0;

    return {
      currentScore: current,
      trend: parseFloat(trendValue.toFixed(1)),
    };
  }, [scoresData]);

  const keywords = keywordsData?.data?.keywords || [];
  const totalKeywords = keywordsData?.data?.total || 0;

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full p-6">
        <div className="container mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <SkeletonLoader className="h-8 w-64 mb-4" />
            <SkeletonLoader className="h-4 w-48" />
          </div>

          {/* Tabs Skeleton */}
          <div className="flex space-x-8 border-b border-gray-200 mb-6">
            <SkeletonLoader className="h-12 w-24" />
            <SkeletonLoader className="h-12 w-24" />
          </div>

          {/* Time Range Skeleton */}
          <div className="flex justify-end mb-6">
            <SkeletonLoader className="h-10 w-96" />
          </div>

          {/* Content Skeleton */}
          {activeTab === "overview" ? (
            <div className="space-y-6">
              <SkeletonLoader className="h-64 w-full rounded-lg" />
              <SkeletonLoader className="h-64 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <SkeletonLoader className="h-12 w-full" count={5} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className="w-full p-6">
        <div className="container mx-auto bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-medium text-red-800">
            Error loading data
          </h2>
          <p className="text-red-700 mt-1">
            {error?.message || "An unknown error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const gradientOffset = () => {
    const vals = scores.map((d) => d.qs);
    const dataMax = Math.max(...vals);
    const dataMin = Math.min(...vals);
    if (dataMax <= 4) return 0;
    if (dataMin >= 7) return 1;
    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with breadcrumb */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {/* <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li>
                <Link to="/" className="text-blue-600 hover:underline">Accounts</Link>
              </li>
              <li className="flex items-center">
                <span className="mx-2 text-gray-400">/</span>
                <Link to={`/accounts/${}/campaigns/${adGroup?.campaignId}`} className="text-blue-600 hover:underline">
                  Campaign
                </Link>
              </li>
              <li className="flex items-center">
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-700">{adGroup?.name}</span>
              </li>
            </ol>
          </nav> */}

          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {adGroup?.name}
                </h1>
                <div className="relative group">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${getStatusColor(adGroup?.status)}`}
                    style={{ marginBottom: "0.25rem" }}
                    title={adGroup?.status}
                  ></span>
                  <div
                    className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusTextColor(adGroup?.status)} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                  >
                    {adGroup?.status}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <span>Ad Group ID: {adGroup?.id}</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span
                    className={`ml-1 font-semibold ${
                      currentScore >= 7
                        ? "text-green-600"
                        : currentScore >= 4
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {currentScore.toFixed(1)}/10
                  </span>
                  {trend !== 0 && (
                    <span
                      className={`ml-2 ${trend > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Keywords: </span>
                  <span className="font-semibold">{totalKeywords}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "overview"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Overview
            </button>
            <button
              onClick={handleKeywordsTabClick}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "keywords"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Keywords ({totalKeywords})
            </button>
          </nav>
        </div>

        {/* Time Range Selector */}
        <div className="flex justify-end items-center mb-6">
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`px-4 py-2 text-sm font-medium ${
                  timeRange === range.days
                    ? "bg-blue-100 text-blue-700 border-blue-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                } border ${range.days === 7 ? "rounded-l-md" : ""} ${
                  range.days === 365 ? "rounded-r-md" : ""
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-6">
            {/* QS Line Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                Quality Score Trend
              </h2>
              <div className="h-64">
                {scores.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={scores}
                      margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="axisDate"
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={{ stroke: "#e5e7eb", strokeWidth: 1 }}
                        tickMargin={10}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tickCount={6}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={{ stroke: "#9ca3af", strokeWidth: 1 }}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const qsValue = Number(payload[0].value);
                            const displayQs = qsValue.toFixed(1);
                            return (
                              <div className="space-y-1.5 p-2 rounded-lg bg-white border border-gray-200 shadow-md">
                                <div>
                                  <span className="font-semibold text-sm">
                                    {format(
                                      new Date(payload[0].payload.date),
                                      "MMM d, yyyy",
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                  <span className="text-gray-500 text-xs">
                                    Quality Score
                                  </span>
                                  <span
                                    className={`font-medium text-sm ${
                                      qsValue >= 8
                                        ? "text-green-600"
                                        : qsValue >= 5
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {displayQs}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                  <span className="text-gray-600 text-xs">
                                    Keywords:
                                  </span>
                                  <span className="font-medium text-sm text-gray-900">
                                    {payload[0].payload.keywordCount}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <defs>
                        <linearGradient
                          id="colorQs"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0"
                            stopColor="#3b82f6"
                            stopOpacity={1}
                          />
                          <stop
                            offset={off}
                            stopColor="#3b82f6"
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="qs"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorQs)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2 }}
                      />
                      <ReferenceLine
                        y={7}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                      />
                      <ReferenceLine
                        y={4}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    {isLoadingScores ? (
                      <SkeletonLoader className="h-6 w-48" />
                    ) : (
                      "No score data available"
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom 5 Keywords */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                Bottom 5 Keywords (by QS)
              </h2>
              {bottomKeywords.length > 0 ? (
                <div className="space-y-3">
                  {bottomKeywords.map((keyword) => (
                    <div
                      key={keyword.id}
                      className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() =>
                        navigate(
                          `/adgroups/${adGroupId}/keywords/${keyword.id}`,
                        )
                      }
                    >
                      <div className="w-1/4 font-medium text-blue-600 hover:text-blue-800 truncate pr-4">
                        {keyword.keyword}
                      </div>
                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex-1 max-w-3xl h-10">
                          <KeywordSparkline
                            width={650}
                            scores={keyword.scores || []}
                            timeRange={timeRange}
                          />
                        </div>
                        <div className="w-16 flex-shrink-0 text-right">
                          <span
                            className={`inline-flex items-center justify-center w-14 px-2.5 py-1 rounded-full text-xs font-medium ${
                              keyword.avgQs >= 7
                                ? "bg-green-100 text-green-800"
                                : keyword.avgQs >= 4
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {keyword.avgQs.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {isLoadingKeywords ? (
                    <SkeletonLoader className="h-6 w-48 mx-auto" />
                  ) : (
                    "No keyword data available"
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Keywords</h2>
              <p className="mt-1 text-sm text-gray-500">
                {isLoadingKeywords
                  ? "Loading..."
                  : `${keywordsData?.data?.keywords?.length || 0} keywords found`}
              </p>
            </div>

            {isLoadingKeywords ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            ) : keywordsData?.data?.keywords &&
              keywordsData.data.keywords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Keyword
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 w-1/2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        QS Trend
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Avg QS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {keywordsData?.data?.keywords?.map(
                      (keyword: KeywordDto) => {
                        const scores = keyword.scores || [];
                        // Calculate average QS from non-zero scores
                        const nonZeroScores = scores.filter((s) => s.qs > 0);
                        const avgQs =
                          nonZeroScores.length > 0
                            ? nonZeroScores.reduce((sum, s) => sum + s.qs, 0) /
                              nonZeroScores.length
                            : 0;

                        return (
                          <tr
                            key={keyword.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              navigate(
                                `/adgroups/${adGroupId}/keywords/${keyword.id}`,
                              )
                            }
                          >
                            <td className="px-6 py-4 w-1/4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {keyword.keyword}
                                </span>
                                <div className="relative group">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${getStatusColor(keyword.status)}`}
                                    style={{ marginBottom: "0.25rem" }}
                                    title={keyword.status}
                                  ></span>
                                  <div
                                    className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusTextColor(keyword.status)} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                                  >
                                    {keyword.status}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                ID: {keyword.id}
                              </div>
                            </td>
                            <td className="px-6 py-4 w-2/5 whitespace-nowrap">
                              <div className="w-full min-w-[200px]">
                                <KeywordSparkline
                                  scores={scores}
                                  timeRange={timeRange}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                              {avgQs > 0 ? (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    avgQs >= 7
                                      ? "bg-green-100 text-green-800"
                                      : avgQs >= 4
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {avgQs.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-500 text-sm">
                                  N/A
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No keywords found for this ad group.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdGroupPage;
