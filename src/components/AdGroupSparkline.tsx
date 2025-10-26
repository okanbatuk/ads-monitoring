import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { AdGroupScoreDto } from '../types/api.types';
import { format, parse, subDays, addDays, startOfWeek, isSameWeek } from 'date-fns';
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
      const dateStr = format(date, 'yyyy-MM-dd');
      scoreMap.set(dateStr, {qs: score.qs, keywordCount: score.keywordCount});
    });

    // Generate array of all dates in the time range
    const dateArray = [];
    for (let i = 0; i < timeRange; i++) {
      dateArray.push(addDays(startDate, i));
    }

    // For time ranges > 30 days, group by week
    if (timeRange > 30) {
      const weeklyData: {
        date: Date;
        qs: number;
        count: number;
        keywordCount: number;
      }[] = [];

      dateArray.forEach((date) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const existingWeek = weeklyData.find((w) =>
          isSameWeek(w.date, weekStart, { weekStartsOn: 1 }),
        );

        const dateStr = format(date, "yyyy-MM-dd");
        const data = scoreMap.get(dateStr) || { qs: 0, keywordCount: 0 };

        if (existingWeek) {
          existingWeek.qs += data.qs;
          existingWeek.count++;
          data.keywordCount > 0 && (existingWeek.keywordCount = data.keywordCount);
        } else {
          weeklyData.push({
            date: weekStart,
            qs: data.qs,
            keywordCount: data.keywordCount,
            count: 1,
          });
        }
      });

      return weeklyData
        .sort((a, b) => format(a.date, "yyyy-MM-dd").localeCompare(format(b.date, "yyyy-MM-dd")))
        .map((week) => ({
          date: format(week.date, "MMM d"),
          qs: week.count > 0 ? week.qs / week.count : 0, // Weekly average
          keywordCount: week.keywordCount,
        }));
    } else {
      // For 7-30 days, show daily data
      return dateArray.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, timeRange <= 14 ? 'MMM d' : 'd MMM');
        const scoreData = scoreMap.get(dateStr) || {qs: 0, keywordCount: 0};
        return {
          date: displayDate,
          qs: scoreData.qs,
          keywordCount: scoreData.keywordCount
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
              dot={(props) => {
                const { cx, cy, payload } = props;
                const qsValue = payload.qs;
                // Show dot only for non-zero values (make zero dots invisible)
                if (qsValue === 0) {
                  return (
                    <circle
                      key={`dot-${payload.date}-${qsValue}`}
                      cx={cx}
                      cy={cy}
                      r={2}
                      fill="#3b82f6"
                      stroke={theme === "light" ? "#1e40af" : "#fff"}
                      strokeWidth={1}
                      opacity={0}
                    />
                  );
                }
                return (
                  <circle
                    key={`dot-${payload.date}-${qsValue}`}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill="#3b82f6"
                    stroke={theme === "light" ? "#1e40af" : "#fff"}
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={(props) => {
                const { cx, cy, payload } = props;
                const qsValue = payload.qs;
                // Show active dot only for non-zero values
                if (qsValue === 0) {
                  return (
                    <circle
                      key={`active-dot-${payload.date}-${qsValue}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#3b82f6"
                      stroke={theme === "light" ? "#1e40af" : "#fff"}
                      strokeWidth={2}
                      opacity={0}
                    />
                  );
                }
                return (
                  <circle
                    key={`active-dot-${payload.date}-${qsValue}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#3b82f6"
                    stroke={theme === "light" ? "#1e40af" : "#fff"}
                    strokeWidth={2}
                  />
                );
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
              position={{
                y: -40,
              }}
              offset={10}
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
                      <div className="flex items-center justify-between space-x-4">
                        <span
                          className={`text-sm ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Keywords:
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {payload[0].payload.keywordCount}
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
