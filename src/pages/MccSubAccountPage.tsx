import { addDays, format, isValid, parse, subDays } from "date-fns";
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const { subAccountId = "" } = useParams<{ subAccountId: string }>();

  // Time range options
  const TIME_RANGES = [
    { days: 7, label: "7d" },
    { days: 30, label: "30d" },
    { days: 90, label: "90d" },
    { days: 365, label: "1y" },
  ];

  // Component state
  const [timeRange, setTimeRange] = useState<number>(7);
  const { theme } = useTheme();

  // Debug log for API call parameters
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "campaigns">(
    "overview",
  );

  // Data fetching
  const {
    data: accountResponse,
    isLoading: isLoadingAccount,
    isError: isErrorAccount,
    error: accountError,
  } = useAccount(subAccountId);

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
  } = useAccountScores(subAccountId, timeRange);

  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    isError: isErrorCampaigns,
    error: campaignsError,
  } = useAccountCampaigns(subAccountId);

  // Process data
  const account = useMemo(() => {
    return accountResponse?.data;
  }, [accountResponse]);

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

      return {
        ...campaign,
        accountId: campaign.accountId || subAccountId,
        scores: processedScores,
      };
    });

    return { campaigns: processedCampaigns, campaignCount: count };
  }, [campaignsResponse, subAccountId]);

  const avgQs = useMemo(() => {
    if (!scores?.length) return 0;
    const validScores = scores.filter((score) => score.qs > 0);
    if (!validScores.length) return 0;
    const sum = validScores.reduce((acc, score) => acc + score.qs, 0);
    return sum / validScores.length;
  }, [scores]);

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
      <div
        className={`min-h-screen p-6 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
      >
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
        {/* Header Section */}
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
                    className={`ml-1 font-semibold ${avgQs >= 7 ? "text-green-600" : avgQs >= 4 ? "text-yellow-600" : "text-red-600"}`}
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

        {/* Quality Score Trend */}
        <div
          className={`p-6 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h3
              className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Quality Score Trend
            </h3>
            <div
              className="inline-flex rounded-md shadow-sm mt-2 sm:mt-0"
              role="group"
            >
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
          <div className="h-64">
            {scores.length > 0 ? (
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
                    <linearGradient id="colorQs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#3b82f6" stopOpacity={1} />
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
                  <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded">
                <p className="text-gray-500">No quality score data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Campaigns Table */}
        <div
          className={`p-6 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Campaigns
            </h3>
          </div>

          {isLoadingCampaigns ? (
            <div className="p-6 text-center">Loading campaigns...</div>
          ) : campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead
                  className={theme === "dark" ? "bg-gray-700" : "bg-gray-50"}
                >
                  <tr>
                    <th
                      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 ${theme === "dark" ? "text-gray-200" : "text-gray-500"}`}
                    >
                      Campaign
                    </th>
                    <th
                      className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider w-1/2 ${theme === "dark" ? "text-gray-200" : "text-gray-500"}`}
                    >
                      QS Trend
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
                  {campaigns.map((campaign, index) => {
                    const now = new Date();
                    // Process scores for the current time range
                    const validScores = (
                      Array.isArray(campaign.scores) ? campaign.scores : []
                    )
                      .map((score) => {
                        try {
                          if (!score || typeof score !== "object") return null;

                          // Ensure score has required properties
                          if (
                            typeof score.date !== "string" ||
                            score.qs === undefined
                          ) {
                            return null;
                          }

                          // Parse and validate date
                          const scoreDate = parse(
                            score.date,
                            "dd.MM.yyyy",
                            new Date(),
                          );
                          if (!isValid(scoreDate)) {
                            return null;
                          }

                          // Parse and validate QS value
                          const qsValue =
                            typeof score.qs === "number"
                              ? score.qs
                              : parseFloat(score.qs);

                          if (isNaN(qsValue) || qsValue < 0) {
                            return null;
                          }

                          // Create a valid score object with all required fields
                          return {
                            id: score.id || 0,
                            campaignId: score.campaignId || campaign.id,
                            date: format(scoreDate, "dd.MM.yyyy"),
                            qs: qsValue,
                            adGroupCount: score.adGroupCount || 0,
                          } as CampaignScoreDto;
                        } catch (e) {
                          return null;
                        }
                      })
                      .filter(
                        (score): score is CampaignScoreDto => score !== null,
                      );

                    // Calculate average QS and trend
                    const nonZeroScores = validScores.filter(
                      (score) => score.qs > 0,
                    );
                    const avgQs =
                      nonZeroScores.length > 0
                        ? nonZeroScores.reduce(
                            (sum, score) => sum + score.qs,
                            0,
                          ) / nonZeroScores.length
                        : 0;

                    // Calculate trend percentage
                    let trendPercentage = 0;
                    if (validScores.length >= 2) {
                      const firstScore = validScores[0]?.qs || 0;
                      const lastScore =
                        validScores[validScores.length - 1]?.qs || 0;
                      trendPercentage =
                        firstScore !== 0
                          ? ((lastScore - firstScore) / firstScore) * 100
                          : 0;
                    }

                    return (
                      <tr
                        key={campaign.id}
                        className={`cursor-pointer ${
                          theme === "dark"
                            ? "hover:bg-gray-700"
                            : "hover:bg-gray-50"
                        } ${index === campaigns.length - 1 ? "h-28 align-top" : "h-10"}`}
                        onClick={() =>
                          navigate(
                            `/accounts/${subAccountId}/campaigns/${campaign.id}`,
                          )
                        }
                      >
                        <td className="px-6 py-4 w-1/6">
                          <div className="flex items-center gap-2 align-top">
                            <span
                              className={`whitespace-nowrap text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
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
                            {campaign.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 w-1/2">
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
                                avgQs >= 7
                                  ? theme === "dark"
                                    ? "bg-green-900 text-green-200"
                                    : "bg-green-100 text-green-800"
                                  : avgQs >= 4
                                    ? theme === "dark"
                                      ? "bg-yellow-900 text-yellow-200"
                                      : "bg-yellow-100 text-yellow-800"
                                    : theme === "dark"
                                      ? "bg-red-900 text-red-200"
                                      : "bg-red-100 text-red-800"
                              }`}
                            >
                              {avgQs.toFixed(1)}
                            </span>
                            {validScores.length > 1 && (
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
            <div
              className={`mt-4 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
            >
              <p>Last updated: {format(new Date(), "MMM d, yyyy h:mm a")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MccSubAccountPage;
