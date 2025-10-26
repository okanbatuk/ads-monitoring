import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { CampaignScoreDto } from "../types/api.types";
import {
  format,
  parse,
  subDays,
  addDays,
  startOfWeek,
  isSameWeek,
  isValid,
} from "date-fns";
import { useTheme } from "@/contexts/ThemeProvider";

interface CampaignSparklineProps {
  scores: CampaignScoreDto[];
  width?: number | string;
  height?: number;
  timeRange?: number; // in days
  showTrend?: boolean;
}

export const CampaignSparkline: React.FC<CampaignSparklineProps> = ({
  scores = [],
  width = "100%",
  height = 30,
  timeRange = 7,
}) => {
  const { theme } = useTheme();
  // Process data based on timeRange
  const { data } = useMemo<{
    data: { date: string; qs: number; adGroupCount: number }[];
  }>(() => {
    const now = new Date();
    const startDate = subDays(now, timeRange - 1);

    // Create a map of date strings to scores for easy lookup
    const scoreMap = new Map<string, { qs: number; adGroupCount: number }>();
    scores.forEach((score) => {
      try {
        const date = parse(score.date, "dd.MM.yyyy", new Date());
        if (isValid(date)) {
          scoreMap.set(format(date, "yyyy-MM-dd"), {
            qs: score.qs,
            adGroupCount: score.adGroupCount,
          });
        }
      } catch (e) {
        console.warn("Invalid date in sparkline data:", score.date);
      }
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
        adGroupCount: number;
      }[] = [];

      dateArray.forEach((date) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        const existingWeek = weeklyData.find((w) =>
          isSameWeek(w.date, weekStart, { weekStartsOn: 1 }),
        );

        const dateStr = format(date, "yyyy-MM-dd");
        const data = scoreMap.get(dateStr) || { qs: 0, adGroupCount: 0 };

        if (existingWeek) {
          existingWeek.qs += data.qs;
          existingWeek.count++;
          data.adGroupCount > 0 && (existingWeek.adGroupCount = data.adGroupCount);
        } else {
          let count = 0
          data.adGroupCount > 0 && (count = data.adGroupCount);
          weeklyData.push({
            date: weekStart,
            qs: data.qs,
            adGroupCount: count,
            count: 1,
          });
        }
      });

      // Process weekly data
      const processedData = weeklyData.map((week) => ({
        date: format(week.date, "MMM d"),
        qs: week.count > 0 ? week.qs / week.count : 0,
        adGroupCount: week.adGroupCount,
      }));

      // Calculate average and trend
      const nonZeroData = processedData.filter((d) => d.qs > 0);
      const avg =
        nonZeroData.length > 0
          ? nonZeroData.reduce((sum, d) => sum + d.qs, 0) / nonZeroData.length
          : 0;

      let trend = 0;
      if (nonZeroData.length > 1) {
        const firstValue = nonZeroData[0].qs;
        const lastValue = nonZeroData[nonZeroData.length - 1].qs;
        trend =
          firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
      }

      return { data: processedData, avgQs: avg, trend };
    }

    // For time ranges <= 30 days, show daily data
    const processedData = dateArray.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const displayDate = format(date, "MMM d");

      return {
        date: displayDate,
        qs: (scoreMap.get(dateStr) || { qs: 0, adGroupCount: 0 }).qs,
        adGroupCount: (scoreMap.get(dateStr) || { qs: 0, adGroupCount: 0 })
          .adGroupCount,
      };
    });

    // Calculate average and trend for daily data
    const nonZeroData = processedData.filter((d) => d.qs > 0);
    const avg =
      nonZeroData.length > 0
        ? nonZeroData.reduce((sum, d) => sum + d.qs, 0) / nonZeroData.length
        : 0;

    let trend = 0;
    if (nonZeroData.length > 1) {
      const firstValue = nonZeroData[0].qs;
      const lastValue = nonZeroData[nonZeroData.length - 1].qs;
      trend =
        firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    }

    return { data: processedData, avgQs: avg, trend };
  }, [scores, timeRange]);

  if (!scores || scores.length === 0) {
    return (
      <div
        className="text-xs text-gray-400 text-center"
        style={{ width, height }}
      >
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
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, 10]} />
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
                      className={`space-y-1.5 p-3 rounded-lg backdrop-blur-sm bordershadow-sm ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50/95 border-gray-100"}`}
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
                          Ad Groups
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {payload[0].payload.adGroupCount}
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

export default CampaignSparkline;
