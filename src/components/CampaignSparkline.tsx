import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { CampaignScoreDto } from '../types/api.types';
import { format, parse, subDays, isWithinInterval, addDays, startOfWeek, isSameWeek, isValid } from 'date-fns';

interface CampaignSparklineProps {
  scores: CampaignScoreDto[];
  width?: number | string;
  height?: number;
  timeRange?: number; // in days
  showTrend?: boolean;
}

export const CampaignSparkline: React.FC<CampaignSparklineProps> = ({
  scores = [],
  width = '100%',
  height = 30,
  timeRange = 7,
}) => {
  // Process data based on timeRange
  const { data } = useMemo<{ data: { date: string; qs: number }[] }>(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);

    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, number>();
    scores.forEach(score => {
      try {
        const date = parse(score.date, 'dd.MM.yyyy', new Date());
        if (isValid(date)) {
          scoreMap.set(format(date, 'yyyy-MM-dd'), score.qs);
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
      const weeklyData: { date: Date; qs: number; count: number }[] = [];

      dateArray.forEach(date => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const existingWeek = weeklyData.find(w => isSameWeek(w.date, weekStart, { weekStartsOn: 1 }));

        const dateStr = format(date, 'yyyy-MM-dd');
        const qs = scoreMap.get(dateStr) || 0;

        if (existingWeek) {
          existingWeek.qs += qs;
          existingWeek.count++;
        } else {
          weeklyData.push({
            date: weekStart,
            qs,
            count: 1
          });
        }
      });

      // Process weekly data
      const processedData = weeklyData.map(week => ({
        date: format(week.date, 'MMM d'),
        qs: week.count > 0 ? week.qs / week.count : 0
      }));

      // Calculate average and trend
      const nonZeroData = processedData.filter(d => d.qs > 0);
      const avg = nonZeroData.length > 0
        ? nonZeroData.reduce((sum, d) => sum + d.qs, 0) / nonZeroData.length
        : 0;

      let trend = 0;
      if (nonZeroData.length > 1) {
        const firstValue = nonZeroData[0].qs;
        const lastValue = nonZeroData[nonZeroData.length - 1].qs;
        trend = firstValue !== 0
          ? ((lastValue - firstValue) / firstValue) * 100
          : 0;
      }

      return { data: processedData, avgQs: avg, trend };
    }

    // For time ranges <= 30 days, show daily data
    const processedData = dateArray.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const displayDate = timeRange <= 7
        ? format(date, 'EEE')
        : timeRange <= 14
          ? format(date, 'dd MMM')
          : format(date, 'MMM d');

      return {
        date: displayDate,
        qs: scoreMap.get(dateStr) || 0
      };
    });

    // Calculate average and trend for daily data
    const nonZeroData = processedData.filter(d => d.qs > 0);
    const avg = nonZeroData.length > 0
      ? nonZeroData.reduce((sum, d) => sum + d.qs, 0) / nonZeroData.length
      : 0;

    let trend = 0;
    if (nonZeroData.length > 1) {
      const firstValue = nonZeroData[0].qs;
      const lastValue = nonZeroData[nonZeroData.length - 1].qs;
      trend = firstValue !== 0
        ? ((lastValue - firstValue) / firstValue) * 100
        : 0;
    }

    return { data: processedData, avgQs: avg, trend };
  }, [scores, timeRange]);

  if (!scores || scores.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center" style={{ width, height }}>
        No data
      </div>
    );
  }

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
              contentStyle={{ fontSize: '12px' }}
              formatter={(value: number) => [`${value.toFixed(2)}`, 'QS']}
              labelFormatter={(label) => `Date: ${label}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CampaignSparkline;
