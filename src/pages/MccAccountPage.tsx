import { addDays, format, parse, subDays } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
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
import { AccountSparkline } from "../components/AccountSparkline";
import ScrollToTop from "../components/ScrollToTop";
import { useTheme } from "../contexts/ThemeProvider";
import {
  useAccount,
  useMccAccountScores,
  useSubAccounts,
} from "../services/api";

// Time range options
const TIME_RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

interface ScoreData {
  axisDate: string;
  date: string;
  qs: number;
  accountCounts: number;
}

export const MccAccountPage = () => {
  const { mccId } = useParams<{ mccId: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<number>(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [showBestAccounts, setShowBestAccounts] = useState(false);
  const [accountsSearchTerm, setAccountsSearchTerm] = useState("");
  const { theme } = useTheme();

  // Fetch data
  const { data: accountData, isLoading: isLoadingAccount } = useAccount(
    mccId || "",
  );
  const { data: subAccountData, isLoading: isLoadingSubAccounts } =
    useSubAccounts(mccId || "");
  const { data: scoresResponse, isLoading: isLoadingScores } =
    useMccAccountScores(mccId || "", timeRange);

  // Process scores data
  const { scores } = useMemo<{
    scores: ScoreData[];
    scoreMap: Map<string, { qs: number; accountCounts: number }>;
  }>(() => {
    const defaultReturn = {
      scores: [],
      scoreMap: new Map<string, { qs: number; accountCounts: number }>(),
    };

    if (!scoresResponse?.data?.scores?.length) {
      return defaultReturn;
    }

    const rawScores = scoresResponse.data.scores;
    const scoreMap = new Map<string, { qs: number; accountCounts: number }>();
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    // First, map all scores by date for quick lookup
    rawScores.forEach((score) => {
      if (score.date && score.qs !== undefined) {
        try {
          const dateObj = parse(score.date, "dd.MM.yyyy", new Date());
          const formattedDate = format(dateObj, "yyyy-MM-dd");
          scoreMap.set(formattedDate, {
            qs: score.qs,
            accountCounts: score.accountCount,
          });
        } catch (e) {
          console.warn("Failed to parse date:", score.date, e);
        }
      }
    });

    // Generate data points for the selected time range
    const scores: ScoreData[] = [];
    for (let i = 0; i < timeRange; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const displayDate =
        timeRange <= 364
          ? format(currentDate, "MMM d")
          : format(currentDate, "MMM d, yyyy");

      const qs = (scoreMap.get(dateStr) || { qs: 0, accountCounts: 0 }).qs;
      const accountCounts = (
        scoreMap.get(dateStr) || { qs: 0, accountCounts: 0 }
      ).accountCounts;

      scores.push({
        axisDate: displayDate,
        date: dateStr,
        qs,
        accountCounts,
      });
    }

    return { scores, scoreMap };
  }, [scoresResponse, timeRange]);

  const account = accountData?.data;
  const subAccounts = subAccountData?.data?.subAccounts || [];

  const processedSubAccounts = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);

    return subAccounts.map((account) => {
      const scores = account.scores || [];

      // Filter scores for the selected time range
      const filteredScores = scores.filter((score) => {
        try {
          const scoreDate = parse(score.date, "dd.MM.yyyy", new Date());
          return scoreDate >= startDate && scoreDate <= now;
        } catch (e) {
          console.warn("Invalid date format:", score.date);
          return false;
        }
      });

      // Sort scores by date
      const sortedScores = [...filteredScores].sort(
        (a, b) =>
          new Date(parse(a.date, "dd.MM.yyyy", new Date())).getTime() -
          new Date(parse(b.date, "dd.MM.yyyy", new Date())).getTime(),
      );

      const avgQs =
        sortedScores.length > 0
          ? sortedScores.reduce((sum, score) => sum + (score?.qs || 0), 0) /
          sortedScores.length
          : 0;

      // Calculate QS change if we have at least 2 scores
      let qsChange = 0;
      if (sortedScores.length >= 2) {
        const current = sortedScores[sortedScores.length - 1]?.qs || 0;
        const previous = sortedScores[sortedScores.length - 2]?.qs || 0;
        qsChange = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      }

      return {
        ...account,
        avgQs,
        qsChange,
      };
    });
  }, [subAccounts, timeRange]);

  // Calculate trend
  const trend = useMemo(() => {
    const current = scores?.[scores.length - 1]?.qs || 0;
    const previous = scores?.[scores.length - 2]?.qs || 0;
    return previous && current ? ((current - previous) / previous) * 100 : 0;
  }, [scores]);

  // Calculate average QS from non-zero values only
  const avgQs = (() => {
    const nonZeroScores = scores.filter(score => score.qs > 0);
    return nonZeroScores.length > 0
      ? nonZeroScores.reduce((sum, score) => sum + score.qs, 0) / nonZeroScores.length
      : 0;
  })();

  if (isLoadingAccount || isLoadingScores || isLoadingSubAccounts) {
    return (
      <div
        className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}
      >
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

  if (!account) {
    return (
      <div
        className={`min-h-screen p-6 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
      >
        <div className="max-w-7xl mx-auto">
          <h2
            className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Account not found
          </h2>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Calculate average QS

  // Process sub-accounts with scores and calculate average QS

  // Get bottom 5 sub-accounts by average QS
  const worstAccounts = [...processedSubAccounts]
    .sort((a, b) => a.avgQs - b.avgQs)
    .slice(0, 5);

  // Get top 5 sub-accounts by average QS
  const bestAccounts = [...processedSubAccounts]
    .sort((a, b) => b.avgQs - a.avgQs)
    .slice(0, 5);

  // Dynamic accounts based on toggle state
  const displayedAccounts = showBestAccounts ? bestAccounts : worstAccounts;

  // Filter accounts by search term for Accounts tab
  const filteredSubAccounts = processedSubAccounts.filter(subAccount =>
    accountsSearchTerm.length >= 2 ? subAccount.name.toLowerCase().includes(accountsSearchTerm.toLowerCase()) : true
  );

  // Get the latest score or default to 0
  const latestScore = scores?.[scores.length - 1]?.qs || 0;
  const scoreColor =
    latestScore >= 7
      ? "text-green-600"
      : latestScore >= 4
        ? "text-yellow-600"
        : "text-red-600";



  const getStatusStyle = (status: string): { bg: string; tx: string } => {
    return status === "ENABLED"
      ? { bg: "bg-green-500", tx: "text-green-600" }
      : status === "PAUSED"
        ? { bg: "bg-yellow-500", tx: "text-yellow-600" }
        : { bg: "bg-red-500", tx: "text-red-600" };
  };

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
    <div className={`min-h-screen p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
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
                <span className={`${theme === 'dark' ? 'text-white' : 'text-gray-700'} font-medium`}>
                  {account.name}
                </span>
              </li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1
                  className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {account.name}
                </h1>
                <div className="relative group">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(account.status).bg}`}
                    style={{ marginBottom: "0.25rem" }}
                    title={account.status}
                  ></span>
                  <div
                    className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusStyle(account.status).tx} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                  >
                    {account.status}
                  </div>
                </div>
              </div>
              <p
                className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                Account ID: {account.accountId}
              </p>

              <div
                className={`flex flex-wrap items-center gap-4 text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
              >
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span className={`ml-1 font-semibold ${scoreColor}`}>
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
                  <span className={`font-semibold ${avgQs >= 7 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : avgQs >= 4 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600')}`}>
                    {avgQs.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Accounts: </span>
                  <span className="font-semibold">{subAccounts.length}</span>
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
              onClick={() => setActiveTab("accounts")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === "accounts"
                ? `${theme === 'dark' ? 'border-green-500 text-green-400' : 'border-green-500 text-green-600'}`
                : `${theme === 'dark' ? 'border-transparent text-gray-400 hover:text-green-400 hover:border-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`
                }`}
            >
              Accounts ({subAccounts.length})
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
            {/* Quality Score Trend */}
            <div
              className={`p-6 rounded-lg shadow mb-8 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h3
                  className={`text-lg font-semibold mb-4 sm:mb-0 ${theme === "dark" ? "text-white" : ""}`}
                >
                  Quality Score Trend
                </h3>
                <div className="flex items-center">
                  <span className={`text-sm mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Current:</span>
                  <span className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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

              <div style={{ height: "300px" }}>
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
                      tick={{
                        fontSize: 12,
                        fill: theme === "dark" ? "#9ca3af" : "#4b5563",
                      }}
                      tickLine={false}
                      axisLine={{
                        stroke: theme === "dark" ? "#4b5563" : "#9ca3af",
                        strokeWidth: 1,
                      }}
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
                              className={`space-y-1.5 p-2 rounded-lg border shadow-md ${theme === "dark"
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
                                  className={`text-xs ${theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-500"
                                    }`}
                                >
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
                                <span
                                  className={`text-xs ${theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-600"
                                    }`}
                                >
                                  Accounts:
                                </span>
                                <span
                                  className={`font-medium text-sm ${theme === "dark"
                                    ? "text-white"
                                    : "text-gray-900"
                                    }`}
                                >
                                  {payload[0].payload.accountCounts}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <defs>
                      <linearGradient id="colorQs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset={off} stopColor="#3b82f6" stopOpacity={0.1} />
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
                    <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                    <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Worst 5 Sub Accounts */}
            <div
              className={`p-6 rounded-lg shadow ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3
                    className={`text-lg font-semibold ${theme === "dark" ? "text-white" : ""}`}
                  >
                    {showBestAccounts ? "Best 5 Accounts" : "Worst 5 Accounts"} (by QS)
                  </h3>
                  <button
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200 ${theme === "dark"
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    onClick={() => setShowBestAccounts(!showBestAccounts)}
                    title={`Switch to ${showBestAccounts ? "Worst" : "Best"} 5 Accounts`}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${showBestAccounts ? "rotate-180" : ""}`}
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

              {displayedAccounts.length > 0 ? (
                <div className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 tracking-wider">
                      <thead className={theme === "dark" ? "bg-gray-700" : "bg-gray-50"}>
                        <tr>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 whitespace-nowrap ${theme === "dark" ? "text-gray-300" : "text-gray-500"
                              }`}
                          >
                            Accounts
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-xs font-medium uppercase tracking-wider w-2/3 text-center whitespace-nowrap ${theme === "dark" ? "text-gray-300" : "text-gray-500"
                              }`}
                          >
                            Qs Trends
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 whitespace-nowrap ${theme === "dark" ? "text-gray-300" : "text-gray-500"
                              }`}
                          >
                            Avg QS
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${theme === "dark"
                          ? "divide-gray-700 bg-gray-800"
                          : "divide-gray-200 bg-white"
                          }`}
                      >
                        {displayedAccounts.map((subAccount, index) => (
                          <tr
                            key={subAccount.id}
                            className={`cursor-pointer transition-colors duration-200 h-16 align-top ${theme === "dark"
                              ? "hover:bg-gray-700"
                              : "hover:bg-gray-50"
                              }`}
                            onClick={() =>
                              navigate(`/mcc/${mccId}/sub/${subAccount.id}`)
                            }
                          >
                            <td
                              className={`px-6 py-4 whitespace-nowrap w-1/6 ${index === displayedAccounts.length - 1 && "align-top"}`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm font-medium truncate inline-block max-w-[150px] ${theme === "dark"
                                    ? "text-white"
                                    : "text-gray-900"
                                    }`}
                                  title={subAccount.name}
                                >
                                  {subAccount.name}
                                </span>
                                <div className="relative group">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(subAccount.status).bg}`}
                                    style={{ marginTop: "0.25rem" }}
                                    title={subAccount.status}
                                  ></span>
                                  <div
                                    className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${getStatusStyle(subAccount.status).tx} text-xs rounded px-3 py-2 -mt-8 -ml-2`}
                                  >
                                    {subAccount.status}
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`text-xs ${theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                                  }`}
                              >
                                ID: {subAccount.accountId}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap w-2/3">
                              <div
                                className={`w-full`}
                              >
                                <AccountSparkline
                                  width="100%"
                                  scores={subAccount.scores || []}
                                  timeRange={timeRange}
                                />
                              </div>
                            </td>
                            <td
                              className={`px-6 py-4 whitespace-nowrap w-1/6 ${index === displayedAccounts.length - 1 && "align-top"}`}
                            >
                              <div className="flex items-center">
                                <span
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${subAccount.avgQs >= 7
                                    ? theme === "dark"
                                      ? "bg-green-900 text-green-200"
                                      : "bg-green-100 text-green-800"
                                    : subAccount.avgQs >= 4
                                      ? theme === "dark"
                                        ? "bg-yellow-900 text-yellow-200"
                                        : "bg-yellow-100 text-yellow-800"
                                      : theme === "dark"
                                        ? "bg-red-900 text-red-200"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                >
                                  {subAccount.avgQs.toFixed(1)}
                                </span>
                                {subAccount.qsChange !== 0 && (
                                  <span
                                    className={`ml-2 text-xs ${subAccount.qsChange > 0 ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {subAccount.qsChange > 0 ? "↑" : "↓"}{" "}
                                    {Math.abs(subAccount.qsChange).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  className={`text-center py-4 ${theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                >
                  No {showBestAccounts ? "best" : "worst"} accounts found
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>


            {isLoadingSubAccounts ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-12 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} rounded`}></div>
                  ))}
                </div>
              </div>
            ) : subAccounts.length > 0 ? (
              <div>
                {/* Search Input */}
                <div className={`flex items-center justify-between ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                  <div className={`p-4`}>
                    <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Accounts</h2>
                    <p className={`mt-1 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {subAccounts.length} accounts found
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`relative w-full ${!accountsSearchTerm && "pr-4"}`}>
                      <input
                        name="accountsSearchTerm"
                        type="text"
                        placeholder="Search accounts..."
                        value={accountsSearchTerm}
                        onChange={(e) => setAccountsSearchTerm(e.target.value)}
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
                    {accountsSearchTerm && (
                      <button
                        onClick={() => setAccountsSearchTerm("")}
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

                  {filteredSubAccounts.length > 0 ? (
                    <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-1/6 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                          >
                            Accounts
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 w-2/3 text-center text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}
                          >
                            QS Trends
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
                        {filteredSubAccounts.map((subAccount) => (
                          <tr
                            key={subAccount.id}
                            className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                            onClick={() =>
                              navigate(`/mcc/${mccId}/sub/${subAccount.id}`)
                            }
                          >
                            <td className="px-6 py-4 w-1/6">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium truncate inline-block max-w-[150px] ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`} title={subAccount.name}>
                                  {subAccount.name}
                                </span>
                                <div className="relative group">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${getStatusStyle(subAccount.status).bg}`}
                                    style={{ marginBottom: "0.25rem" }}
                                    title={subAccount.status}
                                  ></span>
                                  <div
                                    className={`cursor-pointer absolute z-10 hidden group-hover:block rounded px-3 py-2 -mt-8 -ml-2 ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-800'} ${getStatusStyle(subAccount.status).tx} text-xs`}
                                  >
                                    {subAccount.status}
                                  </div>
                                </div>
                              </div>
                              <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                ID: {subAccount.accountId}
                              </div>
                            </td>
                            <td className="px-6 py-4 w-2/3 whitespace-nowrap">
                              <div className="w-full min-w-[200px] h-10">
                                <AccountSparkline
                                  scores={subAccount.scores || []}
                                  width="100%"
                                  height={40}
                                  timeRange={timeRange}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                              <div className="flex items-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${subAccount.avgQs >= 7
                                    ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'}`
                                    : subAccount.avgQs >= 4
                                      ? `${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`
                                      : `${theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'}`
                                    }`}
                                >
                                  {subAccount.avgQs.toFixed(1)}/10
                                </span>
                                {subAccount.qsChange !== 0 && (
                                  <span
                                    className={`ml-3 inline-flex items-center text-sm font-medium ${subAccount.qsChange > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                      }`}
                                  >
                                    {subAccount.qsChange > 0 ? "↑" : "↓"}{" "}
                                    {Math.abs(subAccount.qsChange).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={`p-6 text-center italic ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {accountsSearchTerm ? `No accounts found matching "${accountsSearchTerm}"` : "No accounts found"}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`p-6 text-center italic ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No accounts found
              </div>
            )}
          </div>
        )}
      </div>
      <ScrollToTop />
    </div>
  );
};

export default MccAccountPage;
