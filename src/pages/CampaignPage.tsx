import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCampaign, useCampaignScores, useCampaignAdGroups } from '../services';
import { CampaignDto, CampaignScoreDto } from '../types/api.types';

// Skeleton Loader Component
const SkeletonLoader = ({ className = '', count = 1 }: { className?: string; count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`animate-pulse bg-gray-200 rounded ${className}`} />
    ))}
  </>
);

const TIME_RANGES = [7, 30, 90, 365];

// Badge component for status display
const StatusBadge = ({ status }: { status: string }) => {
  const statusMap: Record<string, { bg: string; text: string }> = {
    ENABLED: { bg: 'bg-green-100', text: 'text-green-800' },
    PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    REMOVED: { bg: 'bg-red-100', text: 'text-red-800' },
  };

  const statusStyle = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
      {status}
    </span>
  );
};

// Extend the CampaignDto to include metrics
interface CampaignWithMetrics extends CampaignDto {
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
  };
}

// Define chart data type
interface ChartDataPoint {
  date: string;
  qs: number;
}

const CampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'adgroups'>('overview');

  const {
    data: campaignResponse,
    isLoading: isLoadingCampaign,
    isError: isErrorCampaign,
    error: campaignError
  } = useCampaign(campaignId || '');

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError
  } = useCampaignScores(campaignId || '', timeRange);

  const {
    data: adGroupsResponse,
    isLoading: isLoadingAdGroups,
    isError: isErrorAdGroups,
    error: adGroupsError,
    refetch: refetchAdGroups
  } = useCampaignAdGroups(campaignId || '');

  const isLoading = isLoadingCampaign || isLoadingScores || (activeTab === 'adgroups' && isLoadingAdGroups);
  const isError = isErrorCampaign || isErrorScores || (activeTab === 'adgroups' && isErrorAdGroups);
  const error = campaignError || scoresError || (activeTab === 'adgroups' ? adGroupsError : null);

  const campaign = campaignResponse?.data as CampaignWithMetrics | undefined;
  const scoresData = scoresResponse?.data?.scores || [];
  const adGroupsData = adGroupsResponse?.data?.adGroups || [];
  const adGroupCount = adGroupsResponse?.data?.total || 0;

  // Calculate current quality score and trend from scores data
  const { currentScore, trend } = useMemo(() => {
    if (!scoresData?.length) return { currentScore: 0, trend: 0 };

    // Sort scores by date in descending order
    const sortedScores = [...scoresData].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const current = sortedScores[0]?.qs || 0;
    const previous = sortedScores[1]?.qs || 0;

    // Calculate trend percentage (0 if no previous data)
    const trend = previous && current ? ((current - previous) / previous) * 100 : 0;

    return {
      currentScore: current,
      trend: parseFloat(trend.toFixed(1))
    };
  }, [scoresData]);

  // Format scores data for charts
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!scoresData?.length) return [];

    // Sort by date to ensure chronological order
    const sortedScores = [...scoresData].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sortedScores.map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      qs: item.qs || 0
    }));
  }, [scoresData]);

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
          <h2 className="text-lg font-medium text-red-800">Error loading data</h2>
          <p className="text-red-700 mt-1">{error?.message || 'An unknown error occurred'}</p>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <div className='flex items-center gap-3'>
              <h1 className="text-2xl font-bold text-gray-900">{campaign?.name || 'Campaign'}</h1>
              <StatusBadge status={campaign?.status || 'UNKNOWN'} />
            </div>
            <div>

              <p className="text-sm text-gray-500 mt-1">
                Campaign ID: {campaignId}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab('adgroups');
                refetchAdGroups();
              }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'adgroups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Ad Groups ({adGroupCount})
            </button>
          </nav>
        </div>

        {/* Date Range Selector */}
        <div className="flex justify-end items-center mb-6">
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 text-sm font-medium ${timeRange === days
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

        {activeTab === 'overview' ? (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Quality Score Trend</h2>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Current:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {currentScore.toFixed(1)}
                </span>
                {trend !== 0 && (
                  <span className={`ml-2 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tickCount={6}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="qs"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No data available for the selected period
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200">
              {adGroupsData.length > 0 ? (
                adGroupsData.map((adGroup) => (
                  <div
                    key={adGroup.id}
                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/adgroups/${adGroup.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{adGroup.name}</h3>
                        <p className="text-sm text-gray-500">ID: {adGroup.id}</p>
                      </div>
                      <div className="flex items-center">
                        <StatusBadge status={adGroup.status} />
                        <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-4 text-center text-gray-500">
                  No ad groups found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignPage;
