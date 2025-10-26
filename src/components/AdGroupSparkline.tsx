import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { AdGroupScoreDto } from '../types/api.types';
import { format, parse, subDays, isWithinInterval, addDays, startOfWeek } from 'date-fns';
import { useTheme } from '../contexts/ThemeProvider';

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
  timeRange = 7,
}) => {
  const { theme } = useTheme();

  if (!scores || scores.length === 0) {
    return (
      <div className={`text-xs text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} style={{ width, height }}>
        No data
      </div>
    );
  }

  // Process data based on timeRange
  const data = useMemo(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);
    
    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, {qs: number, keywordCount: number}>();
    scores.forEach(score => {
      const date = parse(score.date, 'dd.MM.yyyy', new Date());
      if (isWithinInterval(date, { start: startDate, end: now })) {
        scoreMap.set(format(date, 'yyyy-MM-dd'), {qs: score.qs, keywordCount: score.keywordCount});
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
        const data = scoreMap.get(dateStr) || {qs: 0, keywordCount: 0};
        
        if (!weekGroups.has(weekStart)) {
          weekGroups.set(weekStart, { sum: 0, count: 0 });
        }
        
        const group = weekGroups.get(weekStart)!;
        group.sum += data.qs;
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
          qs: (scoreMap.get(dateStr) || {qs: 0, keywordCount: 0}).qs
        };
      });
    }
  }, [scores, timeRange]);


  // Get the latest non-zero score for display
  const latestScore = useMemo(() => {
    const nonZeroScores = data.filter(d => d.qs > 0);
    return nonZeroScores.length > 0 ? nonZeroScores[nonZeroScores.length - 1].qs : 0;
  }, [data]);

  return (
    <div className="flex items-center justify-between w-full">
      <div style={{ width, height }} className="text-xs">
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
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const qsValue = Number(payload[0].value);
                  const displayQs = qsValue.toFixed(1);
                  const isDark = theme === "dark";
                  return (
                    <div
                      className={`space-y-1.5 p-3 rounded-lg backdrop-blur-sm border shadow-sm ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50/95 border-gray-100"}`}
                      style={{
                        boxShadow: isDark
                          ? "0 4px 20px -5px rgba(0, 0, 0, 0.2)"
                          : "0 4px 20px -5px rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <div className="flex items-center justify-between space-x-4">
                        <span
                          className={`text-sm ${
                            isDark ? "text-gray-300" : "text-gray-500"
                          }`}
                        >
                          {payload[0].payload.date}
                        </span>
                      </div>
                      <div className="flex items-center justify-between space-x-4">
                        <span
                          className={`text-sm ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Quality Score
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            qsValue >= 7
                              ? isDark
                                ? "text-green-400"
                                : "text-green-600"
                              : qsValue >= 4
                                ? isDark
                                  ? "text-yellow-400"
                                  : "text-yellow-600"
                                : isDark
                                  ? "text-red-400"
                                  : "text-red-600"
                          }`}
                        >
                          {displayQs}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
              contentStyle={{
                background: "transparent",
                border: "none",
                boxShadow: "none",
                padding: 0,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdGroupSparkline;
