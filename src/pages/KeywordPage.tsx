import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useKeyword, useKeywordScores, useAdGroupKeywords } from '../services/api';
import KeywordSparkline from '../components/KeywordSparkline';
import { format, parse, startOfWeek } from 'date-fns';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { useTheme } from '../contexts/ThemeProvider';

// Types
interface ChartDataPoint {
  date: string;
  qs: number;
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const { theme } = useTheme();
  const statusConfig = {
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
  }[status] || {
    bg: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    text: theme === 'dark' ? 'text-gray-400' : 'text-gray-800'
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
};

// Skeleton Loader Component
const SkeletonLoader = ({ className = '' }: { className?: string }) => {
  const { theme } = useTheme();
  return <div className={`animate-pulse ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} rounded ${className}`}></div>;
};

const TIME_RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

const KeywordPage: React.FC = () => {

  const navigate = useNavigate();
  const { keywordId } = useParams<{ keywordId: string }>();
  const [timeRange, setTimeRange] = useState(7);
  const { theme } = useTheme();

  // Get adGroupId from URL
  const location = useLocation();
  const adGroupId = location.pathname.split('/')[2];

  // Fetch keyword data
  const { data: keywordData, isLoading: isLoadingKeyword } = useKeyword(keywordId || '');
  const keyword = keywordData?.data;

  // Fetch keywords for the ad group
  const { data: keywordsData, isLoading: isLoadingKeywords } = useAdGroupKeywords(adGroupId, {
    enabled: !!adGroupId
  });
  const keywords = keywordsData?.data?.keywords || [];

  // Fetch keyword scores for the chart
  const { data: scoresData, isLoading: isLoadingScores } = useKeywordScores(keywordId || '', timeRange);

  // Format scores for the chart with dynamic time range
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const scores = scoresData?.data?.scores || [];

    // Create a map of date to score for easy lookup
    const scoreMap = new Map<string, number>();
    scores.forEach(score => {
      const date = format(parse(score.date, 'dd.MM.yyyy', new Date()), 'yyyy-MM-dd');
      scoreMap.set(date, score.qs);
    });

    // Generate date range based on selected timeRange
    const today = new Date();
    const days = timeRange;
    const dateArray = Array.from({ length: days }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (days - 1 - i)); // Go back (days-1) days from today
      return date;
    });




    // For time ranges > 30 days, group by week or month for better readability
    if (timeRange > 30) {
      // Group by week for 30-90 days range
      const weekGroups = new Map<string, { sum: number, count: number }>();

      dateArray.forEach(date => {
        const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const dateStr = format(date, 'yyyy-MM-dd');
        const score = scoreMap.get(dateStr) || 0;

        if (!weekGroups.has(weekStart)) {
          weekGroups.set(weekStart, { sum: 0, count: 0 });
        }
        const week = weekGroups.get(weekStart)!;
        week.sum += score;
        week.count++;
      });

      // Convert week groups to chart data points
      return Array.from(weekGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, { sum, count }]) => {
          const weekDate = new Date(weekStart);
          const displayDate = format(weekDate, timeRange <= 364 ? 'MMM d' : 'MMM d, yyyy');
          return {
            axisDate: displayDate,
            date: weekStart,
            qs: count > 0 ? sum / count : 0 // Weekly average
          };
        });
    } else {
      // For 7-30 days, show daily data
      return dateArray.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, timeRange <= 364 ? 'MMM d' : 'MMM d, yyyy');
        return {
          axisDate: displayDate,
          date: dateStr,
          qs: scoreMap.get(dateStr) || 0
        };
      });
    }
  }, [scoresData, timeRange]);

  useEffect(() => {
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.documentElement.style.overflowX = '';
    };
  }, []);

  if (isLoadingKeyword || !keyword) {
    return (
      <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <SkeletonLoader className="h-8 w-64 mb-4" />
              <SkeletonLoader className="h-6 w-48 mb-8" />
              <SkeletonLoader className="h-4 w-32" />
            </div>
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <SkeletonLoader className="h-6 w-48 mb-4" />
              <SkeletonLoader className="h-64 w-full" />
            </div>
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
              <SkeletonLoader className="h-6 w-48 mb-4" />
              <SkeletonLoader className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const timeRanges = [7, 30, 90, 365];

  // Calculate gradient offset based on data range
  const gradientOffset = () => {
    if (!chartData || chartData.length === 0) return 0.5;

    const vals = chartData.map(d => d.qs).filter(qs => !isNaN(qs));
    if (vals.length === 0) return 0.5;

    const dataMax = Math.max(...vals);
    const dataMin = Math.min(...vals);

    if (dataMax <= 0) return 0;      // All values are low (red)
    if (dataMin >= 0) return 1;      // All values are high (blue)

    // Calculate position of value 7 in the data range
    const range = dataMax - dataMin;
    return dataMax / range;
  };

  const off = gradientOffset();

  // Calculate average QS
  const avgQs = chartData.length > 0
    ? chartData.reduce((sum, data) => sum + data.qs, 0) / chartData.length
    : 0;

  // Get the latest score or default to 0
  const latestScore = chartData?.[chartData.length - 1]?.qs || 0;
  const scoreColor = latestScore >= 7 ? 'text-green-600' : latestScore >= 4 ? 'text-yellow-600' : 'text-red-600';

  // Safely access keyword properties with optional chaining and provide defaults
  const status = keyword?.status || 'UNKNOWN';
  const statusColor = status === 'ENABLED' ? (theme === 'dark' ? 'bg-green-500' : 'bg-green-500') :
    status === 'PAUSED' ? (theme === 'dark' ? 'bg-yellow-500' : 'bg-yellow-500') : (theme === 'dark' ? 'bg-red-500' : 'bg-red-500');
  const statusTooltip = status === 'ENABLED' ? 'Keyword is active' :
    status === 'PAUSED' ? 'Keyword is paused' : 'Status unknown';
  const statusText = status === 'ENABLED' ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') :
    status === 'PAUSED' ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600');

  return (
    <div className={`min-h-screen p-6 ${theme === "light" && "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {keyword?.keyword || 'Keyword'}
                </h1>
                <div className="relative group">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${statusColor}`}
                    style={{ marginBottom: '0.25rem' }}
                    title={statusTooltip}
                  ></span>
                  <div className={`cursor-pointer absolute z-10 hidden group-hover:block ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200'} ${statusText} text-xs rounded px-3 py-2 -mt-8 -ml-2`}>
                    {statusTooltip}
                  </div>
                </div>
              </div>
              {keyword?.id && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Keyword ID: {keyword.id}
                </p>
              )}

              <div className={`flex flex-wrap items-center gap-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span className={`ml-1 font-semibold ${latestScore >= 7 ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : latestScore >= 4 ? (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600') : (theme === 'dark' ? 'text-red-400' : 'text-red-600')}`}>
                    {latestScore.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Average QS: </span>
                  <span className="font-semibold">{avgQs.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QS Trend Chart */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quality Score Trend</h2>
            <div className="inline-flex rounded-md shadow-sm">
              {TIME_RANGES.map((range, index) => (
                <button
                  key={range.days}
                  onClick={() => setTimeRange(range.days)}
                  className={`px-3 py-1 text-sm font-medium transition-colors duration-200 ${timeRange === range.days
                    ? `${theme === 'dark' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`
                    : `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`
                    } ${index === 0 ? 'rounded-l-md' : ''} ${index === TIME_RANGES.length - 1 ? 'rounded-r-md' : ''
                    } border`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {isLoadingScores ? (
              <SkeletonLoader className="h-full w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#374151" : "#f0f0f0"} />
                  <XAxis
                    dataKey="axisDate"
                    tick={{ fontSize: 12, fill: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                    tickLine={false}
                    axisLine={{ stroke: theme === "dark" ? "#4b5563" : "#9ca3af", strokeWidth: 1 }}
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
                                {format(new Date(payload[0].payload.date), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Quality Score</span>
                              <span className={`font-medium text-sm ${qsValue >= 8
                                ? "text-green-600"
                                : qsValue >= 5
                                  ? "text-yellow-600"
                                  : "text-red-600"}`}>
                                {displayQs}
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
            ) : (
              <div className={`h-full flex items-center justify-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No data available for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Ad Group Keywords */}
        <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4`}>Keywords in this Ad Group</h2>
          {isLoadingKeywords ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonLoader key={i} className={`h-12 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`} />
              ))}
            </div>
          ) : (
            keywords.length > 0 ? (
              <div className={`overflow-hidden ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} border rounded-lg`}>
                <div className="overflow-x-auto">
                  <table className={`min-w-full ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                    <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <tr>
                        <th scope="col" className={`px-6 py-4 w-1/6 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider whitespace-nowrap`}>
                          Keyword
                        </th>
                        <th scope="col" className={`px-6 py-4 w-1/2 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider whitespace-nowrap`}>
                          QS Trend
                        </th>
                        <th scope="col" className={`px-6 py-4 w-1/6 text-left text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider whitespace-nowrap`}>
                          Avg QS
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`${theme === 'dark' ? 'bg-gray-800 divide-gray-700' : 'bg-white divide-gray-200'}`}>
                      {keywords.map((kw: any) => (
                        <tr
                          key={kw.id}
                          className={`cursor-pointer transition-colors duration-200 ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} ${kw.id === keywordId ? (theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50') : ''}`}
                          onClick={() => navigate(`/adgroups/${adGroupId}/keywords/${kw.id}`)}
                        >
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{kw.keyword}</div>
                          </td>
                          <td className="px-6 py-4 w-1/2 whitespace-nowrap">
                            <div className="w-full min-w-[200px]">
                              {kw.scores && kw.scores.length > 0 ? (
                                <KeywordSparkline scores={kw.scores} timeRange={timeRange} />
                              ) : (
                                <div className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'} text-sm`}>No data</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            {kw.scores && kw.scores.length > 0 ? (() => {
                              const nonZeroScores = kw.scores.filter((s: any) => s.qs > 0);
                              const avgQs = nonZeroScores.length > 0
                                ? nonZeroScores.reduce((sum: number, s: any) => sum + s.qs, 0) / nonZeroScores.length
                                : 0;

                              return (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${avgQs >= 7 ? (theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800') :
                                    avgQs >= 4 ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800') :
                                      (theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800')
                                  }`}>
                                  {avgQs.toFixed(1)}
                                </span>
                              );
                            })() : (
                              <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm`}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className={`text-center py-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                No keywords found in this ad group
              </div>
            )
          )}
        </div>
      </div>

      {/* QS Trend Chart */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 mb-8`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quality Score Trend</h2>
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((range, index) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`px-3 py-1 text-sm font-medium transition-colors duration-200 ${timeRange === range.days
                  ? `${theme === 'dark' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`
                  : `${theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`
                  } ${index === 0 ? 'rounded-l-md' : ''} ${index === TIME_RANGES.length - 1 ? 'rounded-r-md' : ''
                  } border`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {isLoadingScores ? (
            <SkeletonLoader className="h-full w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#374151" : "#f0f0f0"} />
                <XAxis
                  dataKey="axisDate"
                  tick={{ fontSize: 12, fill: theme === "dark" ? "#9ca3af" : "#6b7280" }}
                  tickLine={false}
                  axisLine={{ stroke: theme === "dark" ? "#4b5563" : "#9ca3af", strokeWidth: 1 }}
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
                              {format(new Date(payload[0].payload.date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Quality Score</span>
                            <span className={`font-medium text-sm ${qsValue >= 8
                              ? "text-green-600"
                              : qsValue >= 5
                                ? "text-yellow-600"
                                : "text-red-600"}`}>
                              {displayQs}
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
          ) : (
            <div className={`h-full flex items-center justify-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              No data available for the selected period
            </div>
          )}
        </div>

        {/* <ScrollToTopButton /> */}
      </div>
    </div>
  );
};

export default KeywordPage;
