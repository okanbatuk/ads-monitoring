import { addDays, format, parse, startOfWeek, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { FiArrowDownRight, FiArrowUpRight } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdGroupSparkline } from "../components/AdGroupSparkline";
import {
  useCampaign,
  useCampaignAdGroups,
  useCampaignScores,
} from "../services";
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

// Badge component for status display
const StatusBadge = ({ status }: { status: string }) => {
  const { theme } = useTheme();
  const statusMap: Record<string, { bg: string; text: string }> = {
    ENABLED: {
      bg: theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100',
      text: theme === 'dark' ? 'text-green-400' : 'text-green-800'
    },
    PAUSED: {
      bg: theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-100',
      text: theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'
    },
    REMOVED: {
      bg: theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100',
      text: theme === 'dark' ? 'text-red-400' : 'text-red-800'
    },
  };

  const statusStyle = statusMap[status] || {
    bg: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    text: theme === 'dark' ? 'text-gray-300' : 'text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
    >
      {status}
    </span>
  );
};

const CampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState(7);
  const [activeTab, setActiveTab] = useState<"overview" | "adgroups">(
    "overview",
  );

  const {
    data: campaignResponse,
    isLoading: isLoadingCampaign,
    isError: isErrorCampaign,
    error: campaignError,
  } = useCampaign(campaignId || "");

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
  } = useCampaignScores(campaignId || "", timeRange);

  const {
    data: adGroupsResponse,
    isLoading: isLoadingAdGroups,
    isError: isErrorAdGroups,
    error: adGroupsError,
    refetch: refetchAdGroups,
  } = useCampaignAdGroups(campaignId || "");

  const isLoading =
    isLoadingCampaign ||
    isLoadingScores ||
    (activeTab === "adgroups" && isLoadingAdGroups);
  const isError =
    isErrorCampaign ||
    isErrorScores ||
    (activeTab === "adgroups" && isErrorAdGroups);
  const error =
    campaignError ||
    scoresError ||
    (activeTab === "adgroups" ? adGroupsError : null);

  const campaign = campaignResponse?.data;
  const scoresData = scoresResponse?.data?.scores || [];
  const adGroupsData = adGroupsResponse?.data?.adGroups || [];
  const adGroupCount = adGroupsResponse?.data?.total || 0;

  // Get bottom 5 ad groups by quality score with time range based sparkline data
  const bottomAdGroups = useMemo(() => {
    if (!adGroupsData.length) return [];

    // Create a copy of the array and sort by score (ascending)
    return [...adGroupsData]
      .sort((a, b) => (a.scores?.[0]?.qs || 0) - (b.scores?.[0]?.qs || 0))
      .slice(0, 5)
      .map((adGroup) => {
        // Create a map of date to score for easy lookup
        const scoreMap = new Map<string, number>();
        adGroup.scores?.forEach((score) => {
          const date = parse(score.date, "dd.MM.yyyy", new Date());
          scoreMap.set(format(date, "yyyy-MM-dd"), score.qs);
        });

        // Generate data points for the selected time range
        const now = new Date();
        const startDate = subDays(now, timeRange - 1);

        // For time ranges > 30 days, group by week
        if (timeRange > 30) {
          const weekGroups = new Map<string, { sum: number; count: number }>();

          // Process each day in the time range
          for (let i = 0; i < timeRange; i++) {
            const currentDate = addDays(startDate, i);
            const weekStart = format(startOfWeek(currentDate), "yyyy-MM-dd");
            const dateStr = format(currentDate, "yyyy-MM-dd");
            const score = scoreMap.get(dateStr) || 0;

            if (!weekGroups.has(weekStart)) {
              weekGroups.set(weekStart, { sum: 0, count: 0 });
            }

            const group = weekGroups.get(weekStart)!;
            group.sum += score;
            group.count++;
          }

          // Convert week groups to chart data
          const weeklyData = Array.from(weekGroups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekStart, { sum, count }]) => ({
              date: format(new Date(weekStart), "MMM d"),
              qs: count > 0 ? sum / count : 0, // Weekly average
            }));

          return {
            ...adGroup,
            score: adGroup.scores?.[0]?.qs || 0,
            sparklineData: weeklyData,
          };
        } else {
          // For 7-30 days, show daily data
          const dailyData = [];
          for (let i = 0; i < timeRange; i++) {
            const currentDate = addDays(startDate, i);
            const dateStr = format(currentDate, "yyyy-MM-dd");
            const displayDate = format(
              currentDate,
              timeRange <= 14 ? "MMM d" : "d MMM",
            );

            dailyData.push({
              date: displayDate,
              qs: scoreMap.get(dateStr) || 0,
            });
          }

          return {
            ...adGroup,
            score: adGroup.scores?.[0]?.qs || 0,
            sparklineData: dailyData,
          };
        }
      });
  }, [adGroupsData, timeRange]);

  // Calculate current quality score and trend from scores data
  const { currentScore, trend } = useMemo(() => {
    if (!scoresData?.length) return { currentScore: 0, trend: 0 };

    // Sort scores by date in descending order
    const sortedScores = [...scoresData].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const current = sortedScores[0]?.qs || 0;
    const previous = sortedScores[1]?.qs || 0;

    // Calculate trend percentage (0 if no previous data)
    const trend =
      previous && current ? ((current - previous) / previous) * 100 : 0;

    return {
      currentScore: current,
      trend: parseFloat(trend.toFixed(1)),
    };
  }, [scoresData]);

  // Format scores data for the chart
  const chartData = useMemo(() => {
    if (!scoresData || scoresData.length === 0) {
      // Return empty data points for the selected time range
      const emptyData = [];
      const today = new Date();
      for (let i = timeRange - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        emptyData.push({
          axisDate:
            timeRange >= 364
              ? format(date, "mmm d, yyyy")
              : format(date, "mmm d"),
          date: format(date, "yyyy-MM-dd"),
          qs: 0,
        });
      }
      return emptyData;
    }

    // Create a map of dates to scores for easy lookup
    const scoreMap = new Map<string, { qs: number; adGroupCount: number }>();
    scoresData.forEach((score) => {
      // const dateStr = format(new Date(score.date), 'yyyy-MM-dd');
      const date = parse(score.date, "dd.MM.yyyy", new Date());
      const dateStr = format(date, "yyyy-MM-dd");
      scoreMap.set(dateStr, {
        qs: score.qs || 0,
        adGroupCount: score.adGroupCount || 0,
      });
    });

    // Generate data points for the selected time range
    const today = new Date();
    const dateArray = Array.from({ length: timeRange }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (timeRange - 1 - i));
      return date;
    });

    return dateArray.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const displayDate = format(
        date,
        timeRange >= 360 ? "MMM d, yyyy" : "MMM d",
      );
      return {
        axisDate: displayDate,
        date: dateStr,
        qs: (scoreMap.get(dateStr) || { qs: 0, adGroupCount: 0 }).qs,
        adGroupCount: (scoreMap.get(dateStr) || { qs: 0, adGroupCount: 0 })
          .adGroupCount,
      };
    });
  }, [scoresData, timeRange]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full p-6">
        <div className="container mx-auto">
          <SkeletonLoader className="h-8 w-64 mb-4" />
          <SkeletonLoader className="h-6 w-48 mb-8" />
          <SkeletonLoader className="h-64 w-full mb-8" />
          <SkeletonLoader className="h-32 w-full mb-8" />
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

  const getStatusStyle = (status: string): { bg: string; tx: string } => {
    return status === "ENABLED"
      ? { bg: "bg-green-500", tx: "text-green-600" }
      : status === "PAUSED"
        ? { bg: "bg-yellow-500", tx: "text-yellow-600" }
        : { bg: "bg-red-500", tx: "text-red-600" };
  };

  const gradientOffset = () => {
    const vals = chartData.map((d) => d.qs);
    const dataMax = Math.max(...vals);
    const dataMin = Math.min(...vals);
    if (dataMax <= 4) return 0;
    if (dataMin >= 7) return 1;
    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();

  return (
    <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className={`rounded-lg shadow p-6 mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        >
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li>
                <Link to="/" className={`${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors duration-200`}>
                  Home
                </Link>
              </li>
              <li className="flex items-center">
                <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>/</span>
                <span className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>MCC Account</span>
              </li>
              <li className="flex items-center">
                <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>/</span>
                <span className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>Sub Account</span>
              </li>
              <li className="flex items-center">
                <span className={`mx-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>/</span>
                <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-700'} font-medium`}>
                  {campaign?.name || "Campaign"}
                </span>
              </li>
            </ol>
          </nav>

          <div>
            <div className="flex items-center gap-3">
              <h1
                className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {campaign?.name || "Campaign"}
              </h1>
              {campaign?.status && (
                <div className="relative group">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(campaign.status).bg}`}
                    style={{ marginBottom: "0.25rem" }}
                    title={campaign.status}
                  ></span>
                  <div
                    className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusStyle(campaign.status).tx} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                  >
                    {campaign.status}
                  </div>
                </div>
              )}
            </div>
            <div
              className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
            >
              <span>Campaign ID: {campaignId}</span>
            </div>

            <div
              className={`flex flex-wrap items-center gap-4 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"} mt-2`}
            >
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
                <span className="font-medium">Ad Groups: </span>
                <span className="font-semibold">{adGroupCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={`border-b mb-6 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === "overview"
                  ? `${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-500 text-green-600'}`
                  : `${theme === 'dark' ? 'border-transparent text-gray-400 hover:text-green-400 hover:border-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab("adgroups");
                refetchAdGroups();
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === "adgroups"
                  ? `${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-500 text-green-600'}`
                  : `${theme === 'dark' ? 'border-transparent text-gray-400 hover:text-green-400 hover:border-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
              }`}
            >
              Ad Groups ({adGroupCount})
            </button>
          </nav>
        </div>

        {/* Date Range Selector */}
        <div className="flex justify-end items-center mb-6">
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((range, index) => (
              <button
                key={range.days}
                type="button"
                onClick={() => setTimeRange(range.days)}
                className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  timeRange === range.days
                    ? `${theme === 'dark' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`
                    : `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`
                } ${index === 0 ? "rounded-l-md" : ""} ${
                  index === TIME_RANGES.length - 1 ? "rounded-r-md" : ""
                } border`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="space-y-6">
            {/* Quality Score Trend Chart */}
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quality Score Trend</h2>
                <div className="flex items-center">
                  <span className={`text-sm mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Current:</span>
                  <span className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {currentScore.toFixed(1)}
                  </span>
                  {trend !== 0 && (
                    <span
                      className={`ml-2 text-sm ${trend > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-64">
                {isLoadingScores ? (
                  <SkeletonLoader className="h-full w-full" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
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
                                  <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Ad Groups:
                                  </span>
                                  <span className={`font-medium text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {payload[0].payload.adGroupCount}
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
                  <div className={`h-full flex items-center justify-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    No data available for the selected period
                  </div>
                )}
              </div>
            </div>

            {/* Bottom 5 Ad Groups Section */}
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Bottom 5 Ad Groups by Quality Score
              </h3>
              {bottomAdGroups.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <tr>
                        <th
                          scope="col"
                          className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                        >
                          Ad Group
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
                          AVG QS
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${theme === 'dark' ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                      {bottomAdGroups.map((adGroup) => {
                        const latestScore = adGroup.score;
                        const sparklineData = adGroup.sparklineData || [];

                        // Calculate trend from sparkline data (first vs last non-zero value)
                        const nonZeroScores = sparklineData.filter(
                          (d) => d.qs > 0,
                        );
                        let trendPercentage = 0;

                        if (nonZeroScores.length >= 2) {
                          const firstScore = nonZeroScores[0].qs;
                          const lastScore =
                            nonZeroScores[nonZeroScores.length - 1].qs;
                          trendPercentage =
                            ((lastScore - firstScore) / (firstScore || 1)) *
                            100;
                        }

                        return (
                          <tr
                            key={adGroup.id}
                            className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                            onClick={() =>
                              navigate(
                                `/campaigns/${campaignId}/adgroups/${adGroup.id}`,
                              )
                            }
                          >
                            <td className="px-6 py-4 w-1/6">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                  {adGroup.name}
                                </span>
                                <div className="relative group">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(adGroup.status).bg}`}
                                    style={{ marginBottom: "0.25rem" }}
                                    title={adGroup.status}
                                  ></span>
                                  <div
                                    className={`cursor-pointer absolute z-10 hidden group-hover:block rounded px-3 py-2 -mt-8 -ml-2 ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-800'} ${getStatusStyle(adGroup.status).tx} text-xs`}
                                  >
                                    {adGroup.status}
                                  </div>
                                </div>
                              </div>
                              <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                ID: {adGroup.id}
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/2">
                              <div className="w-full h-10">
                                {sparklineData.length > 0 ? (
                                  <div className="w-full h-10">
                                    <ResponsiveContainer
                                      width="100%"
                                      height="100%"
                                    >
                                      <LineChart data={sparklineData}>
                                        <Line
                                          type="monotone"
                                          dataKey="qs"
                                          stroke="#3b82f6"
                                          strokeWidth={2}
                                          dot={false}
                                          activeDot={{
                                            r: 4,
                                            fill: "#3b82f6",
                                            stroke: "#fff",
                                            strokeWidth: 2,
                                          }}
                                        />
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide domain={[0, 10]} />
                                        <Tooltip
                                          content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                              const qsValue = Number(payload[0].value);
                                              const displayQs = qsValue.toFixed(1);
                                              const isDark = theme === "dark";
                                              return (
                                                <div
                                                  className={`space-y-1.5 p-3 rounded-lg backdrop-blur-sm border shadow-sm ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50/95 border-gray-100"}`}
                                                  style={{
                                                    boxShadow: isDark
                                                      ? "0 4px 20px -5px rgba(0, 0, 0, 0.2)"
                                                      : "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
                                                  }}
                                                >
                                                  <div className="flex items-center justify-between space-x-4">
                                                    <span
                                                      className={`text-sm ${
                                                        isDark ? "text-gray-300" : "text-gray-500"
                                                      }`}
                                                    >
                                                      {payload[0].payload.date}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between space-x-4">
                                                    <span
                                                      className={`text-sm ${
                                                        isDark ? "text-gray-400" : "text-gray-500"
                                                      }`}
                                                    >
                                                      Quality Score
                                                    </span>
                                                    <span
                                                      className={`text-sm font-medium ${
                                                        qsValue >= 7
                                                          ? isDark
                                                            ? "text-green-400"
                                                            : "text-green-600"
                                                          : qsValue >= 4
                                                            ? isDark
                                                              ? "text-yellow-400"
                                                              : "text-yellow-600"
                                                            : isDark
                                                              ? "text-red-400"
                                                              : "text-red-600"
                                                      }`}
                                                    >
                                                      {displayQs}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            return null;
                                          }}
                                          contentStyle={{
                                            background: "transparent",
                                            border: "none",
                                            boxShadow: "none",
                                            padding: 0,
                                          }}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <div className={`text-xs h-full flex items-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
                                    No data
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/6">
                              <div className="flex items-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    latestScore >= 7
                                      ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`
                                      : latestScore >= 4
                                        ? `${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`
                                        : `${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'}`
                                  }`}
                                >
                                  {latestScore.toFixed(1)}
                                </span>
                                {sparklineData.length > 1 &&
                                  nonZeroScores.length >= 2 && (
                                    <span
                                      className={`ml-2 text-sm ${trendPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
                                    >
                                      {trendPercentage >= 0 ? "↑" : "↓"}{" "}
                                      {Math.abs(trendPercentage).toFixed(1)}%
                                    </span>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`px-6 py-4 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  No ad groups found
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
            <div className={`p-4 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} border-b`}>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Ad Groups</h2>
              <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {isLoadingAdGroups
                  ? "Loading..."
                  : `${adGroupCount} ad groups found`}
              </p>
            </div>

            {isLoadingAdGroups ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-12 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded`}></div>
                  ))}
                </div>
              </div>
            ) : adGroupsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <tr>
                      <th
                        scope="col"
                        className={`px-6 py-3 w-1/4 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                      >
                        Ad Group
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 w-1/6 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 w-2/5 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                      >
                        QS Trend
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 w-1/6 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                      >
                        Avg QS
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`${theme === 'dark' ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                    {adGroupsData.map((adGroup) => {
                      const scores = adGroup.scores || [];
                      const latestScore = scores.length > 0 ? scores[0].qs : 0;
                      const previousScore =
                        scores.length > 1 ? scores[1].qs : latestScore;
                      const trend = latestScore - previousScore;
                      const trendPercentage = previousScore
                        ? (trend / previousScore) * 100
                        : 0;

                      return (
                        <tr
                          key={adGroup.id}
                          className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                          onClick={() =>
                            navigate(
                              `/campaigns/${campaignId}/adgroups/${adGroup.id}`,
                            )
                          }
                        >
                          <td className="px-6 py-4 w-1/4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {adGroup.name}
                            </div>
                            <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              ID: {adGroup.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <StatusBadge status={adGroup.status} />
                          </td>
                          <td className="px-6 py-4 w-2/5 whitespace-nowrap">
                            <div className="w-full min-w-[200px] h-10">
                              <AdGroupSparkline
                                scores={scores}
                                width="100%"
                                height={40}
                                timeRange={timeRange}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <div className="flex items-center">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  latestScore >= 7
                                    ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`
                                    : latestScore >= 4
                                      ? `${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`
                                      : `${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'}`
                                }`}
                              >
                                {latestScore.toFixed(1)}/10
                              </span>
                              {!isNaN(trendPercentage) &&
                                trendPercentage !== 0 && (
                                  <span
                                    className={`ml-3 inline-flex items-center text-sm font-medium ${
                                      trend > 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {trend > 0 ? (
                                      <FiArrowUpRight className="mr-1" />
                                    ) : (
                                      <FiArrowDownRight className="mr-1" />
                                    )}
                                    {Math.abs(trendPercentage).toFixed(1)}%
                                  </span>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={`p-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No ad groups found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignPage;
