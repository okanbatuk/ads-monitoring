import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { KeywordScoreDto } from '../types/api.types';
import { format, parse, subDays, isWithinInterval, addDays, startOfWeek } from 'date-fns';

interface KeywordSparklineProps {
  scores: KeywordScoreDto[];
  width?: number | string;
  height?: number;
  timeRange?: number; // in days
}

export const KeywordSparkline: React.FC<KeywordSparklineProps> = ({
  scores = [],
  width = 500,
  height = 30,
  timeRange = 7 // default to 7 days
}) => {
  if (!scores || scores.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center" style={{ width, height }}>
        No data
      </div>
    );
  }

  // Process data based on timeRange
  const data = useMemo(() => {
    if (!scores || scores.length === 0) return [];

    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    
    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, number>();
    scores.forEach(score => {
      const date = parse(score.date, 'dd.MM.yyyy', new Date());
      if (isWithinInterval(date, { start: startDate, end: now })) {
        scoreMap.set(format(date, 'yyyy-MM-dd'), score.qs);
      }
    });

    // Generate array of all dates in the time range
    const dateArray = [];
    for (let i = 0; i < timeRange; i++) {
      dateArray.push(addDays(startDate, i));
    }

    // For time ranges > 30 days, group by week
    if (timeRange > 30) {
      const weekGroups = new Map<string, { sum: number; count: number }>();
      
      dateArray.forEach(date => {
        const weekStart = format(startOfWeek(date), 'yyyy-MM-dd');
        const dateStr = format(date, 'yyyy-MM-dd');
        const score = scoreMap.get(dateStr) || 0;
        
        if (!weekGroups.has(weekStart)) {
          weekGroups.set(weekStart, { sum: 0, count: 0 });
        }
        
        const group = weekGroups.get(weekStart)!;
        group.sum += score;
        group.count++;
      });

      return Array.from(weekGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, { sum, count }]) => ({
          date: format(new Date(weekStart), 'MMM d'),
          qs: count > 0 ? sum / count : 0 // Weekly average
        }));
    } else {
      // For 7-30 days, show daily data
      return dateArray.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, timeRange <= 14 ? 'MMM d' : 'd MMM');
        return {
          date: displayDate,
          qs: scoreMap.get(dateStr) || 0
        };
      });
    }
  }, [scores, timeRange]);

  // Calculate trend (percentage change from previous day)
  const trend = useMemo(() => {
    if (data.length < 2) return 0;
    
    // Get the two most recent non-zero data points
    const nonZeroData = data.filter(d => d.qs > 0);
    if (nonZeroData.length < 2) return 0;
    
    // Get the two most recent data points
    const [previous, current] = nonZeroData.slice(-2);
    
    // Calculate percentage change: ((current - previous) / previous) * 10
    const change = (current.qs - previous.qs) * 10;
    
    return Number(change.toFixed(2));
  }, [data]);

  return (
    <div className="flex items-center space-x-2">
      <div style={{ width, height }} className="text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="qs"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
            />
            <XAxis dataKey="date" hide/>
            <YAxis  domain={[0, 10]} hide/>
            <Tooltip
              contentStyle={{ fontSize: '12px' }}
              formatter={(value: number) => [`${value.toFixed(1)}`, 'QS']}
              labelFormatter={(label) => `Date: ${label}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={`text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
      </div>
    </div>
  );
};

export default KeywordSparkline;
