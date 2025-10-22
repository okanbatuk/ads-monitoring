import React, { useState, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useKeyword, useKeywordScores, useAdGroupKeywords } from '../services/api';
import KeywordSparkline from '../components/KeywordSparkline';
import { format, parse, startOfWeek, addDays, subDays, isWithinInterval } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { FiArrowLeft } from 'react-icons/fi';
import { KeywordDto, KeywordScoreDto } from '../types/api.types';
import ScrollToTop from '@/components/ScrollToTop';

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

// Sparkline Component
const Sparkline = ({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) => {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="text-blue-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
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
  const keywordText = keyword?.keyword || 'Keyword';

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
      const weekGroups = new Map<string, {sum: number, count: number}>();
      
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
        .map(([weekStart, { sum, count }]) => ({
          date: format(new Date(weekStart), 'MMM d'),
          qs: count > 0 ? sum / count : 0 // Weekly average
        }));
    } else {
      // For 7-30 days, show daily data
      return dateArray.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, timeRange <= 14 ? 'MMM d' : 'd MMM');
        return {
          date: displayDate,
          qs: scoreMap.get(dateStr) || 0
        };
      });
    }
  }, [scoresData, timeRange]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div className='flex items-center gap-2'>
            <h1 className="text-2xl font-bold text-gray-900">{keyword.keyword}</h1>
            <StatusBadge status={keyword.status} />
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
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  domain={[0, 10]} 
                  tickCount={6}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
                          <p className="font-medium">{payload[0].payload.date}</p>
                          <p className="text-sm">
                            <span className="text-gray-600">Quality Score:</span>{' '}
                            <span className="font-semibold">{payload[0].value?.toFixed(1)}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="qs"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#3b82f6',
                    stroke: '#fff',
                    strokeWidth: 2
                  }}
                />
                <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="3 3" />
              </LineChart>
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            avgQs >= 7 ? 'bg-green-100 text-green-800' :
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

      <ScrollToTop />
    </div>
  );
};

export default KeywordPage;
