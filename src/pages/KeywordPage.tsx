import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useKeyword, useKeywordScores, useAdGroupKeywords } from '../services/api';
import KeywordSparkline from '../components/KeywordSparkline';
import { format, parse, startOfWeek } from 'date-fns';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area} from 'recharts';

// Types
interface ChartDataPoint {
  date: string;
  qs: number;
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    ENABLED: { bg: 'bg-green-100', text: 'text-green-800' },
    PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    REMOVED: { bg: 'bg-red-100', text: 'text-red-800' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span className={`inline-flex items-center px-1.5 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
};

// Skeleton Loader Component
const SkeletonLoader = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

const KeywordPage: React.FC = () => {

  const navigate = useNavigate();
  const { keywordId } = useParams<{ keywordId: string }>();
  const [timeRange, setTimeRange] = useState(7);

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
      <div className="p-6">
        <SkeletonLoader className="h-8 w-64 mb-4" />
        <SkeletonLoader className="h-6 w-48 mb-8" />
        <SkeletonLoader className="h-64 w-full mb-8" />
        <SkeletonLoader className="h-32 w-full mb-8" />
        <SkeletonLoader className="h-64 w-full" />
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
  const statusColor = status === 'ENABLED' ? 'bg-green-500' :
    status === 'PAUSED' ? 'bg-yellow-500' : 'bg-red-500';
  const statusTooltip = status === 'ENABLED' ? 'Keyword is active' :
    status === 'PAUSED' ? 'Keyword is paused' : 'Status unknown';
  const statusText = status === 'ENABLED' ? 'text-green-600' :
    status === 'PAUSED' ? 'text-yellow-600' : 'text-gray-600';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {keyword?.keyword || 'Keyword'}
                </h1>
                <div className="relative group">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${statusColor}`}
                    style={{ marginBottom: '0.25rem' }}
                    title={statusTooltip}
                  ></span>
                  <div className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${statusText} text-xs rounded px-3 py-2 -mt-8 -ml-2`}>
                    {statusTooltip}
                  </div>
                </div>
              </div>
              {keyword?.id && (
                <p className="text-sm text-gray-500 mt-1">
                  Keyword ID: {keyword.id}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span className={`ml-1 font-semibold ${scoreColor}`}>
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
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Quality Score Trend</h2>
            <div className="inline-flex rounded-md shadow-sm">
              {[7, 30, 90, 365].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1 text-sm font-medium ${timeRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    } ${days === 7 ? 'rounded-l-md' : ''} ${days === 365 ? 'rounded-r-md' : ''
                    } border border-gray-300`}
                >
                  {days}d
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="axisDate"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                    tickMargin={10}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tickCount={6}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
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
                                {format(new Date(payload[0].payload.date), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between space-x-4">
                              <span className="text-gray-500 text-xs">Quality Score</span>
                              <span className={`font-medium text-sm ${qsValue >= 8 
                                ? 'text-green-600' 
                                : qsValue >= 5 
                                  ? 'text-yellow-600' 
                                  : 'text-red-600'}`}>
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
                      <stop offset="0" stopColor="#93c5fd" stopOpacity={1} />
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
                    activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
                  />
                  <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available for the selected period
              </div>
            )}
          </div>
        </div>

        {/* Ad Group Keywords */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Keywords in this Ad Group</h2>
          {isLoadingKeywords ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonLoader key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : keywords.length > 0 ? (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 w-1/4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Keyword
                    </th>
                    <th scope="col" className="px-6 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 w-2/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QS Trend
                    </th>
                    <th scope="col" className="px-6 py-3 w-1/6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg QS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keywords.map((kw: any) => (
                    <tr
                      key={kw.id}
                      className={`hover:bg-gray-50 cursor-pointer ${kw.id === keywordId ? 'bg-blue-50' : ''}`}
                      onClick={() => navigate(`/adgroups/${adGroupId}/keywords/${kw.id}`)}
                    >
                      <td className="px-6 py-4 w-1/4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{kw.keyword}</div>
                      </td>
                      <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                        <StatusBadge status={kw.status} />
                      </td>
                      <td className="px-6 py-4 w-2/5 whitespace-nowrap">
                        <div className="w-full min-w-[200px]">
                          {kw.scores && kw.scores.length > 0 ? (
                            <KeywordSparkline scores={kw.scores} timeRange={timeRange} />
                          ) : (
                            <div className="text-gray-400 text-sm">No data</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                        {kw.scores && kw.scores.length > 0 ? (() => {
                          // Calculate average QS from non-zero scores
                          const nonZeroScores = kw.scores.filter((s: any) => s.qs > 0);
                          const avgQs = nonZeroScores.length > 0
                            ? nonZeroScores.reduce((sum: number, s: any) => sum + s.qs, 0) / nonZeroScores.length
                            : 0;

                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${avgQs >= 7 ? 'bg-green-100 text-green-800' :
                                avgQs >= 4 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                              }`}>
                              {avgQs.toFixed(1)}
                            </span>
                          );
                        })() : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No keywords found in this ad group
            </div>
          )}
        </div>

        {/* <ScrollToTopButton /> */}
      </div>
    </div>
  );
};

export default KeywordPage;
