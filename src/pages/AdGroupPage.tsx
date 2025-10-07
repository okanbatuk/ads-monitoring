import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdGroup, useAdGroupScores, useAdGroupKeywords } from '../services/api';
import KeywordSparkline from '../components/KeywordSparkline';
import { KeywordDto } from '@/types/api.types';

// Skeleton Loader Component
const SkeletonLoader = ({ className = '', count = 1 }: { className?: string; count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse bg-gray-200 rounded ${className}`}
      />
    ))}
  </>
);

const TIME_RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

const QS_COLORS = {
  '1-3': '#ef4444',    // Red
  '4-6': '#f59e0b',    // Amber
  '7-8': '#10b981',    // Emerald
  '9-10': '#3b82f6',   // Blue
};

const getColorForScore = (score: number) => {
  if (score >= 9) return QS_COLORS['9-10'];
  if (score >= 7) return QS_COLORS['7-8'];
  if (score >= 4) return QS_COLORS['4-6'];
  return QS_COLORS['1-3'];
};

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

const AdGroupPage: React.FC = () => {
  const { adGroupId } = useParams<{ adGroupId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords'>('overview');
  const [timeRange, setTimeRange] = useState(30);
  const {
    data: adGroupResponse,
    isLoading: isLoadingAdGroup,
    isError: isErrorAdGroup,
    error: adGroupError
  } = useAdGroup(adGroupId!);

  const {
    data: scoresData,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError
  } = useAdGroupScores(adGroupId!, timeRange);

    // State to track if keywords have been requested
  const [keywordsRequested, setKeywordsRequested] = useState(false);

  // Fetch keywords only when the keywords tab is active and keywords have been requested
  const {
    data: keywordsData,
    isLoading: isLoadingKeywords,
    isError: isErrorKeywords,
    error: keywordsError,
    refetch: refetchKeywords
  } = useAdGroupKeywords(adGroupId!, {
    enabled: activeTab === 'keywords' && keywordsRequested
  });

  const isLoading = isLoadingAdGroup || isLoadingScores || (activeTab === 'keywords' && isLoadingKeywords);
  const isError = isErrorAdGroup || isErrorScores || (activeTab === 'keywords' && isErrorKeywords);
  const error = adGroupError || scoresError || (activeTab === 'keywords' ? keywordsError : null);

  // Handle keywords tab click
  const handleKeywordsTabClick = () => {
    setActiveTab('keywords');
    if (!keywordsRequested) {
      setKeywordsRequested(true);
      refetchKeywords();
    }
  };

  // Get bottom 5 keywords by average QS
  const bottomKeywords = useMemo(() => {
    if (!keywordsData?.data?.keywords) return [];

    return [...keywordsData.data.keywords]
      .filter(k => k.scores && k.scores.length > 0)
      .map(keyword => ({
        ...keyword,
        avgQs: keyword.scores!.reduce((sum, s) => sum + s.qs, 0) / keyword.scores!.length
      }))
      .sort((a, b) => a.avgQs - b.avgQs)
      .slice(0, 5);
  }, [keywordsData]);

  const adGroup = adGroupResponse?.data;
  const scores = scoresData?.data?.scores || [];
  const keywords = keywordsData?.data?.keywords || [];
  const totalKeywords = keywordsData?.data?.total || 0;

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full p-6">
        <div className="container mx-auto">
          {/* Header Skeleton */}
          <div className="mb-8">
            <SkeletonLoader className="h-8 w-64 mb-4" />
            <SkeletonLoader className="h-4 w-48" />
          </div>

          {/* Tabs Skeleton */}
          <div className="flex space-x-8 border-b border-gray-200 mb-6">
            <SkeletonLoader className="h-12 w-24" />
            <SkeletonLoader className="h-12 w-24" />
          </div>

          {/* Time Range Skeleton */}
          <div className="flex justify-end mb-6">
            <SkeletonLoader className="h-10 w-96" />
          </div>

          {/* Content Skeleton */}
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              <SkeletonLoader className="h-64 w-full rounded-lg" />
              <SkeletonLoader className="h-64 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-4">
              <SkeletonLoader className="h-12 w-full" count={5} />
            </div>
          )}
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
    <div className="w-full">
      <div className="container mx-auto p-6">
        {/* Header with breadcrumb */}
        <div className="mb-6">
          {/* <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li>
                <Link to="/" className="text-blue-600 hover:underline">Accounts</Link>
              </li>
              <li className="flex items-center">
                <span className="mx-2 text-gray-400">/</span>
                <Link to={`/accounts/${}/campaigns/${adGroup?.campaignId}`} className="text-blue-600 hover:underline">
                  Campaign
                </Link>
              </li>
              <li className="flex items-center">
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-gray-700">{adGroup?.name}</span>
              </li>
            </ol>
          </nav> */}

          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">{adGroup?.name}</h1>
              {adGroup?.status && <StatusBadge status={adGroup.status} />}
            </div>

          </div>
          <div className="text-sm text-gray-600">
            <span>ID: {adGroup?.id}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Overview
            </button>
            <button
              onClick={handleKeywordsTabClick}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'keywords'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Keywords
            </button>
          </nav>
        </div>

        {/* Time Range Selector */}
        <div className="flex justify-end">
          <div className="inline-flex rounded-md shadow-sm">
            {TIME_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setTimeRange(range.days)}
                className={`px-4 py-2 text-sm font-medium ${timeRange === range.days
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } border ${range.days === 7 ? 'rounded-l-md' : ''} ${range.days === 365 ? 'rounded-r-md' : ''
                  }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {/* QS Gantt Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quality Score Trend</h2>
              <div className="h-12 flex items-center">
                {scores.length > 0 ? (
                  <div className="w-full flex space-x-1">
                    {scores.map((score) => (
                      <div
                        key={score.date}
                        title={`${new Date(score.date).toLocaleDateString()}: QS ${score.qs.toFixed(1)}`}
                        className="h-8 flex-1 group relative"
                      >
                        <div
                          className="h-full w-full rounded-sm"
                          style={{
                            backgroundColor: getColorForScore(score.qs),
                            opacity: 0.7,
                            transition: 'opacity 0.2s',
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-medium text-white bg-black bg-opacity-70 px-1 rounded">
                            {score.qs.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center w-full">
                    {isLoadingScores ? (
                      <SkeletonLoader className="h-6 w-48 mx-auto" />
                    ) : (
                      'No score data available'
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom 5 Keywords */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Bottom 5 Keywords (by QS)</h2>
              {bottomKeywords.length > 0 ? (
                <div className="space-y-4">
                  {bottomKeywords.map((keyword) => (
                    <div key={keyword.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{keyword.keyword}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-24">
                          <KeywordSparkline scores={keyword.scores || []} />
                        </div>
                        <div className="w-12 text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${keyword.avgQs >= 7 ? 'bg-green-100 text-green-800' :
                            keyword.avgQs >= 4 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                            {keyword.avgQs.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {isLoadingKeywords ? (
                    <SkeletonLoader className="h-6 w-48 mx-auto" />
                  ) : (
                    'No keyword data available'
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Keywords</h2>
              <p className="mt-1 text-sm text-gray-500">
                {isLoadingKeywords ? 'Loading...' : `${keywordsData?.data?.keywords?.length || 0} keywords found`}
              </p>
            </div>

            {isLoadingKeywords ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            ) : keywordsData?.data?.keywords && keywordsData.data.keywords.length > 0 ? (
              <div className="overflow-x-auto">
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
                        Current QS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {keywordsData?.data?.keywords?.map((keyword: KeywordDto) => {
                      const scores = keyword.scores || [];
                      const latestScore = scores.length > 0 ? scores[0] : null;

                      return (
                        <tr
                          key={keyword.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/adgroups/${adGroupId}/keywords/${keyword.id}`)}
                        >
                          <td className="px-6 py-4 w-1/4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {keyword.keyword}
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <StatusBadge status={keyword.status || 'UNKNOWN'} />
                          </td>
                          <td className="px-6 py-4 w-2/5 whitespace-nowrap">
                            <div className="w-full min-w-[200px]">
                              <KeywordSparkline scores={scores} />
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            {latestScore ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${latestScore.qs >= 7 ? 'bg-green-100 text-green-800' :
                                  latestScore.qs >= 4 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                {latestScore.qs?.toFixed?.(1) || 'N/A'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No keywords found for this ad group.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
};

export default AdGroupPage;
