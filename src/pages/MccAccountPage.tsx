import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useSubAccounts, useMccAccountScores } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parse, subDays, addDays, startOfWeek, isSameWeek, isValid, differenceInDays } from 'date-fns';
import { AccountSparkline } from '../components/AccountSparkline';

// Time range options
const TIME_RANGES = [7, 30, 90, 365];

interface ScoreData {
  date: string;
  qs: number;
  accountCounts: number;
}

interface ScoreData {
  date: string;
  qs: number;
  accountCounts: number;
}

export const MccAccountPage = () => {
  const { mccId } = useParams<{ mccId: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(7);

  // Fetch data
  const { data: accountData, isLoading: isLoadingAccount } = useAccount(mccId || '');
  const { data: subAccountData, isLoading: isLoadingSubAccounts } = useSubAccounts(mccId || '');
  const { data: scoresResponse, isLoading: isLoadingScores } = useMccAccountScores(mccId || '', timeRange);

  // Process scores data
  const { scores, scoreMap } = useMemo<{ scores: ScoreData[]; scoreMap: Map<string, {qs:number, accountCounts: number}> }>(() => {
    const defaultReturn = { scores: [], scoreMap: new Map<string, {qs:number, accountCounts: number}>() };
    
    if (!scoresResponse?.data?.scores?.length) {
      return defaultReturn;
    }

    const rawScores = scoresResponse.data.scores;
    const scoreMap = new Map<string, {qs:number, accountCounts: number}>();
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    // First, map all scores by date for quick lookup
    rawScores.forEach(score => {
      if (score.date && score.qs !== undefined) {
        // Parse the date from dd.MM.yyyy format and convert to yyyy-MM-dd for consistent storage
        try {
          const dateObj = parse(score.date, 'dd.MM.yyyy', new Date());
          const formattedDate = format(dateObj, 'yyyy-MM-dd');
          scoreMap.set(formattedDate, {qs: score.qs, accountCounts: score.accountCount});
        } catch (e) {
          console.warn('Failed to parse date:', score.date, e);
        }
      }
    });
    
    // Generate data points for the selected time range
    const scores: ScoreData[] = [];
    for (let i = 0; i < timeRange; i++) {
      const currentDate = addDays(startDate, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const displayDate = timeRange <= 14 ? format(currentDate, 'MMM d') : format(currentDate, 'd MMM');
      
      const qs = (scoreMap.get(dateStr) || {qs: 0, accountCounts: 0}).qs;
      const accountCounts = (scoreMap.get(dateStr) || {qs: 0, accountCounts: 0}).accountCounts;
      
      scores.push({
        date: displayDate,
        qs,
        accountCounts
      });
    }

    return { scores, scoreMap };
  }, [scoresResponse, timeRange]);


  const account = accountData?.data;
  const subAccounts = subAccountData?.data?.subAccounts || [];

  const processedSubAccounts = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    
    return subAccounts.map(account => {
      const scores = account.scores || [];
      
      // Filter scores for the selected time range
      const filteredScores = scores.filter(score => {
        try {
          const scoreDate = parse(score.date, 'dd.MM.yyyy', new Date());
          return scoreDate >= startDate && scoreDate <= now;
        } catch (e) {
          console.warn('Invalid date format:', score.date);
          return false;
        }
      });
      
      // Sort scores by date
      const sortedScores = [...filteredScores].sort((a, b) => 
        new Date(parse(a.date, 'dd.MM.yyyy', new Date())).getTime() - 
        new Date(parse(b.date, 'dd.MM.yyyy', new Date())).getTime()
      );
      
      const avgQs = sortedScores.length > 0 
        ? sortedScores.reduce((sum, score) => sum + (score?.qs || 0), 0) / sortedScores.length 
        : 0;
      
      // Calculate QS change if we have at least 2 scores
      let qsChange = 0;
      if (sortedScores.length >= 2) {
        const firstQs = sortedScores[0]?.qs || 0;
        const lastQs = sortedScores[sortedScores.length - 1]?.qs || 0;
        qsChange = firstQs !== 0 ? ((lastQs - firstQs) / firstQs) * 100 : 0;
      }

      // Generate data points for all days in the time range
      const sparklineData = [];
      for (let i = 0; i < timeRange; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, 'dd.MM.yyyy');
        
        // Find score for this date
        const scoreForDate = sortedScores.find(s => {
          try {
            const scoreDate = parse(s.date, 'dd.MM.yyyy', new Date());
            return format(scoreDate, 'dd.MM.yyyy') === dateStr;
          } catch (e) {
            return false;
          }
        });
        
        sparklineData.push({
          date: dateStr,
          qs: scoreForDate?.qs || 0,
          // Add a flag to indicate if this is actual data or a placeholder
          hasData: !!scoreForDate
        });
      }

      return {
        ...account,
        avgQs,
        qsChange,
        sparklineData
      };
    });
  }, [subAccounts, timeRange]);
  
  if (isLoadingAccount || isLoadingScores || isLoadingSubAccounts) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }


  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Account not found</h2>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Calculate average QS
  const avgQs = scores.length > 0
    ? scores.reduce((sum, score) => sum + score.qs, 0) / scores.length
    : 0;

  // Process sub-accounts with scores and calculate average QS


  // Get bottom 5 sub-accounts by average QS
  const bottomAccounts = [...processedSubAccounts]
    .sort((a, b) => a.avgQs - b.avgQs)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {account.name}
          </h1>
          <p className="text-sm text-gray-500">
            Account ID: {account.accountId}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Quality Score Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-500">Quality Score</p>
            <div className="flex items-baseline mt-1">
              <span className={`text-3xl font-bold ${
                scores?.[scores.length - 1]?.qs >= 7 ? 'text-green-600' : avgQs >= 4 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                {scores?.[scores.length - 1]?.qs?.toFixed(1) || 'N/A'}
              </span>
              <span className="ml-2 text-sm text-gray-500">/ 10</span>
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-500">Status</p>
            <div className="flex items-center mt-1">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${account.status === 'ENABLED' ? 'bg-green-500' :
                account.status === 'PAUSED' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
              <span className="text-lg font-medium text-gray-900 capitalize">
                {account.status}
              </span>
            </div>
          </div>

          {/* Sub Accounts Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-500">Sub Accounts</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {subAccounts.length}
            </p>
          </div>
        </div>

        {/* Quality Score Trend */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h3 className="text-lg font-semibold mb-4 sm:mb-0">Quality Score Trend</h3>
            <div className="inline-flex rounded-md shadow-sm" role="group">
              {TIME_RANGES.map((days, index) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 text-sm font-medium ${timeRange === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    } ${index === 0 ? 'rounded-l-md' : ''
                    } ${index === TIME_RANGES.length - 1 ? 'rounded-r-md' : ''
                    } border border-gray-300`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scores}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickMargin={10}
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
                          className="space-y-1.5 p-3 rounded-lg bg-gray-50/95 backdrop-blur-sm border border-gray-100 shadow-sm"
                          style={{
                            boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-gray-500 text-xs">Quality Score</span>
                            <span className={`font-medium ${qsValue >= 8 ? 'text-green-600' :
                              qsValue >= 5 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                              {displayQs}
                            </span>
                          </div>
                          <div className="flex items-center justify-between space-x-4">
                            <span className="text-gray-600 text-xs">Accounts:</span>{' '}
                            <span className="font-medium text-gray-900">
                              {payload[0].payload.accountCounts}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                  contentStyle={{
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="qs"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2 }}
                />
                <ReferenceLine y={7} stroke="#10b981" strokeDasharray="3 3" />
                <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom 5 Sub Accounts */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bottom 5 Sub Accounts</h3>
          </div>

          {bottomAccounts.length > 0 ? (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Sub Account
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/3">
                      Qs Trend
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                      Avg QS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bottomAccounts.map((subAccount) => {
                    return (
                      <tr
                        key={subAccount.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/mcc/${mccId}/sub/${subAccount.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="text-sm font-medium text-gray-900">{subAccount.name}</div>
                          <div className="text-xs text-gray-500">{subAccount.accountId}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap w-2/3">
                          <div className="h-10 w-full">
                            <AccountSparkline 
                              width={750} 
                              scores={subAccount.scores || []} 
                              timeRange={timeRange}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="flex items-center">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${subAccount.avgQs >= 8 ? 'bg-green-100 text-green-800' :
                              subAccount.avgQs >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {subAccount.avgQs.toFixed(1)}
                            </span>
                            {subAccount.qsChange !== 0 && (
                              <span className={`ml-2 text-xs ${subAccount.qsChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {subAccount.qsChange > 0 ? '↑' : '↓'} {Math.abs(subAccount.qsChange).toFixed(1)}%
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
            <div className="text-center py-4 text-gray-500">
              No sub accounts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MccAccountPage;
