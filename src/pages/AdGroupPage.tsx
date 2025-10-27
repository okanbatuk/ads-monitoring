import React, { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useAdGroup,
  useAdGroupScores,
  useAdGroupKeywords,
  useAccount,
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
import { useTheme } from "@/contexts/ThemeProvider";

// Skeleton Loader Component
const SkeletonLoader = ({
  className = "",
  count = 1,
}: {
  className?: string;
  count?: number;
}) => {
  const { theme } = useTheme();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} rounded ${className}`}
        />
      ))}
    </>
  );
};

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
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"overview" | "keywords">(
    "overview",
  );
  const [timeRange, setTimeRange] = useState(30); // Default to 30 days
  const [showBestKeywords, setShowBestKeywords] = useState(false);
  const [keywordsSearchTerm, setKeywordsSearchTerm] = useState("");
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

  const campaign = adGroupResponse?.data?.campaign;
  const account = adGroupResponse?.data?.campaign?.account;
  const mccId = account?.parentId;

  // Fetch data
  const { data: accountData, isLoading: isLoadingAccount } = useAccount(
    mccId?.toString() || "",
  );

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

  // Get top 5 keywords by average QS
  const topKeywords = useMemo(() => {
    if (!keywordsData?.data?.keywords) return [];

    return [...keywordsData.data.keywords]
      .filter((k) => k.scores && k.scores.length > 0)
      .map((keyword) => ({
        ...keyword,
        avgQs:
          keyword.scores!.reduce((sum, s) => sum + s.qs, 0) /
          keyword.scores!.length,
      }))
      .sort((a, b) => b.avgQs - a.avgQs)
      .slice(0, 5);
  }, [keywordsData]);

  // Get current keywords to display
  const displayedKeywords = showBestKeywords ? topKeywords : bottomKeywords;

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
  const manager = accountData?.data?.name;
  
  
  // Filter keywords by search term for Keywords tab
  const filteredKeywords = keywords.filter(keyword =>
    keywordsSearchTerm.length > 2 ? keyword.keyword.toLowerCase().includes(keywordsSearchTerm.toLowerCase()) : true
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div
              className={`h-8 rounded w-1/3 mb-6 ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
            ></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-32 rounded-lg shadow p-6 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
                >
                  <div
                    className={`h-4 rounded w-1/2 mb-4 ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
                  ></div>
                  <div
                    className={`h-8 rounded w-1/3 ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
                  ></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto">
          <div className={`${theme === "dark" ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"} border rounded-lg p-4`}>
            <h2 className={`text-lg font-medium ${theme === "dark" ? "text-red-400" : "text-red-800"}`}>
              Error loading data
            </h2>
            <p className={`${theme === "dark" ? "text-red-300" : "text-red-700"} mt-1`}>
              {error?.message || "An unknown error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className={`mt-3 px-4 py-2 ${theme === "dark" ? "bg-red-800 hover:bg-red-700" : "bg-red-600 hover:bg-red-700"} text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
            >
              Try Again
            </button>
          </div>
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

  // Calculate average QS from non-zero values only
  const avgQs = (() => {
    const nonZeroScores = scores.filter(score => score.qs > 0);
    return nonZeroScores.length > 0
      ? nonZeroScores.reduce((sum, score) => sum + score.qs, 0) / nonZeroScores.length
      : 0;
  })();

  return (
    <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header with breadcrumb */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2">
            <li>
              <Link to="/" className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors duration-200`}>
                Home
              </Link>
            </li>
            {mccId && <li className="flex items-center">
              <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{'>'}</span>
              <Link to={`/mcc/${mccId}`} className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors duration-200`}>
                {manager}
              </Link>
            </li>}
            <li className="flex items-center">
              <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{'>'}</span>
              <Link to={`mcc/${mccId}/sub/${account?.id}`} className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors duration-200`}>
                {account?.name}
              </Link>
            </li>
            <li className="flex items-center">
              <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{'>'}</span>
              <Link to={`/accounts/${account?.id}/campaigns/${campaign?.id}`} className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors duration-200`}>
                {campaign?.name}
              </Link>
            </li>
            <li className="flex items-center">
              <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{'>'}</span>
              <span className={`cursor-pointer hover:text-blue-300 hover:underline transition-colors duration-200 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} onClick={() => navigate(`/accounts/${account?.id}/campaigns/${campaign?.id}#adgroups`)}>Ad Group</span>
            </li>
            <li className="flex items-center">
              <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{'>'}</span>
              <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-700'} font-medium`}>
                {adGroup?.name}
              </span>
            </li>
          </ol>
        </nav>


        <div className={`${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-lg shadow p-6 mb-8`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
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
              <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                <span>Ad Group ID: {adGroup?.id}</span>
              </div>

              <div className={`flex flex-wrap items-center gap-4 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"} mt-2`}>
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span
                    className={`ml-1 font-semibold ${currentScore >= 7
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
                  <span className="font-medium">Average Score: </span>
                  <span className={`font-semibold ${avgQs >= 7 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : avgQs >= 4 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600')}`}>
                    {avgQs.toFixed(1)}/10
                  </span>
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
        <div className={`border-b mb-6 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === "overview"
                ? `${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-500 text-green-600'}`
                : `${theme === 'dark' ? 'border-transparent text-gray-400 hover:text-green-400 hover:border-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }`}
            >
              Overview
            </button>
            <button
              onClick={handleKeywordsTabClick}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === "keywords"
                ? `${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-500 text-green-600'}`
                : `${theme === 'dark' ? 'border-transparent text-gray-400 hover:text-green-400 hover:border-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }`}
            >
              Keywords ({totalKeywords})
            </button>
          </nav>
        </div>

        {/* Time Range Selector */}
        <div className="flex justify-end items-center mb-6">
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((range, index) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${timeRange === range.days
                  ? `${theme === 'dark' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`
                  : `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`
                  } ${index === 0 ? "rounded-l-md" : ""} ${index === TIME_RANGES.length - 1 ? "rounded-r-md" : ""
                  } border`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-6">
            {/* QS Line Chart */}
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
                        stroke={theme === "dark" ? "#374151" : "#f0f0f0"}
                      />
                      <XAxis
                        dataKey="axisDate"
                        tick={{ fontSize: 12, fill: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                        tickLine={false}
                        axisLine={{ stroke: theme === "dark" ? "#4b5563" : "#e5e7eb", strokeWidth: 1 }}
                        tickMargin={10}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tickCount={6}
                        tick={{ fontSize: 12, fill: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                        tickLine={false}
                        axisLine={{ stroke: theme === "dark" ? "#4b5563" : "#9ca3af", strokeWidth: 1 }}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const qsValue = Number(payload[0].value);
                            const displayQs = qsValue.toFixed(1);
                            return (
                              <div className={`space-y-1.5 p-2 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'}`}>
                                <div>
                                  <span className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {format(
                                      new Date(payload[0].payload.date),
                                      "MMM d, yyyy",
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Quality Score
                                  </span>
                                  <span
                                    className={`font-medium text-sm ${qsValue >= 8
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
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Keywords:
                                  </span>
                                  <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          const qsValue = payload.qs;
                          // Show dot only for non-zero values (make zero dots invisible)
                          if (qsValue === 0) {
                            return (
                              <circle
                                key={`dot-${payload.date}-${qsValue}`}
                                cx={cx}
                                cy={cy}
                                r={2}
                                fill="#3b82f6"
                                stroke={theme === "light" ? "#1e40af" : "#fff"}
                                strokeWidth={1}
                                opacity={0}
                              />
                            );
                          }
                          return (
                            <circle
                              key={`dot-${payload.date}-${qsValue}`}
                              cx={cx}
                              cy={cy}
                              r={2}
                              fill="#3b82f6"
                              stroke={theme === "light" ? "#1e40af" : "#fff"}
                              strokeWidth={1}
                            />
                          );
                        }}
                        activeDot={(props) => {
                          const { cx, cy, payload } = props;
                          const qsValue = payload.qs;
                          // Show active dot only for non-zero values
                          if (qsValue === 0) {
                            return (
                              <circle
                                key={`active-dot-${payload.date}-${qsValue}`}
                                cx={cx}
                                cy={cy}
                                r={6}
                                fill="#3b82f6"
                                stroke={theme === "light" ? "#1e40af" : "#fff"}
                                strokeWidth={2}
                                opacity={0}
                              />
                            );
                          }
                          return (
                            <circle
                              key={`active-dot-${payload.date}-${qsValue}`}
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill="#3b82f6"
                              stroke={theme === "light" ? "#1e40af" : "#fff"}
                              strokeWidth={2}
                            />
                          );
                        }}
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
                  <div className={`h-full flex items-center justify-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {isLoadingScores ? (
                      <SkeletonLoader className="h-6 w-48" />
                    ) : (
                      "No score data available"
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Best/Worst Keywords */}
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2
                    className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                  >
                    {showBestKeywords ? "Best 5 Keywords" : "Worst 5 Keywords"} (by QS)
                  </h2>
                  <button
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 ${theme === "dark"
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    onClick={() => setShowBestKeywords(!showBestKeywords)}
                    title={`Switch to ${showBestKeywords ? "Worst" : "Best"} 5 Keywords`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${showBestKeywords ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {displayedKeywords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <tr>
                        <th
                          scope="col"
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                        >
                          Keyword
                        </th>
                        <th
                          scope="col"
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                        >
                          QS Trend
                        </th>
                        <th
                          scope="col"
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                        >
                          Avg QS
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${theme === 'dark' ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                      {displayedKeywords.map((keyword) => (
                        <tr
                          key={keyword.id}
                          className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                          onClick={() =>
                            navigate(
                              `/adgroups/${adGroupId}/keywords/${keyword.id}`,
                            )
                          }
                        >
                          <td className="px-6 py-4 w-1/6">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate inline-block max-w-[150px] ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={keyword.keyword}>
                                {keyword.keyword}
                              </span>
                              <div className="relative group">
                                <span
                                  className={`inline-block w-2 h-2 rounded-full ${getStatusColor(keyword.status)}`}
                                  style={{ marginBottom: "0.25rem" }}
                                  title={keyword.status}
                                ></span>
                                <div
                                  className={`cursor-pointer absolute z-10 hidden group-hover:block rounded px-3 py-2 -mt-8 -ml-2 ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-800'} ${getStatusTextColor(keyword.status)} text-xs`}
                                >
                                  {keyword.status}
                                </div>
                              </div>
                            </div>
                            <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              ID: {keyword.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/2">
                            <div className="w-full h-10">
                              <KeywordSparkline
                                width="100%"
                                scores={keyword.scores || []}
                                timeRange={timeRange}
                                height={40}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6">
                            <div className="flex items-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${keyword.avgQs >= 7
                                  ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`
                                  : keyword.avgQs >= 4
                                    ? `${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`
                                    : `${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'}`
                                  }`}
                              >
                                {keyword.avgQs.toFixed(1)}
                              </span>
                              {(() => {
                                // Calculate trend from scores (current vs previous non-zero value)
                                const scores = keyword.scores || [];
                                const nonZeroScores = scores.filter((s) => s.qs > 0);
                                let trendPercentage = 0;

                                if (nonZeroScores.length >= 2) {
                                  const current = nonZeroScores[nonZeroScores.length - 1].qs;
                                  const previous = nonZeroScores[nonZeroScores.length - 2].qs;
                                  trendPercentage =
                                    previous !== 0 ? ((current - previous) / previous) * 100 : 0;
                                }

                                return nonZeroScores.length >= 2 ? (
                                  <span
                                    className={`ml-3 inline-flex items-center text-sm font-medium ${trendPercentage >= 0
                                      ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                      : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                                      }`}
                                  >
                                    {trendPercentage >= 0 ? '↑' : '↓'}{" "}
                                    {Math.abs(trendPercentage).toFixed(1)}%
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`text-center py-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {isLoadingKeywords ? (
                    <SkeletonLoader className="h-6 w-48 mx-auto" />
                  ) : (
                    `No ${showBestKeywords ? "best" : "worst"} keyword data available`
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
            {isLoadingKeywords ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-12 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded`}></div>
                  ))}
                </div>
              </div>
            ) : keywordsData?.data?.keywords &&
              keywordsData.data.keywords.length > 0 ? (
              <div>
                {/* Search Input */}
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                  <div className={`p-4`}>
                    <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Keywords</h2>
                    <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {keywordsData?.data?.keywords?.length || 0} keywords found
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`relative w-full ${!keywordsSearchTerm && "pr-4"}`}>
                      <input
                        type="text"
                        placeholder="Search keywords..."
                        value={keywordsSearchTerm}
                        onChange={(e) => setKeywordsSearchTerm(e.target.value)}
                        className={`pl-10 pr-4 py-2 text-sm border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark"
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500"
                          }`}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>
                    {keywordsSearchTerm && (
                      <button
                        onClick={() => setKeywordsSearchTerm("")}
                        className={`mr-2 p-2 rounded-lg transition-colors duration-200 ${theme === "dark"
                          ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          }`}
                        title="Clear search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {filteredKeywords.length > 0 ? (
                    <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-1/6 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}
                          >
                            Keyword
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-2/3 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}
                          >
                            QS Trend
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-1/6 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}
                          >
                            Avg QS
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`${theme === 'dark' ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                        {filteredKeywords.map(
                          (keyword: KeywordDto) => {
                            const scores = keyword.scores || [];
                            // Calculate average QS from non-zero scores
                            const nonZeroScores = scores.filter((s) => s.qs > 0);
                            const avgQs =
                              nonZeroScores.length > 0
                                ? nonZeroScores.reduce((sum, s) => sum + s.qs, 0) /
                                nonZeroScores.length
                                : 0;

                            // Calculate trend from scores (current vs previous non-zero value)
                            let trendPercentage = 0;
                            if (nonZeroScores.length >= 2) {
                              const current = nonZeroScores[nonZeroScores.length - 1].qs;
                              const previous = nonZeroScores[nonZeroScores.length - 2].qs;
                              trendPercentage =
                                previous !== 0 ? ((current - previous) / previous) * 100 : 0;
                            }

                            return (
                              <tr
                                key={keyword.id}
                                className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                                onClick={() =>
                                  navigate(
                                    `/adgroups/${adGroupId}/keywords/${keyword.id}`,
                                  )
                                }
                              >
                                <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate inline-block max-w-[150px] ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={keyword.keyword}>
                                      {keyword.keyword}
                                    </span>
                                    <div className="relative group">
                                      <span
                                        className={`inline-block w-2 h-2 rounded-full ${getStatusColor(keyword.status)}`}
                                        style={{ marginBottom: "0.25rem" }}
                                        title={keyword.status}
                                      ></span>
                                      <div
                                        className={`cursor-pointer absolute z-10 hidden group-hover:block ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-800'} ${getStatusTextColor(keyword.status)} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                                      >
                                        {keyword.status}
                                      </div>
                                    </div>
                                  </div>
                                  <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                    ID: {keyword.id}
                                  </div>
                                </td>
                                <td className="px-6 py-4 w-2/3 whitespace-nowrap">
                                  <div className="w-full min-w-[200px]">
                                    <KeywordSparkline
                                      width="100%"
                                      scores={scores}
                                      timeRange={timeRange}
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {avgQs > 0 ? (
                                      <span
                                        className={`px-3 py-1 rounded-full text-sm font-medium ${avgQs >= 7
                                          ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`
                                          : avgQs >= 4
                                            ? `${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`
                                            : `${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'}`
                                          }`}
                                      >
                                        {avgQs.toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
                                        N/A
                                      </span>
                                    )}
                                    {nonZeroScores.length >= 2 ? (
                                      <span
                                        className={`ml-3 inline-flex items-center text-sm font-medium ${trendPercentage >= 0
                                          ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                          : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                                          }`}
                                      >
                                        {trendPercentage >= 0 ? '↑' : '↓'}{" "}
                                        {Math.abs(trendPercentage).toFixed(1)}%
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <div className={`p-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      No keywords found matching {keywordsSearchTerm}.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`p-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
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
