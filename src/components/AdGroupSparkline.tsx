import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { AdGroupScoreDto } from '../types/api.types';
import { format, parse, subDays, isWithinInterval, addDays, startOfWeek } from 'date-fns';

interface AdGroupSparklineProps {
  scores: AdGroupScoreDto[];
  width?: number | string;
  height?: number;
  timeRange?: number; // in days
  onClick?: () => void;
}

export const AdGroupSparkline: React.FC<AdGroupSparklineProps> = ({
  scores = [],
  width = 500,
  height = 30,
  timeRange = 7, // default to 7 days
  onClick
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

  // Calculate trend (simple difference between first and last non-zero score)
  const trend = useMemo(() => {
    const nonZeroData = data.filter(d => d.qs > 0);
    if (nonZeroData.length < 2) return 0;
    
    const firstNonZero = nonZeroData[0];
    const lastNonZero = nonZeroData[nonZeroData.length - 1];
    
    return ((lastNonZero.qs - firstNonZero.qs) / (firstNonZero.qs || 1)) * 100;
  }, [data]);

  // Get the latest non-zero score for display
  const latestScore = useMemo(() => {
    const nonZeroScores = data.filter(d => d.qs > 0);
    return nonZeroScores.length > 0 ? nonZeroScores[nonZeroScores.length - 1].qs : 0;
  }, [data]);

  return (
    <div className="flex items-center justify-between w-full">
      <div style={{ width: 'calc(100% - 80px)', height }} className="text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
      <div className="flex items-center ml-2">
        <span className="text-sm font-medium text-gray-700 mr-2">
          {latestScore.toFixed(1)}
        </span>
        <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default AdGroupSparkline;
