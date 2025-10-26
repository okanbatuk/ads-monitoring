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
  const [timeRange, setTimeRange] = useState(7);
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
        const firstQs = sortedScores[0]?.qs || 0;
        const lastQs = sortedScores[sortedScores.length - 1]?.qs || 0;
        qsChange = firstQs !== 0 ? ((lastQs - firstQs) / firstQs) * 100 : 0;
      }

      return {
        ...account,
        avgQs,
        qsChange,
      };
    });
  }, [subAccounts, timeRange]);

  if (isLoadingAccount || isLoadingScores || isLoadingSubAccounts) {
    return (
      <div
        className={`min-h-screen p-6 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}
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
  const bottomAccounts = [...processedSubAccounts]
    .sort((a, b) => a.avgQs - b.avgQs)
    .slice(0, 5);

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
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Sub Accounts: </span>
                  <span className="font-semibold">{subAccounts.length}</span>
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
              className={`text-lg font-semibold mb-4 sm:mb-0 ${theme === "dark" ? "text-white" : ""}`}
            >
              Quality Score Trend
            </h3>
            <div className="inline-flex rounded-md shadow-sm" role="group">
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
                              className={`text-xs ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                              }`}
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
                              className={`text-xs ${
                                theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-600"
                              }`}
                            >
                              Accounts:
                            </span>
                            <span
                              className={`font-medium text-sm ${
                                theme === "dark"
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
                  dot={false}
                  activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2 }}
                />
                <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom 5 Sub Accounts */}
        <div
          className={`p-6 rounded-lg shadow ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-lg font-semibold ${theme === "dark" ? "text-white" : ""}`}
            >
              Bottom 5 Sub Accounts
            </h3>
          </div>

          {bottomAccounts.length > 0 ? (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 tracking-wider">
                  <thead className={theme === "dark" ? "bg-gray-700" : "bg-gray-50"}>
                    <tr>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 whitespace-nowrap ${
                          theme === "dark" ? "text-gray-300" : "text-gray-500"
                        }`}
                      >
                        Sub Account
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-xs font-medium uppercase tracking-wider w-2/3 text-center whitespace-nowrap ${
                          theme === "dark" ? "text-gray-300" : "text-gray-500"
                        }`}
                      >
                        Qs Trend
                      </th>
                      <th
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider w-1/6 whitespace-nowrap ${
                          theme === "dark" ? "text-gray-300" : "text-gray-500"
                        }`}
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
                    {bottomAccounts.map((subAccount, index) => (
                      <tr
                        key={subAccount.id}
                        className={`cursor-pointer transition-colors duration-200 ${
                          theme === "dark"
                            ? "hover:bg-gray-700"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() =>
                          navigate(`/mcc/${mccId}/sub/${subAccount.id}`)
                        }
                      >
                        <td
                          className={`px-6 py-4 whitespace-nowrap w-1/6 ${index === bottomAccounts.length - 1 && "align-top"}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                theme === "dark"
                                  ? "text-white"
                                  : "text-gray-900"
                              }`}
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
                            className={`text-xs ${
                              theme === "dark"
                                ? "text-gray-400"
                                : "text-gray-500"
                            }`}
                          >
                            {subAccount.accountId}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap w-2/3">
                          <div
                            className={`w-full ${
                              index === bottomAccounts.length - 1
                                ? "h-24"
                                : "h-10"
                            }`}
                          >
                            <AccountSparkline
                              width={850}
                              scores={subAccount.scores || []}
                              timeRange={timeRange}
                            />
                          </div>
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap w-1/6 ${index === bottomAccounts.length - 1 && "align-top"}`}
                        >
                          <div className="flex items-center">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                subAccount.avgQs >= 7
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
              className={`text-center py-4 ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
            >
              No sub accounts found
            </div>
          )}
        </div>
      </div>
      <ScrollToTop />
    </div>
  );
};

export default MccAccountPage;
