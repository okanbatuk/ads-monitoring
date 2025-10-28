import { addDays, format, isValid, parse, subDays } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CampaignSparkline } from "../components/CampaignSparkline";
import { useTheme } from "../contexts/ThemeProvider";
import {
  useAccount,
  useAccountCampaigns,
  useAccountScores,
} from "../services/api";
import type { AccountScoreDto, CampaignScoreDto } from "../types/api.types";
// Define types for chart data
interface ChartDataPoint {
  axisDate: string;
  date: string;
  qs: number;
  campaignCount: number;
}

const MccSubAccountPage: React.FC = () => {
  // Navigation and routing
  const navigate = useNavigate();
  const { accountId = "" } = useParams<{ accountId: string }>();

  // Time range options
  const TIME_RANGES = [
    { days: 7, label: "7d" },
    { days: 30, label: "30d" },
    { days: 90, label: "90d" },
    { days: 365, label: "1y" },
  ];

  // Component state
  const [timeRange, setTimeRange] = useState<number>(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [showBestCampaigns, setShowBestCampaigns] = useState(false);
  const [campaignsSearchTerm, setCampaignsSearchTerm] = useState("");
  const { theme } = useTheme();

  // Data fetching
  const {
    data: accountResponse,
    isLoading: isLoadingAccount,
    isError: isErrorAccount,
    error: accountError,
  } = useAccount(accountId);

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
  } = useAccountScores(accountId, timeRange);

  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    isError: isErrorCampaigns,
    error: campaignsError,
  } = useAccountCampaigns(accountId);

  // Process data
  const account = accountResponse?.data;
  const mccId = account && account?.parentId;

  const { data: managerResponse } = useAccount(mccId?.toString() || "");
  const manager = managerResponse?.data;

  const getStatusStyle = (status: string): { bg: string; tx: string } => {
    return status === "ENABLED"
      ? { bg: "bg-green-500", tx: "text-green-600" }
      : status === "PAUSED"
        ? { bg: "bg-yellow-500", tx: "text-yellow-600" }
        : { bg: "bg-red-500", tx: "text-red-600" };
  };

  // Process and format scores data for the chart
  const { scores } = useMemo<{
    scores: ChartDataPoint[];
    scoreMap: Map<string, { qs: number; campaignCount: number }>;
  }>(() => {
    const defaultReturn = {
      scores: [],
      scoreMap: new Map<string, { qs: number; campaignCount: number }>(),
    };

    if (!scoresResponse?.data?.scores?.length) {
      return defaultReturn;
    }

    const rawScores = scoresResponse.data.scores as AccountScoreDto[];
    const scoreMap = new Map<string, { qs: number; campaignCount: number }>();

    // First pass: create a map of dates to scores
    rawScores.forEach((score) => {
      try {
        // Parse the date string from the API (assuming format is 'dd.MM.yyyy')
        const date = parse(score.date, "dd.MM.yyyy", new Date());
        // Only add valid dates to the map
        if (!isNaN(date.getTime())) {
          // Use a consistent format for the map key (YYYY-MM-DD)
          const dateKey = format(date, "yyyy-MM-dd");
          scoreMap.set(dateKey, {
            qs: parseFloat(score.qs.toFixed(2)),
            campaignCount: score.campaignCount,
          });
        } else {
          console.warn("Invalid date in scores data:", score.date);
        }
      } catch (error) {
        console.error("Error parsing date:", score.date, error);
      }
    });

    // Generate data points for the selected time range
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    const scores: ChartDataPoint[] = [];

    // If no valid scores were found, return empty results
    if (scoreMap.size === 0) {
      return defaultReturn;
    }

    for (let i = 0; i < timeRange; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const displayDate = format(
        currentDate,
        timeRange >= 360 ? "MMM d, yyyy" : "MMM d",
      );

      scores.push({
        axisDate: displayDate,
        date: dateStr,
        qs: (scoreMap.get(dateStr) || { qs: 0, campaignCount: 0 }).qs,
        campaignCount: (scoreMap.get(dateStr) || { qs: 0, campaignCount: 0 })
          .campaignCount,
      });
    }

    return { scores, scoreMap };
  }, [scoresResponse]);

  const { campaigns, campaignCount } = useMemo(() => {
    const response = campaignsResponse;
    const campaignsData = response?.data?.campaigns || [];
    const count = response?.data?.total || 0;

    const processedCampaigns = campaignsData.map((campaign) => {
      // Process campaign scores to ensure proper date formatting
      const processedScores = Array.isArray(campaign.scores)
        ? campaign.scores.map((score) => ({
            ...score,
            // Ensure date is in the correct format (dd.MM.yyyy)
            date: format(
              parse(score.date, "dd.MM.yyyy", new Date()),
              "dd.MM.yyyy",
            ),
          }))
        : [];

      // Calculate average QS and trend
      const nonZeroScores = processedScores.filter((score) => score.qs > 0);
      const avgQs =
        nonZeroScores.length > 0
          ? nonZeroScores.reduce((sum, score) => sum + score.qs, 0) /
            nonZeroScores.length
          : 0;

      // Calculate trend percentage
      let trendPercentage = 0;
      if (processedScores.length >= 2) {
        const current = processedScores[processedScores.length - 1]?.qs || 0;
        const previous = processedScores[processedScores.length - 2]?.qs || 0;
        trendPercentage =
          previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      }

      return {
        ...campaign,
        accountId: campaign.accountId || accountId,
        scores: processedScores,
        avgQs,
        trendPercentage,
      };
    });

    return { campaigns: processedCampaigns, campaignCount: count };
  }, [campaignsResponse, accountId]);

  // Get worst 5 campaigns by average QS
  const worstCampaigns = [...campaigns]
    .sort((a, b) => a.avgQs - b.avgQs)
    .slice(0, 5);

  // Get best 5 campaigns by average QS
  const bestCampaigns = [...campaigns]
    .sort((a, b) => b.avgQs - a.avgQs)
    .slice(0, 5);

  // Get current campaigns to display
  const displayedCampaigns = showBestCampaigns ? bestCampaigns : worstCampaigns;

  // Filter campaigns by search term for Campaigns tab
  const filteredCampaigns = campaigns.filter((campaign) =>
    campaignsSearchTerm.length > 2
      ? campaign.name.toLowerCase().includes(campaignsSearchTerm.toLowerCase())
      : true,
  );

  const avgQs = useMemo(() => {
    if (!scores?.length) return 0;
    const validScores = scores.filter((score) => score.qs > 0);
    if (!validScores.length) return 0;
    const sum = validScores.reduce((acc, score) => acc + score.qs, 0);
    return sum / validScores.length;
  }, [scores]);

  // Calculate latest score
  const latestScore = scores?.[scores.length - 1]?.qs || 0;

  // Calculate trend
  const trend = useMemo(() => {
    const current = latestScore;
    const previous = scores?.[scores.length - 2]?.qs || 0;
    return previous && current ? ((current - previous) / previous) * 100 : 0;
  }, [scores, latestScore]);

  const hash = location.hash;

  useEffect(() => {
    if (hash === "#campaigns") setActiveTab("campaigns");
  }, [hash]);

  // Loading and error states
  const isLoading = isLoadingAccount || isLoadingScores || isLoadingCampaigns;
  const hasError = isErrorAccount || isErrorScores || isErrorCampaigns;
  const error = accountError || scoresError || campaignsError;

  // Render loading state
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

  // Render error state
  if (hasError) {
    return (
      <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto">
          <h2
            className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Error: {error?.message || "Failed to load data"}
          </h2>
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
    <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header with breadcrumb  */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-2">
            <li>
              <Link
                to="/"
                className={`${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"} transition-colors duration-200`}
              >
                Home
              </Link>
            </li>
            {mccId && (
              <li className="flex items-center">
                <span
                  className={`mx-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                >
                  {">"}
                </span>
                <Link
                  to={`/manager/${mccId}`}
                  className={`${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"} transition-colors duration-200`}
                >
                  {manager?.name}
                </Link>
              </li>
            )}

            <li className="flex items-center">
              <span
                className={`mx-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
              >
                {">"}
              </span>
              <Link
                to={`/manager/${mccId}#accounts`}
                className={`${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"} transition-colors duration-200`}
              >
                Accounts
              </Link>
            </li>

            <li className="flex items-center">
              <span
                className={`mx-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
              >
                {">"}
              </span>
              <span
                className={`${theme === "dark" ? "text-white" : "text-gray-700"} font-medium`}
              >
                {account?.name || "Account"}
              </span>
            </li>
          </ol>
        </nav>
        <div
          className={`rounded-lg shadow p-6 mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {account?.name || "Sub Account"}
                </h1>
                {account?.status && (
                  <div className="relative group">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(account.status).bg}`}
                      style={{ marginBottom: "0.25rem" }}
                      title={account?.status}
                    ></span>
                    <div
                      className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusStyle(account.status).tx} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                    >
                      {account?.status}
                    </div>
                  </div>
                )}
              </div>
              <p
                className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                Account ID: {account?.accountId || "N/A"}
              </p>

              <div
                className={`flex flex-wrap items-center gap-4 mt-4 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
              >
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span
                    className={`ml-1 font-semibold ${latestScore >= 7 ? "text-green-600" : latestScore >= 4 ? "text-yellow-600" : "text-red-600"}`}
                  >
                    {latestScore.toFixed(1)}/10
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
                  <span
                    className={`font-semibold ${avgQs >= 7 ? (theme === "dark" ? "text-green-400" : "text-green-600") : avgQs >= 4 ? (theme === "dark" ? "text-yellow-400" : "text-yellow-600") : theme === "dark" ? "text-red-400" : "text-red-600"}`}
                  >
                    {avgQs.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Campaigns: </span>
                  <span className="font-semibold">{campaignCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`border-b mb-6 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
        >
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("overview")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === "overview"
                  ? `${theme === "dark" ? "border-green-500 text-green-400" : "border-green-500 text-green-600"}`
                  : `${theme === "dark" ? "border-transparent text-gray-400 hover:text-green-400 hover:border-green-400" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("campaigns")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === "campaigns"
                  ? `${theme === "dark" ? "border-green-500 text-green-400" : "border-green-500 text-green-600"}`
                  : `${theme === "dark" ? "border-transparent text-gray-400 hover:text-green-400 hover:border-green-400" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`
              }`}
            >
              Campaigns ({campaignCount})
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
                    ? `${theme === "dark" ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-blue-100 text-blue-700 border-blue-300"}`
                    : `${theme === "dark" ? "bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`
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
            {/* Quality Score Trend */}
            {campaigns.length > 0 ? (
              <div
                className={`p-6 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                  <h3
                    className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    Quality Score Trend
                  </h3>
                  <div className="flex items-center">
                    <span
                      className={`text-sm mr-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Current:
                    </span>
                    <span
                      className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {latestScore.toFixed(1)}
                    </span>
                    {trend !== 0 && (
                      <span
                        className={`ml-2 text-sm ${trend > 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={scores}
                      margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={theme === "dark" ? "#374151" : "#f0f0f0"}
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
                        tick={{
                          fontSize: 12,
                          fill: theme === "dark" ? "#9ca3af" : "#4b5563",
                        }}
                        tickLine={false}
                        axisLine={{
                          stroke: theme === "dark" ? "#4b5563" : "#9ca3af",
                          strokeWidth: 1,
                        }}
                        width={30}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const qsValue = Number(payload[0].value);
                            const displayQs = qsValue.toFixed(1);
                            return (
                              <div
                                className={`space-y-1.5 p-2 rounded-lg border shadow-md ${
                                  theme === "dark"
                                    ? "bg-gray-800 border-gray-700"
                                    : "bg-white border-gray-200"
                                }`}
                              >
                                <div>
                                  <span className="font-semibold text-sm">
                                    {format(
                                      new Date(payload[0].payload.date),
                                      "MMM d, yyyy",
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                  <span
                                    className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                                  >
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
                                  <span
                                    className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                  >
                                    Campaigns:
                                  </span>
                                  <span
                                    className={`font-medium text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                                  >
                                    {payload[0].payload.campaignCount}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                        cursor={{
                          stroke: "#e5e7eb",
                          strokeWidth: 1,
                          strokeDasharray: "3 3",
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
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div
                className={`p-12 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}
              >
                <div className="text-center">
                  <div
                    className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"}`}
                  >
                    <svg
                      className={`w-8 h-8 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14-7H5m14 14H5"
                      />
                    </svg>
                  </div>
                  <h3
                    className={`text-xl font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    No campaigns found
                  </h3>
                  <p
                    className={`text-lg mb-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                  >
                    There are no campaigns in this account.
                  </p>
                  <div
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    <p>Campaigns you create will appear here.</p>
                    <p className="mt-1">
                      Last updated:{" "}
                      {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Worst 5 Campaigns Table */}
            {campaigns.length > 0 && (
              <div
                className={`p-6 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h3
                      className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {showBestCampaigns
                        ? "Best 5 Campaigns"
                        : "Worst 5 Campaigns"}{" "}
                      (by QS)
                    </h3>
                    <button
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 ${
                        theme === "dark"
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                      onClick={() => setShowBestCampaigns(!showBestCampaigns)}
                      title={`Switch to ${showBestCampaigns ? "Worst" : "Best"} 5 Campaigns`}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${showBestCampaigns ? "rotate-180" : ""}`}
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

                {isLoadingCampaigns ? (
                  <div className="p-6 text-center">Loading campaigns...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead
                        className={
                          theme === "dark" ? "bg-gray-700" : "bg-gray-50"
                        }
                      >
                        <tr>
                          <th
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === "dark" ? "text-gray-200" : "text-gray-500"}`}
                          >
                            Campaigns
                          </th>
                          <th
                            className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider w-2/3 ${theme === "dark" ? "text-gray-200" : "text-gray-500"}`}
                          >
                            QS Trends
                          </th>
                          <th
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === "dark" ? "text-gray-200" : "text-gray-500"}`}
                          >
                            Avg QS
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${
                          theme === "dark"
                            ? "divide-gray-700 bg-gray-800"
                            : "divide-gray-200 bg-white"
                        }`}
                      >
                        {displayedCampaigns.map((campaign, index) => {
                          const validScores = campaign.scores || [];

                          return (
                            <tr
                              key={campaign.id}
                              className={`cursor-pointer ${
                                theme === "dark"
                                  ? "hover:bg-gray-700"
                                  : "hover:bg-gray-50"
                              }`}
                              onClick={() =>
                                navigate(
                                  `/account/${accountId}/campaign/${campaign.id}`,
                                )
                              }
                            >
                              <td className="px-6 py-4 w-1/6">
                                <div className="flex items-center gap-2 align-top">
                                  <span
                                    className={`whitespace-nowrap text-sm font-medium truncate inline-block max-w-[150px] ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                                    title={campaign.name}
                                  >
                                    {campaign.name}
                                  </span>
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
                                </div>
                                <div
                                  className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                                >
                                  ID: {campaign.id}
                                </div>
                              </td>
                              <td className="px-6 py-4 w-2/3">
                                <div className="h-10">
                                  <CampaignSparkline
                                    scores={validScores}
                                    timeRange={timeRange}
                                    width="100%"
                                    height={40}
                                  />
                                </div>
                              </td>
                              <td className="px-6 py-4 w-1/6">
                                <div className="flex items-center">
                                  <span
                                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                      campaign.avgQs >= 7
                                        ? theme === "dark"
                                          ? "bg-green-900 text-green-200"
                                          : "bg-green-100 text-green-800"
                                        : campaign.avgQs >= 4
                                          ? theme === "dark"
                                            ? "bg-yellow-900 text-yellow-200"
                                            : "bg-yellow-100 text-yellow-800"
                                          : theme === "dark"
                                            ? "bg-red-900 text-red-200"
                                            : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {campaign.avgQs.toFixed(1)}
                                  </span>
                                  {campaign.trendPercentage !== 0 && (
                                    <span
                                      className={`ml-2 text-sm ${campaign.trendPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
                                    >
                                      {campaign.trendPercentage >= 0
                                        ? "↑"
                                        : "↓"}{" "}
                                      {Math.abs(
                                        campaign.trendPercentage,
                                      ).toFixed(1)}
                                      %
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
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-lg shadow overflow-hidden`}
          >
            {isLoadingCampaigns ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-12 ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"} rounded`}
                    ></div>
                  ))}
                </div>
              </div>
            ) : campaigns.length > 0 ? (
              <div>
                {/* Search Input */}
                <div
                  className={`flex items-center justify-between ${theme === "dark" ? "border-gray-700" : "border-gray-200"} border-b`}
                >
                  <div className={`p-4`}>
                    <h3
                      className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      Campaigns
                    </h3>
                    <p
                      className={`mt-1 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      {campaigns.length} campaigns found
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`relative w-full ${!campaignsSearchTerm && "pr-4"}`}
                    >
                      <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={campaignsSearchTerm}
                        onChange={(e) => setCampaignsSearchTerm(e.target.value)}
                        className={`pl-10 pr-4 py-2 text-sm border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          theme === "dark"
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
                    {campaignsSearchTerm && (
                      <button
                        onClick={() => setCampaignsSearchTerm("")}
                        className={`mr-2 p-2 rounded-lg transition-colors duration-200 ${
                          theme === "dark"
                            ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        }`}
                        title="Clear search"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {filteredCampaigns.length > 0 ? (
                    <table
                      className={`min-w-full ${theme === "dark" ? "divide-gray-700" : "divide-gray-200"}`}
                    >
                      <thead
                        className={`${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}
                      >
                        <tr>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-1/6 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`}
                          >
                            Campaign
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-2/3 text-center text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`}
                          >
                            QS Trend
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-1/6 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`}
                          >
                            Avg QS
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className={`${theme === "dark" ? "bg-gray-800 divide-gray-700" : "bg-white divide-gray-200"}`}
                      >
                        {filteredCampaigns.map((campaign) => {
                          const validScores = campaign.scores || [];

                          return (
                            <tr
                              key={campaign.id}
                              className={`cursor-pointer transition-colors duration-200 ${theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
                              onClick={() =>
                                navigate(
                                  `/account/${accountId}/campaign/${campaign.id}`,
                                )
                              }
                            >
                              <td className="px-6 py-4 w-1/6">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-medium truncate inline-block max-w-[150px] ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                                    title={campaign.name}
                                  >
                                    {campaign.name}
                                  </span>
                                  <div className="relative group">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(campaign.status).bg}`}
                                      style={{ marginBottom: "0.25rem" }}
                                      title={campaign.status}
                                    ></span>
                                    <div
                                      className={`cursor-pointer absolute z-10 hidden group-hover:block rounded px-3 py-2 -mt-8 -ml-2 ${theme === "dark" ? "bg-gray-900 text-gray-200" : "bg-gray-200 text-gray-800"} ${getStatusStyle(campaign.status).tx} text-xs`}
                                    >
                                      {campaign.status}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className={`text-xs mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                                >
                                  ID: {campaign.id}
                                </div>
                              </td>
                              <td className="px-6 py-4 w-2/3 whitespace-nowrap">
                                <div className="w-full min-w-[200px] h-10">
                                  <CampaignSparkline
                                    scores={validScores}
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
                                      campaign.avgQs >= 7
                                        ? `${theme === "dark" ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-800"}`
                                        : campaign.avgQs >= 4
                                          ? `${theme === "dark" ? "bg-yellow-900/30 text-yellow-400" : "bg-yellow-100 text-yellow-800"}`
                                          : `${theme === "dark" ? "bg-red-900/30 text-red-400" : "bg-red-100 text-red-800"}`
                                    }`}
                                  >
                                    {campaign.avgQs.toFixed(1)}/10
                                  </span>
                                  {campaign.trendPercentage !== 0 && (
                                    <span
                                      className={`ml-3 inline-flex items-center text-sm font-medium ${
                                        campaign.trendPercentage > 0
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {campaign.trendPercentage > 0 ? "↑" : "↓"}{" "}
                                      {Math.abs(
                                        campaign.trendPercentage,
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div
                      className={`p-6 text-center italic ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      No campaigns found matching {campaignsSearchTerm}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`p-6 text-center italic ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                No campaigns found for this account.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MccSubAccountPage;
