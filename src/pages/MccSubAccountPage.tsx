import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiRefreshCw, FiPlus, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { format, subDays, parse, addDays, startOfWeek, isWithinInterval, isValid } from 'date-fns';
import { useAccount, useAccountScores, useAccountCampaigns } from '../services/api';
import type {
  GetAccountResponse,
  GetAccountScoresResponse,
  GetAccountCampaignsResponse,
  AccountScoreDto,
  CampaignScoreDto
} from '../types/api.types';
// Define types for chart data
interface ChartDataPoint {
  date: string;
  qs: number;
  campaignCount: number;
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { CampaignSparkline } from '../components/CampaignSparkline';



const getStatusVariant = (status: string) => {
  switch (status) {
    case 'ENABLED': return 'enabled';
    case 'PAUSED': return 'paused';
    case 'REMOVED': return 'removed';
    default: return 'default';
  }
};

const MccSubAccountPage: React.FC = () => {
  // Navigation and routing
  const navigate = useNavigate();
  const location = useLocation();
  const { subAccountId = '' } = useParams<{ subAccountId: string }>();

  // Time range options
  const TIME_RANGES = [7, 30, 90, 365];

  // Component state
  const [timeRange, setTimeRange] = useState<number>(7);

  // Debug log for API call parameters
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns'>('overview');

  // Data fetching
  const {
    data: accountResponse,
    isLoading: isLoadingAccount,
    isError: isErrorAccount,
    error: accountError,
    refetch: refetchAccount
  } = useAccount(subAccountId);

  const {
    data: scoresResponse,
    isLoading: isLoadingScores,
    isError: isErrorScores,
    error: scoresError,
    refetch: refetchScores
  } = useAccountScores(subAccountId, timeRange);

  const {
    data: campaignsResponse,
    isLoading: isLoadingCampaigns,
    isError: isErrorCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns
  } = useAccountCampaigns(subAccountId);

  // Process data
  const account = useMemo(() => {
    return accountResponse?.data;
  }, [accountResponse]);

  // Status variables
  const statusColor = account?.status === 'ENABLED' ? 'bg-green-500' :
    account?.status === 'PAUSED' ? 'bg-yellow-500' : 'bg-red-500';
  const getTooltip = (status: string, type: "account" | "campaign") => {
    switch (status) {
      case 'ENABLED': return type === 'account' ? 'Account is active' : 'Campaign is active';
      case 'PAUSED': return type === 'account' ? 'Account is paused' : 'Campaign is paused';
      case 'REMOVED': return type === 'account' ? 'Account is removed' : 'Campaign is removed';
      default: return '';
    }
  };
  const statusText = account?.status === 'ENABLED' ? 'text-green-600' :
    account?.status === 'PAUSED' ? 'text-yellow-600' : 'text-red-600';

  // Process and format scores data for the chart
  const { scores, scoreMap } = useMemo<{ scores: ChartDataPoint[]; scoreMap: Map<string, { qs: number, campaignCount: number }> }>(() => {
    const defaultReturn = { scores: [], scoreMap: new Map<string, { qs: number, campaignCount: number }>() };

    if (!scoresResponse?.data?.scores?.length) {
      return defaultReturn;
    }

    const rawScores = scoresResponse.data.scores as AccountScoreDto[];
    const scoreMap = new Map<string, { qs: number, campaignCount: number }>();

    // First pass: create a map of dates to scores
    rawScores.forEach(score => {
      try {
        // Parse the date string from the API (assuming format is 'dd.MM.yyyy')
        const date = parse(score.date, 'dd.MM.yyyy', new Date());
        // Only add valid dates to the map
        if (!isNaN(date.getTime())) {
          // Use a consistent format for the map key (YYYY-MM-DD)
          const dateKey = format(date, 'yyyy-MM-dd');
          scoreMap.set(dateKey, { qs: parseFloat(score.qs.toFixed(2)), campaignCount: score.campaignCount });
        } else {
          console.warn('Invalid date in scores data:', score.date);
        }
      } catch (error) {
        console.error('Error parsing date:', score.date, error);
      }
    });

    // Generate data points for the selected time range
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    const scores: ChartDataPoint[] = [];

    // If no valid scores were found, return empty results
    if (scoreMap.size === 0) {
      return defaultReturn;
    }

    // For time ranges > 30 days, group by week
    if (timeRange > 30) {
      const weekGroups = new Map<string, { sum: number; count: number }>();

      // Process each day in the time range
      for (let i = 0; i < timeRange; i++) {
        const currentDate = addDays(startDate, i);
        const weekStart = format(startOfWeek(currentDate), 'yyyy-MM-dd');
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const data = scoreMap.get(dateStr) || { qs: 0, campaignCount: 0 };

        if (!weekGroups.has(weekStart)) {
          weekGroups.set(weekStart, { sum: 0, count: 0 });
        }

        const group = weekGroups.get(weekStart)!;
        group.sum += data.qs;
        group.count++;
      }

      // Convert week groups to chart data
      scores.push(
        ...Array.from(weekGroups.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([weekStart, { sum, count }]) => ({
            date: format(new Date(weekStart), 'MMM d'),
            qs: count > 0 ? sum / count : 0, // Weekly average
            campaignCount: count
          }))
      );
    } else {
      // For 7-30 days, show daily data
      for (let i = 0; i < timeRange; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const displayDate = format(currentDate, timeRange <= 14 ? 'MMM d' : 'd MMM');

        scores.push({
          date: displayDate,
          qs: (scoreMap.get(dateStr) || { qs: 0, campaignCount: 0 }).qs,
          campaignCount: (scoreMap.get(dateStr) || { qs: 0, campaignCount: 0 }).campaignCount
        });
      }
    }

    return { scores, scoreMap };
  }, [scoresResponse]);

  const { campaigns, campaignCount } = useMemo(() => {
    const response = campaignsResponse;
    const campaignsData = response?.data?.campaigns || [];
    const count = response?.data?.total || 0;

    const processedCampaigns = campaignsData.map((campaign) => {
      // Process campaign scores to ensure proper date formatting
      const processedScores = Array.isArray(campaign.scores)
        ? campaign.scores.map(score => ({
          ...score,
          // Ensure date is in the correct format (dd.MM.yyyy)
          date: format(parse(score.date, 'dd.MM.yyyy', new Date()), 'dd.MM.yyyy')
        }))
        : [];

      return {
        ...campaign,
        accountId: campaign.accountId || subAccountId,
        scores: processedScores
      };
    });

    return { campaigns: processedCampaigns, campaignCount: count };
  }, [campaignsResponse, subAccountId]);

  const avgQs = useMemo(() => {
    if (!scores?.length) return 0;
    const validScores = scores.filter((score) => score.qs > 0);
    if (!validScores.length) return 0;
    const sum = validScores.reduce((acc, score) => acc + score.qs, 0);
    return sum / validScores.length;
  }, [scores]);

  // Get the last 7 days of scores for the chart
  const lastSevenDaysScores = useMemo(() => {
    if (!scores?.length) return [];
    return scores.slice(-7);
  }, [scores]);

  const recentCampaigns = useMemo(() => {
    return campaigns.slice(0, 5);
  }, [campaigns]);


  const handleTimeRangeChange = (days: number) => {
    setTimeRange(days);
    refetchScores();
  };

  // Loading and error states
  const isLoading = isLoadingAccount || isLoadingScores || isLoadingCampaigns;
  const hasError = isErrorAccount || isErrorScores || isErrorCampaigns;
  const error = accountError || scoresError || campaignsError;

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Render error state
  if (hasError) {
    return (
      <div className="p-4 text-red-600">
        Error: {error?.message || 'Failed to load data'}
      </div>
    );
  }


  // Main content
  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {account?.name || 'Sub Account'}
                </h1>
                {account?.status && (
                  <div className="relative group">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${statusColor}`}
                      style={{ marginBottom: '0.25rem' }}
                      title={getTooltip(account?.status, 'account')}
                    ></span>
                    <div className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${statusText} text-xs rounded px-3 py-2 -mt-8 -ml-2`}>
                      {getTooltip(account?.status, 'account')}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Account ID: {account?.accountId || 'N/A'}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-2">
                <div className="flex items-center">
                  <span className="font-medium">Quality Score: </span>
                  <span className={`ml-1 font-semibold ${avgQs >= 7 ? 'text-green-600' : avgQs >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {avgQs.toFixed(1)}/10
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Campaigns: </span>
                  <span className="font-semibold">{campaignCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Score Trend */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Quality Score Trend</h3>
            <div className="inline-flex rounded-md shadow-sm mt-2 sm:mt-0" role="group">
              {TIME_RANGES.map((days, index) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTimeRange(days)}
                  className={`px-3 py-1.5 text-sm font-medium ${timeRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    } ${index === 0 ? 'rounded-l-md' : ''} ${index === TIME_RANGES.length - 1 ? 'rounded-r-md' : ''
                    } border border-gray-300`}
                >
                  {days === 365 ? '1y' : `${days}d`}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {scores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scores}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickMargin={10}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tickCount={6}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const qsValue = Number(payload[0].value);
                        const displayQs = qsValue.toFixed(1);
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                            <p className="text-sm font-medium text-gray-500">
                              {payload[0].payload.date}
                            </p>
                            <p className="mt-1 text-lg font-semibold">
                              <span className={qsValue >= 7 ? 'text-green-600' : qsValue >= 4 ? 'text-yellow-600' : 'text-red-600'}>
                                {displayQs}
                              </span>
                              <span className="text-gray-500 text-sm ml-1">/ 10</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {payload[0].payload.campaignCount} campaigns
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="qs"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#1d4ed8', strokeWidth: 2, fill: '#3b82f6' }}
                  />
                  <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded">
                <p className="text-gray-500">No quality score data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Campaigns Table */}
        <div className='bg-white p-6 rounded-lg shadow mb-8'>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Campaigns</h3>
          </div>

          {isLoadingCampaigns ? (
            <div className="p-6 text-center">Loading campaigns...</div>
          ) : campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Campaign
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/3">
                      QS Trend
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Avg QS
                    </th>
                  </tr>

                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => {

                    const now = new Date();
                    const startDate = subDays(now, timeRange - 1);
                    // Process scores for the current time range
                    const validScores = (Array.isArray(campaign.scores) ? campaign.scores : [])
                      .map(score => {
                        try {
                          if (!score || typeof score !== 'object') return null;

                          // Ensure score has required properties
                          if (typeof score.date !== 'string' || score.qs === undefined) {
                            return null;
                          }

                          // Parse and validate date
                          const scoreDate = parse(score.date, 'dd.MM.yyyy', new Date());
                          if (!isValid(scoreDate)) {
                            return null;
                          }

                          // Parse and validate QS value
                          const qsValue = typeof score.qs === 'number'
                            ? score.qs
                            : parseFloat(score.qs);

                          if (isNaN(qsValue) || qsValue < 0) {
                            return null;
                          }

                          // Create a valid score object with all required fields
                          return {
                            id: score.id || 0,
                            campaignId: score.campaignId || campaign.id,
                            date: format(scoreDate, 'dd.MM.yyyy'),
                            qs: qsValue,
                            adGroupCount: score.adGroupCount || 0
                          } as CampaignScoreDto;
                        } catch (e) {
                          return null;
                        }
                      })
                      .filter((score): score is CampaignScoreDto => score !== null);

                    // Calculate average QS and trend
                    const nonZeroScores = validScores.filter(score => score.qs > 0);
                    const avgQs = nonZeroScores.length > 0
                      ? nonZeroScores.reduce((sum, score) => sum + score.qs, 0) / nonZeroScores.length
                      : 0;

                    // Calculate trend percentage
                    let trendPercentage = 0;
                    if (validScores.length >= 2) {
                      const firstScore = validScores[0]?.qs || 0;
                      const lastScore = validScores[validScores.length - 1]?.qs || 0;
                      trendPercentage = firstScore !== 0
                        ? ((lastScore - firstScore) / firstScore) * 100
                        : 0;
                    }

                    return (
                      <tr
                        key={campaign.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/accounts/${subAccountId}/campaigns/${campaign.id}`)}
                      >
                        <td className="px-6 py-4 w-1/6">
                          <div className="flex items-center gap-3">
                            <span className='text-sm font-medium text-gray-900'>{campaign.name}</span>
                            <div className="relative group">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${statusColor}`}
                                style={{ marginBottom: '0.25rem' }}
                                title={getTooltip(campaign.status, 'campaign')}
                              ></span>
                              <div className={`cursor-pointer absolute z-10 hidden group-hover:block bg-gray-200 ${statusText} text-xs rounded px-3 py-2 -mt-8 -ml-2`}>
                                {getTooltip(campaign.status, 'campaign')}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 pt-1">ID: {campaign.id}</div>
                        </td>
                        <td className="px-6 py-4 w-1/2">
                          <div className="h-10">
                            <CampaignSparkline
                              scores={validScores}
                              timeRange={timeRange}
                              width="100%"
                              height={40}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 w-1/6">
                          <div className="flex items-center">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${avgQs >= 7
                                ? 'bg-green-100 text-green-800'
                                : avgQs >= 4
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {avgQs.toFixed(1)}
                            </span>
                            {validScores.length > 1 && (
                              <span className={`ml-2 text-sm ${trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {trendPercentage >= 0 ? '↑' : '↓'} {Math.abs(trendPercentage).toFixed(1)}%
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
            <div className="p-6 text-center text-gray-500">
              No campaigns found for this account.
            </div>
          )}
        </div>
      </div>
    </div>
  );

};

export default MccSubAccountPage;
