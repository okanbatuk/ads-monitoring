import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CampaignSparkline from '../components/CampaignSparkline';
import {
  useAccount,
  useAccountScores,
  useAccountCampaigns,
  useMccAccounts
} from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import type {
  AccountDto,
  CampaignDto,
  CampaignScoreDto
} from '../types/api.types';

// Import CSS for styling
import './MccSubAccountPage.css';

// Custom icons as React components
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

// ... (other icon components remain the same)

// StatusBadge component
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

// Status color mapping
const statusColors = {
  ENABLED: 'status-enabled',
  PAUSED: 'status-paused',
  REMOVED: 'status-removed',
  UNKNOWN: 'status-unknown'
} as const;

// Helper component for loading skeleton
const Skeleton = ({ width = '100%', height = '1rem', className = '' }) => (
  <div
    className={`bg-gray-200 animate-pulse rounded ${className}`}
    style={{ width, height }}
  />
);

// Helper function to get quality score color class
const getQualityScoreColorClass = (score: number): string => {
  if (score >= 7) return 'text-green-600';
  if (score >= 5) return 'text-yellow-600';
  return 'text-red-600';
};

// Quality Score Chart Component
const QualityScoreChart = ({ scores, timeRange }: { scores: any[], timeRange: number }) => {
  // Filter scores based on the selected time range
  const filteredScores = React.useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    return scores.filter(score => new Date(score.date) >= cutoffDate);
  }, [scores, timeRange]);

  // Format date for display
  const formatXAxis = (date: string) => {
    return new Date(date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Last {timeRange} Day Quality Score</h3>
        <div className="flex space-x-2">
          {[7, 30, 90, 365].map((days) => (
            <button
              key={days}
              onClick={() => { }}
              className={`px-3 py-1 text-sm rounded-md ${timeRange === days ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredScores}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              domain={[0, 10]}
              tickCount={11}
              tick={{ fontSize: 12 }}
              width={30}
            />
            <Tooltip
              labelFormatter={(value) => `Tarih: ${new Date(value).toLocaleDateString('tr-TR')}`}
              formatter={(value) => [`${value}`, 'Kalite Skoru']}
              labelStyle={{ color: '#4b5563' }}
            />
            <Line
              type="monotone"
              dataKey="qs"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0 }}
              name="Kalite Skoru"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Helper component for buttons
interface ButtonProps {
  children: React.ReactNode;
  onClick?: (() => void | Promise<void>) | (() => Promise<any>);
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  leftIcon,
  rightIcon,
  fullWidth = false,
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    ghost: 'hover:bg-gray-100 text-gray-700',
  } as const;

  const sizeMapping = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 py-2 px-4',
    lg: 'h-11 px-8 text-lg',
    small: 'h-9 px-3 text-sm',
    medium: 'h-10 py-2 px-4',
    large: 'h-11 px-8 text-lg',
  } as const;

  const sizeClass = sizeMapping[size] || sizeMapping.medium;
  const variantClass = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantClass} ${sizeClass} ${fullWidth ? 'w-full' : ''
        } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

// Main container component
const Container = ({ children, className = '', size = 'xl' }: { children: React.ReactNode, className?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const maxWidth = {
    sm: 'max-w-3xl',
    md: 'max-w-4xl',
    lg: 'max-w-5xl',
    xl: 'max-w-[1280px]',
  }[size];

  return (
    <div className={`container ${className}`}>
      {children}
    </div>
  );
};

interface MccSubAccountPageProps { }

export const MccSubAccountPage: React.FC<MccSubAccountPageProps> = () => {
  const { subAccountId } = useParams<{ subAccountId: string }>();
  const accountId = subAccountId; // Keep using accountId in the rest of the component for consistency
  const navigate = useNavigate();
  const location = useLocation();
  const [timeRange, setTimeRange] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns'>('overview');


  const {
    data: accountResponse,
    isLoading: isLoadingAccount,
    isError: isErrorAccount,
    error: accountError,
    refetch: refetchAccount
  } = useAccount(accountId || '');

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
    refetch: refetchScores
  } = useAccountScores(accountId || '', timeRange);

  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    isError: isErrorCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns
  } = useAccountCampaigns(accountId || '');

  const account = accountResponse?.data;
  const scores = scoresResponse?.data?.scores || [];
  // Ensure campaigns have a scores array and handle potential undefined values
  const campaigns = (campaignsResponse?.data?.campaigns || []).map(campaign => ({
    ...campaign,
    scores: Array.isArray(campaign.scores) ? campaign.scores : []
  }));
  const campaignCount = campaignsResponse?.data?.total || 0;

  // Get last 5 campaigns for the overview with their scores
  const recentCampaigns = useMemo(() => {
    return campaigns.slice(0, 5).map(campaign => ({
      ...campaign,
      // Make sure we have an array of scores
      scores: Array.isArray(campaign.scores) ? campaign.scores : []
    }));
  }, [campaigns]);

  // Calculate current score and trend
  const { currentScore, trend } = useMemo(() => {
    if (!scores?.length) return { currentScore: 0, trend: 0 };

    // Sort scores by date in descending order
    const sortedScores = [...scores].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const current = sortedScores[0]?.qs || 0;
    const previous = sortedScores[1]?.qs || 0;
    const trend = current - previous;

    return {
      currentScore: current,
      trend: trend,
    };
  }, [scores]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([
        refetchAccount(),
        refetchScores(),
        refetchCampaigns()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTimeRangeChange = (days: number) => {
    setTimeRange(days);
  };

  // Show loading state if any data is still loading
  if (isLoadingAccount || isLoadingScores || isLoadingCampaigns) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading account data...</p>
        </div>
      </div>
    );
  }

  // Show error state if any error occurred
  if (isErrorAccount || isErrorScores || isErrorCampaigns) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 rounded-lg">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Data</h2>
          <p className="text-red-600 mb-4">
            {accountError?.message || scoresError?.message || campaignsError?.message || 'Unknown error occurred'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto p-6">

        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow">
            <Container className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {isLoadingAccount ? (
                      <Skeleton width="200px" height="32px" />
                    ) : (
                      account?.name || 'Loading...'
                    )}
                  </h1>
                  {account?.status && (
                    <StatusBadge status={account.status} />
                  )}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshIcon />
                  <span className="ml-2">Refresh</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px space-x-8">
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
                    onClick={() => {
                      setActiveTab('campaigns');
                    }}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'campaigns'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Campaigns ({campaignCount})
                  </button>
                </nav>
              </div>
            </Container>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' ? (
            <>
              {/* Quality Score Overview */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4">Quality Score Trend</h2>
                <div className="space-y-6">
                  <QualityScoreChart scores={scores} timeRange={timeRange} />
                </div>
              </div>
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Top Campaigns (by QS)</h2>
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {recentCampaigns.map((campaign) => {
                      const latestScore = campaign.scores?.length > 0 ? campaign.scores[0].qs : 0;
                      const previousScore = campaign.scores?.length > 1 ? campaign.scores[1].qs : latestScore;
                      const trend = latestScore - previousScore;
                      const trendPercentage = previousScore ? ((latestScore - previousScore) / previousScore) * 100 : 0;

                      return (
                        <div
                          key={campaign.id}
                          className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/campaigns/${campaign.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3">
                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                  {campaign.name}
                                </h3>
                                <StatusBadge status={campaign.status} />
                              </div>
                              <p className="text-xs text-gray-500 mt-1">ID: {campaign.id}</p>
                            </div>
                            <div className="ml-4 flex-shrink-0">
                              <div className="text-sm font-medium text-gray-900">
                                {latestScore.toFixed(1)}/10
                              </div>
                              {!isNaN(trendPercentage) && (
                                <div className={`text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center justify-end`}>
                                  {trend >= 0 ? (
                                    <FiArrowUpRight className="mr-1" />
                                  ) : (
                                    <FiArrowDownRight className="mr-1" />
                                  )}
                                  {Math.abs(trendPercentage).toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 h-10 w-full">
                            <CampaignSparkline 
                              scores={campaign.scores || []} 
                              width="100%"
                              height={40}
                              showTrend={false}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Campaigns</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {campaigns.length} campaigns found
                </p>
              </div>
              {campaigns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 w-1/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign Name
                        </th>
                        <th scope="col" className="px-6 py-3 w-3/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          QS Trend
                        </th>
                        <th scope="col" className="px-6 py-3 w-1/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current QS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {campaigns.map((campaign) => {
                        const scores = campaign.scores || [];
                        const latestScore = scores.length > 0 ? scores[0].qs : 0;
                        const previousScore = scores.length > 1 ? scores[1].qs : latestScore;
                        const trend = latestScore - previousScore;
                        const trendPercentage = previousScore ? (trend / previousScore) * 100 : 0;
                        return (
                          <tr 
                            key={campaign.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/campaigns/${campaign.id}`)}
                          >
                            <td className="px-6 py-4 w-1/5 whitespace-nowrap">
                              <div className="flex gap-2 items-center text-sm font-medium text-gray-900">
                                {campaign.name}
                              <StatusBadge status={campaign.status} />
                              </div>
                              <div className="text-xs text-gray-500 p-1">ID: {campaign.id}</div>
                            </td>
                            <td className="px-6 py-4 w-3/5 whitespace-nowrap">
                              <div className="w-full min-w-[200px]">
                                <CampaignSparkline 
                                  scores={scores} 
                                  width="100%"
                                  height={40}
                                  showTrend={false}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/5 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                  ${latestScore >= 7 ? 'bg-green-100 text-green-800' :
                                    latestScore >= 4 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'}`}>
                                  {latestScore.toFixed(1)}
                                </span>
                                {!isNaN(trendPercentage) && trendPercentage !== 0 && (
                                  <span className={`ml-2 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
                                    {trend >= 0 ? (
                                      <FiArrowUpRight className="mr-0.5" size={14} />
                                    ) : (
                                      <FiArrowDownRight className="mr-0.5" size={14} />
                                    )}
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
                <div className="text-center py-12 bg-white rounded-lg shadow">
                  <p className="text-gray-500">No campaigns found for this account.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MccSubAccountPage;
