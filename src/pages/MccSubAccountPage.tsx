import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  useAccount,
  useAccountScores,
  useAccountCampaigns,
  useMccAccounts
} from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
      <h3 className="text-lg font-medium mb-4">Son {timeRange} Günlük Kalite Skoru</h3>
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
  const location = useLocation();
  const navigate = useNavigate();

  // State for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [timeRange, setTimeRange] = useState(30); // Default to 30 days

  // Format date helper function
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Fetch account data
  const {
    data: accountResponse,
    isLoading: isLoadingAccount,
    error: accountError,
    isError: isAccountError,
    refetch: refetchAccount
  } = useAccount(subAccountId || '');
  const account = accountResponse?.data;
  const displayAccountId = account?.id || subAccountId || 'N/A';
  const accountName = account?.name || 'N/A';
  const status = account?.status || 'UNKNOWN';

  // Fetch account scores
  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    refetch: refetchScores
  } = useAccountScores(subAccountId || '', 30);
  const scoresData = scoresResponse?.data?.scores || [];

  // Fetch account campaigns
  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    refetch: refetchCampaigns
  } = useAccountCampaigns(subAccountId || '');
  const campaignsData = campaignsResponse?.data?.campaigns || [];

  // Calculate current score and trend
  const currentScore = scoresData.length > 0 ? scoresData[0].qs : 0;
  const trend = scoresData.length > 1
    ? ((scoresData[0].qs - scoresData[scoresData.length - 1].qs) / scoresData[scoresData.length - 1].qs) * 100
    : 0;

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setShowSuccess(false);

      // Show loading state for at least 1 second
      const refreshPromise = Promise.all([
        refetchAccount(),
        refetchScores(),
        refetchCampaigns()
      ]);

      // Wait for all requests to complete or 1 second, whichever is longer
      await Promise.all([
        refreshPromise,
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);

      // Show success message
      setShowSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get top 5 campaigns by quality score
  const topCampaigns = [...campaignsData]
    .filter(campaign => campaign.scores && campaign.scores.length > 0)
    .map(campaign => ({
      ...campaign,
      currentScore: campaign.scores?.[0]?.qs || 0,
      trend: campaign.scores && campaign.scores.length > 1
        ? ((campaign.scores[0].qs - campaign.scores[campaign.scores.length - 1].qs) / campaign.scores[campaign.scores.length - 1].qs) * 100
        : 0
    }))
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, 5);

  // Render loading state
  if (isLoadingAccount || isLoadingScores || isLoadingCampaigns) {
    return (
      <Container>
        <div className="space-y-4">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="150px" height="24px" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton width="120px" height="20px" className="mb-2" />
                <Skeleton width="80px" height="24px" className="mb-4" />
                <Skeleton width="100%" height="40px" />
              </div>
            ))}
          </div>
        </div>
      </Container>
    );
  }

  // Render error state
  if (isAccountError || !subAccountId) {
    return (
      <Container>
        <div className="p-4 bg-red-50 rounded-lg text-red-700">
          <h2 className="text-lg font-medium mb-2">Error loading account data</h2>
          <p className="text-sm">
            {accountError?.message || 'No account ID provided'}
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => navigate('/')}
          >
            Go back
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="account-header">
        <div className="grid">
          <div className="card">
            <div>
              <h1 className="account-title">{accountName}</h1>
              <p className="account-subtitle" style={{marginBottom: '0'}}>Account ID: {displayAccountId}</p>
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="button-group">
              <div
                className={`status-badge ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}
              >
                {status}
              </div>
              <div className="relative">
                <Button
                  variant="primary"
                  onClick={handleRefresh}
                  leftIcon={
                    isRefreshing ? (
                      <div className="animate-spin">
                        <RefreshIcon />
                      </div>
                    ) : (
                      <RefreshIcon />
                    )
                  }
                  disabled={isRefreshing}
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                {showSuccess && (
                  <div className="absolute top-full left-0 right-0 mt-1 text-center">
                    <div className="inline-block px-2 py-1 text-xs text-green-600 bg-green-100 rounded">
                      Data refreshed successfully!
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Score Overview */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-6">Kalite Skoru Genel Bakış</h2>

        {/* Current Score Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium">Güncel Skor</h3>
            <p className="text-3xl font-bold">{currentScore.toFixed(1)}</p>
            <div className={`text-sm mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% önceki döneme göre
            </div>
          </div>

          {/* Time Period Selector */}
          <div className="p-4 bg-white rounded-lg shadow">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Zaman Aralığı</h3>
            <div className="flex space-x-2">
              {[7, 30, 90, 365].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1 text-sm rounded-md ${timeRange === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {days} Gün
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          <QualityScoreChart scores={scoresData} timeRange={timeRange} />

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Ortalama Tıklanma Oranı', value: '2.5%', change: '+0.3%' },
              { title: 'Dönüşüm Oranı', value: '1.8%', change: '-0.2%' },
              { title: 'Ortalama Pozisyon', value: '3.2', change: '+0.1' },
            ].map((metric, index) => (
              <div key={index} className="p-4 bg-white rounded-lg shadow">
                <h3 className="text-gray-500 text-sm font-medium">{metric.title}</h3>
                <p className="text-2xl font-bold">{metric.value}</p>
                <div className={`text-sm mt-1 ${metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.change} önceki döneme göre
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Top Campaigns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topCampaigns.map((campaign) => (
            <div key={campaign.id} className="p-4 bg-white rounded-lg shadow">
              <h3 className="font-medium">{campaign.name}</h3>
              <div className="flex items-center mt-2">
                <span className="text-2xl font-bold mr-2">{campaign.currentScore.toFixed(1)}</span>
                <span className={`text-sm ${getQualityScoreColorClass(campaign.currentScore)}`}>
                  {campaign.trend >= 0 ? '↑' : '↓'} {Math.abs(campaign.trend).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};

export default MccSubAccountPage;
