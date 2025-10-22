import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useCampaign, useCampaignScores, useCampaignAdGroups, useAdGroupScores } from '../services';
import { AdGroupSparkline } from '../components/AdGroupSparkline';
import { CampaignDto, CampaignScoreDto } from '../types/api.types';
import { format, startOfWeek, subDays, addDays, parse } from 'date-fns';

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
  const [timeRange, setTimeRange] = useState(7);
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

  // Get bottom 5 ad groups by quality score with time range based sparkline data
  const bottomAdGroups = useMemo(() => {
    if (!adGroupsData.length) return [];

    // Create a copy of the array and sort by score (ascending)
    return [...adGroupsData]
      .sort((a, b) => (a.scores?.[0]?.qs || 0) - (b.scores?.[0]?.qs || 0))
      .slice(0, 5)
      .map(adGroup => {
        // Create a map of date to score for easy lookup
        const scoreMap = new Map<string, number>();
        adGroup.scores?.forEach(score => {
          const date = parse(score.date, 'dd.MM.yyyy', new Date());
          scoreMap.set(format(date, 'yyyy-MM-dd'), score.qs);
        });

        // Generate data points for the selected time range
        const now = new Date();
        const startDate = subDays(now, timeRange - 1);

        // For time ranges > 30 days, group by week
        if (timeRange > 30) {
          const weekGroups = new Map<string, { sum: number; count: number }>();

          // Process each day in the time range
          for (let i = 0; i < timeRange; i++) {
            const currentDate = addDays(startDate, i);
            const weekStart = format(startOfWeek(currentDate), 'yyyy-MM-dd');
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const score = scoreMap.get(dateStr) || 0;

            if (!weekGroups.has(weekStart)) {
              weekGroups.set(weekStart, { sum: 0, count: 0 });
            }

            const group = weekGroups.get(weekStart)!;
            group.sum += score;
            group.count++;
          }

          // Convert week groups to chart data
          const weeklyData = Array.from(weekGroups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([weekStart, { sum, count }]) => ({
              date: format(new Date(weekStart), 'MMM d'),
              qs: count > 0 ? sum / count : 0 // Weekly average
            }));

          return {
            ...adGroup,
            score: adGroup.scores?.[0]?.qs || 0,
            sparklineData: weeklyData
          };
        } else {
          // For 7-30 days, show daily data
          const dailyData = [];
          for (let i = 0; i < timeRange; i++) {
            const currentDate = addDays(startDate, i);
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            const displayDate = format(currentDate, timeRange <= 14 ? 'MMM d' : 'd MMM');

            dailyData.push({
              date: displayDate,
              qs: scoreMap.get(dateStr) || 0
            });
          }

          return {
            ...adGroup,
            score: adGroup.scores?.[0]?.qs || 0,
            sparklineData: dailyData
          };
        }
      });
  }, [adGroupsData, timeRange]);

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

  // Format scores data for the chart
  const chartData = useMemo(() => {
    if (!scoresData || scoresData.length === 0) {
      // Return empty data points for the selected time range
      const emptyData = [];
      const today = new Date();
      for (let i = timeRange - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        emptyData.push({
          date: format(date, 'MMM d'),
          qs: 0
        });
      }
      return emptyData;
    }

    // Create a map of dates to scores for easy lookup
    const scoreMap = new Map<string, {qs:number, adGroupCount: number}>();
    scoresData.forEach(score => {
      // const dateStr = format(new Date(score.date), 'yyyy-MM-dd');
      const date = parse(score.date, 'dd.MM.yyyy', new Date());
      const dateStr = format(date, 'yyyy-MM-dd');
      scoreMap.set(dateStr, {qs: score.qs || 0, adGroupCount: score.adGroupCount || 0});
    });

    // Generate data points for the selected time range
    const today = new Date();
    const dateArray = Array.from({ length: timeRange }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (timeRange - 1 - i));
      return date;
    });

    // For time ranges > 30 days, group by week for better readability
    if (timeRange > 30) {
      const weekGroups = new Map<string, { sum: number, count: number }>();

      dateArray.forEach(date => {
        const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const dateStr = format(date, 'yyyy-MM-dd');
        const score = (scoreMap.get(dateStr) || {qs:0, adGroupCount:0}).qs;
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
          qs: count > 0 ? sum / count : 0, // Weekly average
          adGroupCount: count
        }));
    } else {
      // For 7-30 days, show daily data
      return dateArray.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, timeRange <= 14 ? 'MMM d' : 'd MMM');
        return {
          date: displayDate,
          qs: (scoreMap.get(dateStr) || {qs:0, adGroupCount:0}).qs,
          adGroupCount: (scoreMap.get(dateStr) || {qs:0, adGroupCount:0}).adGroupCount
        };
      });
    }
  }, [scoresData, timeRange]);

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
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div>
            <div className='flex items-center gap-3'>
              <h1 className="text-2xl font-bold text-gray-900">{campaign?.name || 'Campaign'}</h1>
              <StatusBadge status={campaign?.status || 'UNKNOWN'} />
            </div>
            <div className="text-sm text-gray-600">
              <span>Campaign ID: {campaignId}</span>
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
          <div className='space-y-6'>
            {/* Quality Score Trend Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Quality Score Trend</h2>
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
                            const qsValue = Number(payload[0].value);
                            const displayQs = qsValue.toFixed(1);
                            return (
                              <div
                                className="space-y-1.5 p-3 rounded-lg bg-gray/65 backdrop-blur-sm border border-gray-100 shadow-sm"
                                style={{
                                  boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.05)'
                                }}
                              >
                                <div className="flex items-center justify-between space-x-4">
                                  <span className="text-gray-600 text-xs">Quality Score:</span>{' '}
                                  <span className={`font-medium ${
                                    qsValue >= 8 ? 'text-green-600' : 
                                    qsValue >= 5 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {displayQs}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                  <span className="text-gray-600 text-xs">Ad Groups:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {payload[0].payload.adGroupCount}
                                  </span>
                                </div>
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

            {/* Bottom 5 Ad Groups Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Bottom 5 Ad Groups by Quality Score</h3>
              {bottomAdGroups.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Ad Group
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                          QS Trend
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          AVG QS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bottomAdGroups.map((adGroup) => {
                        const latestScore = adGroup.score;
                        const sparklineData = adGroup.sparklineData || [];

                        // Calculate trend from sparkline data (first vs last non-zero value)
                        const nonZeroScores = sparklineData.filter(d => d.qs > 0);
                        let trendPercentage = 0;

                        if (nonZeroScores.length >= 2) {
                          const firstScore = nonZeroScores[0].qs;
                          const lastScore = nonZeroScores[nonZeroScores.length - 1].qs;
                          trendPercentage = ((lastScore - firstScore) / (firstScore || 1)) * 100;
                        }

                        return (
                          <tr
                            key={adGroup.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/campaigns/${campaignId}/adgroups/${adGroup.id}`)}
                          >
                            <td className="px-6 py-4 w-1/6">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 truncate">
                                    {adGroup.name}
                                  </span>
                                  <StatusBadge status={adGroup.status} />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">ID: {adGroup.id}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/2">
                              <div className="w-full h-10">
                                {sparklineData.length > 0 ? (
                                  <div className="w-full h-10">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={sparklineData}>
                                        <Line
                                          type="monotone"
                                          dataKey="qs"
                                          stroke="#3b82f6"
                                          strokeWidth={2}
                                          dot={false}
                                          activeDot={{
                                            r: 4,
                                            fill: '#3b82f6',
                                            stroke: '#fff',
                                            strokeWidth: 2
                                          }}
                                        />
                                        <XAxis
                                          dataKey="date"
                                          hide
                                        />
                                        <YAxis
                                          hide
                                          domain={[0, 10]}
                                        />
                                        <Tooltip
                                          contentStyle={{ fontSize: '12px' }}
                                          formatter={(value: number) => [`${value.toFixed(1)}`, 'QS']}
                                          labelFormatter={(label) => `Date: ${label}`}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400 h-full flex items-center">
                                    No data
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 w-1/6">
                              <div className="flex items-center">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${latestScore >= 7
                                      ? 'bg-green-100 text-green-800'
                                      : latestScore >= 4
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                  {latestScore.toFixed(1)}
                                </span>
                                {sparklineData.length > 1 && nonZeroScores.length >= 2 && (
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
                <div className="px-6 py-4 text-center text-gray-500">
                  No ad groups found
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Ad Groups</h2>
              <p className="mt-1 text-sm text-gray-500">
                {isLoadingAdGroups ? 'Loading...' : `${adGroupCount} ad groups found`}
              </p>
            </div>

            {isLoadingAdGroups ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded"></div>
                  ))}
                </div>
              </div>
            ) : adGroupsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 w-1/4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ad Group
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
                    {adGroupsData.map((adGroup) => {
                      const scores = adGroup.scores || [];
                      const latestScore = scores.length > 0 ? scores[0].qs : 0;
                      const previousScore = scores.length > 1 ? scores[1].qs : latestScore;
                      const trend = latestScore - previousScore;
                      const trendPercentage = previousScore ? (trend / previousScore) * 100 : 0;

                      return (
                        <tr
                          key={adGroup.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/campaigns/${campaignId}/adgroups/${adGroup.id}`)}
                        >
                          <td className="px-6 py-4 w-1/4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {adGroup.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">ID: {adGroup.id}</div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <StatusBadge status={adGroup.status} />
                          </td>
                          <td className="px-6 py-4 w-2/5 whitespace-nowrap">
                            <div className="w-full min-w-[200px] h-10">
                              <AdGroupSparkline
                                scores={scores}
                                width="100%"
                                height={40}
                                timeRange={timeRange}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 w-1/6 whitespace-nowrap">
                            <div className="flex items-center">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${latestScore >= 7
                                    ? 'bg-green-100 text-green-800'
                                    : latestScore >= 4
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                              >
                                {latestScore.toFixed(1)}/10
                              </span>
                              {!isNaN(trendPercentage) && trendPercentage !== 0 && (
                                <span
                                  className={`ml-3 inline-flex items-center text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}
                                >
                                  {trend > 0 ? (
                                    <FiArrowUpRight className="mr-1" />
                                  ) : (
                                    <FiArrowDownRight className="mr-1" />
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
              <div className="p-6 text-center text-gray-500">
                No ad groups found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignPage;
