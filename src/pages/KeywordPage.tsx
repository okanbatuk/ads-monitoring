import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKeyword, useKeywordScores } from '../services/api';
import { format } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { FiArrowLeft } from 'react-icons/fi';
import { KeywordDto, KeywordScoreDto } from '../types/api.types';

// Types
interface ChartDataPoint {
  date: string;
  qs: number;
}

interface AdData {
  id: string;
  text: string;
  qs: number;
  trend: number;
  scores: { date: string; qs: number }[];
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    ENABLED: { bg: 'bg-green-100', text: 'text-green-800' },
    PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    REMOVED: { bg: 'bg-red-100', text: 'text-red-800' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
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
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}></div>
);

const KeywordPage = () => {
  const { keywordId } = useParams<{ keywordId: string }>();
  const [timeRange, setTimeRange] = useState(30);
  
  // Fetch keyword data
  const { data: keywordData, isLoading: isLoadingKeyword } = useKeyword(keywordId || '');
  const keyword = keywordData?.data;
  const keywordText = keyword?.keyword || 'Keyword';
  
  // Fetch keyword scores for the chart
  const { data: scoresData, isLoading: isLoadingScores } = useKeywordScores(keywordId || '', timeRange);

  // Format scores for the chart
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const scores = Array.isArray(scoresData?.data) ? scoresData.data : [];
    return scores.map((score: KeywordScoreDto) => ({
      date: format(new Date(score.date), 'MMM d'),
      qs: score.qs
    }));
  }, [scoresData]);

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{keyword.keyword}</h1>
            <div className="flex items-center mt-1 text-sm text-gray-500 dark:text-gray-400">
              <Link to={`/adgroups/${keyword.adGroupId}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                Back to Ad Group
              </Link>
            </div>
          </div>
          <StatusBadge status={keyword.status} />
        </div>
        
        {/* Time Range Selector */}
        <div className="mt-6">
          <div className="inline-flex rounded-md shadow-sm">
            {timeRanges.map((days) => {
              const daysStr = days.toString();
              return (
                <button
                  key={daysStr}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 text-sm font-medium ${
                    timeRange === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  } ${days === 7 ? 'rounded-l-md' : ''} ${
                    days === 365 ? 'rounded-r-md' : ''
                  } border border-gray-300 dark:border-gray-600`}
                >
                  {daysStr} days
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* QS Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quality Score Trend</h2>
        <div className="h-64">
          {isLoadingScores ? (
            <SkeletonLoader className="h-full w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="qs"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              No data available for the selected period
            </div>
          )}
        </div>
      </div>

      {/* Mini Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { name: 'Impressions', value: '0' },
          { name: 'Clicks', value: '0' },
          { name: 'CTR', value: '0%' },
          { name: 'Conversions', value: '0' },
        ].map((metric, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.name}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{metric.value}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default KeywordPage;
