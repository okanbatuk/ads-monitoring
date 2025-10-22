import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { format, parse, subDays, addDays, startOfWeek, isSameWeek, isValid } from 'date-fns';
import { AccountScoreDto } from '../types/api.types';


interface AccountSparklineProps {
  scores: AccountScoreDto[];
  width?: number | string;
  height?: number;
  timeRange?: number; // in days
}

export const AccountSparkline: React.FC<AccountSparklineProps> = ({
  scores = [],
  width = '100%',
  height = 30,
  timeRange = 7,
}) => {
  // Process data based on timeRange
  const processedData = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);

    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, { qs: number , campaignCount: number }>();
    scores.forEach(score => {
      try {
        const date = parse(score.date, 'dd.MM.yyyy', new Date());
        if (isValid(date)) {
          scoreMap.set(format(date, 'yyyy-MM-dd'), { qs: score.qs, campaignCount: score.campaignCount});
        }
      } catch (e) {
        console.warn('Invalid date in sparkline data:', score.date);
      }
    });

    // Generate array of all dates in the time range
    const dateArray = [];
    for (let i = 0; i < timeRange; i++) {
      dateArray.push(addDays(startDate, i));
    }

    // For time ranges > 30 days, group by week
    if (timeRange > 30) {
      const weeklyData: { date: Date; qs: number; count: number, campaignCount: number }[] = [];

      dateArray.forEach(date => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const existingWeek = weeklyData.find(w => isSameWeek(w.date, weekStart, { weekStartsOn: 1 }));

        const dateStr = format(date, 'yyyy-MM-dd');
        const scoreData = scoreMap.get(dateStr) || { qs: 0,campaignCount: 0 };

        if (existingWeek) {
          existingWeek.qs += scoreData.qs;
          existingWeek.count++;
          existingWeek.campaignCount = scoreData.campaignCount;
        } else {
          weeklyData.push({
            date: weekStart,
            qs: scoreData.qs,
            count: 1,
            campaignCount: scoreData.campaignCount,
          });
        }
      });

      // Process weekly data
      return weeklyData.map(week => ({
        date: format(week.date, 'MMM d'),
        qs: week.count > 0 ? week.qs / week.count : 0,
      }));
    }

    // For time ranges <= 30 days, show daily data
    return dateArray.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const displayDate = format(date, 'MMM d');
      const scoreData = scoreMap.get(dateStr) || { qs: 0,campaignCount: 0 };

      return {
        date: displayDate,
        qs: scoreData.qs,
        campaignCount: scoreData.campaignCount,
      };
    });
  }, [scores, timeRange]);

  if (!scores || scores.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-xs" style={{ width, height }}>
        Account has no Campaigns!
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const qsValue = Number(payload[0].value);
      const displayQs = qsValue.toFixed(1);
      return (
        <div 
          className="space-y-1.5 p-3 rounded-lg bg-gray-50/95 backdrop-blur-sm border border-gray-100 shadow-sm"
          style={{
            boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.05)'
          }}>
          <div className='flex items-center justify-between space-x-4'>
            <span className='text-gray-500 text-xs'>{payload[0].payload.date}</span>
          </div>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-gray-500 text-xs">Quality Score</span>
            <span 
              className={`font-medium ${
                qsValue >= 8 ? 'text-green-600' : 
                qsValue >= 5 ? 'text-yellow-600' : 'text-red-600'
              }`}>
              {displayQs}
            </span>
          </div>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-gray-500 text-xs">Campaigns</span>
            <span className="font-medium text-gray-900">
              {payload[0].payload.campaignCount}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width, height }} className="flex items-center">
      <div className="flex-1 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={processedData}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          >
            <defs>
              <linearGradient id="sparklineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              hide={true}
            />
            <YAxis 
              domain={[0, 10]} 
              hide={true}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="qs"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
