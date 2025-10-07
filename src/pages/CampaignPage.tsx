import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { useCampaign, useCampaignScores, useCampaignAdGroups } from '../services';
import { CampaignDto, AdGroupDto, CampaignScoreDto } from '../types/api.types';

// Extend the CampaignDto to include metrics
interface CampaignWithMetrics extends Omit<CampaignDto, 'metrics'> {
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
  };
}
import './CampaignPage.css';

// Define chart data type
interface ChartDataPoint {
  date: string;
  qs: number;
  adGroupCount: number;
}

// Constants
const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const CHART_COLORS = ['#4dabf7', '#74c0fc', '#4dabf7', '#339af0', '#1c7ed6'];

const Badge = ({
  children,
  variant = 'default',
  className = ''
}: {
  children: React.ReactNode;
  variant?: 'enabled' | 'paused' | 'removed' | 'default';
  className?: string;
}) => (
  <span className={`badge badge-${variant} ${className}`}>
    {children}
  </span>
);

// Components
const QSProgress = ({ value }: { value: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div
      className="bg-blue-600 h-2.5 rounded-full"
      style={{ width: `${value * 10}%` }}
    ></div>
  </div>
);

interface AdGroupCardProps {
  adGroup: AdGroupDto;
}

const AdGroupCard = ({ adGroup }: AdGroupCardProps) => {
  // newest first
  const scores = adGroup.scores?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  const currentScore = scores[0]?.qs ?? null;
  const trend = scores.length > 1
    ? ((scores[0].qs - scores[scores.length - 1].qs) / scores[scores.length - 1].qs) * 100
    : undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {adGroup.name}
        </h3>
        <Badge variant={adGroup.status === 'ENABLED' ? 'enabled' : adGroup.status === 'PAUSED' ? 'paused' : 'default'}>
          {adGroup.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Quality Score</p>
          <div className="flex items-center mt-1">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentScore !== null ? currentScore.toFixed(1) : 'N/A'}
            </span>
            {trend !== undefined && (
              <span className={`ml-2 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Keywords: {adGroup.scores?.[0]?.keywordCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CampaignPage = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [days, setDays] = useState('7');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: campaignResponse, isLoading: isLoadingCampaign } = useCampaign(campaignId || '');
  const { data: scoresResponse, isLoading: isLoadingScores } = useCampaignScores(campaignId || '', parseInt(days));
  const { data: adGroupsResponse, isLoading: isLoadingAdGroups } = useCampaignAdGroups(campaignId || '');

  const isLoading = isLoadingCampaign || isLoadingScores || isLoadingAdGroups;
  const campaignData = campaignResponse?.data as CampaignWithMetrics | undefined;
  const scoresData = (scoresResponse?.data?.scores || []) as CampaignScoreDto[];
  const adGroupCount = scoresResponse?.data?.total || 0;
  const adGroupsData = (adGroupsResponse?.data?.adGroups || []) as AdGroupDto[];
  const totalAdGroups = (adGroupsResponse?.data?.total || 0);

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

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Format scores data for charts
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!scoresData?.length) return [];
    // Sort by date to ensure chronological order
    const sortedScores = [...scoresData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedScores.map((item) => ({
      date: formatDate(item.date),
      qs: item.qs || 0,
      adGroupCount: 0, // This field is not in the DTO, defaulting to 0
    }));
  }, [scoresData]);

  // Default metrics object with all values set to 0
  const defaultMetrics = {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    conversions: 0,
  };
  
  // Safely access metrics with fallback to default values
  const metrics = campaignData?.metrics || defaultMetrics;

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate(-1);
    }
  };


  // Get top ad groups by quality score (first 5)
  const topAdGroups = useMemo(() => {
    if (!adGroupsData?.length) return [];
    
    // Create a new array to avoid mutating the original
    const sortedAdGroups = [...adGroupsData]
      // Filter out ad groups without scores
      .filter(adGroup => adGroup.scores?.[0]?.qs !== undefined)
      // Sort by quality score in descending order
      .sort((a, b) => (b.scores?.[0]?.qs || 0) - (a.scores?.[0]?.qs || 0))
      // Take top 5
      .slice(0, 5);
      
    return sortedAdGroups;
  }, [adGroupsData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!campaignData) {
    return (
      <div className="p-6">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <FiArrowLeft className="mr-2" /> Back
        </button>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <p className="font-bold">Error</p>
          <p>Failed to load campaign data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <button
          onClick={handleBack}
          className="back-button"
        >
          <FiArrowLeft className="mr-2" /> Back
        </button>
        
        <div className="title-container">
          <div>
            <h1 className="title">{campaignData.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                campaignData.status === 'ENABLED' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {campaignData.status}
              </span>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ID: {campaignData.id}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="select"
            >
              {TIME_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'adgroups'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main>
        {/* Campaign Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-label">Quality Score</p>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <p className="stat-value">
                {currentScore?.toFixed(1) || 'N/A'}
              </p>
              {trend !== undefined && trend !== 0 && (
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.875rem',
                  color: trend > 0 ? '#10b981' : '#ef4444'
                }}>
                  {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </span>
              )}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <QSProgress value={currentScore} />
            </div>
          </div>

          <div className="stat-card">
            <p className="stat-label">Ad Groups</p>
            <p className="stat-value">{adGroupCount}</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Status</p>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              campaignData.status === 'ENABLED' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {campaignData.status}
            </span>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Metrics Grid */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <div className="stat-card">
                <p className="stat-label">Impressions</p>
                <p className="stat-value">
                  {metrics.impressions.toLocaleString()}
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-label">Clicks</p>
                <p className="stat-value">
                  {metrics.clicks.toLocaleString()}
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-label">CTR</p>
                <p className="stat-value">
                  {(metrics.ctr * 100).toFixed(2)}%
                </p>
              </div>

              <div className="stat-card">
                <p className="stat-label">Conversions</p>
                <p className="stat-value">
                  {metrics.conversions.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
              <div className="chart-container">
                <h3 className="chart-title">Quality Score Trend</h3>
                <div style={{ height: '20rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" />
                      <YAxis domain={[0, 10]} stroke="#6b7280" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="qs"
                        name="Quality Score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-container">
                <h3 className="chart-title">Ad Groups Trend</h3>
                <div style={{ height: '20rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="adGroupCount"
                        name="Ad Groups"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Ad Groups */}
            <div className="ad-groups-container">
              <div className="ad-groups-header">
                <h3 className="ad-groups-title">Top Ad Groups by Quality Score</h3>
              </div>
              <div className="ad-groups-list">
                {topAdGroups.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {topAdGroups.map((adGroup) => (
                      <AdGroupCard key={adGroup.id} adGroup={adGroup} />
                    ))}
                  </div>
                ) : (
                  <p className="noData">No ad groups found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'adgroups' && (
          <div className="ad-groups-container">
            <div className="ad-groups-header">
              <h3 className="ad-groups-title">Ad Groups</h3>
            </div>
            <div className="ad-groups-list">
              {/* TODO: add total ad groups count */}
              {adGroupsData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {adGroupsData.map((adGroup) => (
                    <AdGroupCard key={adGroup.id} adGroup={adGroup} />
                  ))}
                </div>
              ) : (
                <p className="no-data">No ad groups found</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CampaignPage;
