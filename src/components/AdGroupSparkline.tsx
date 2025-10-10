import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { AdGroupScoreDto } from '../types/api.types';

interface AdGroupSparklineProps {
  scores: AdGroupScoreDto[];
  width?: number | string;
  height?: number;
  onClick?: () => void;
}

export const AdGroupSparkline: React.FC<AdGroupSparklineProps> = ({ 
  scores = [], 
  width = 500, 
  height = 30,
  onClick
}) => {
  if (!scores || scores.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center" style={{ width, height }}>
        No data
      </div>
    );
  }

  // Sort scores by date
  const sortedScores = [...scores].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Format data for the chart
  const data = sortedScores.map(score => ({
    date: new Date(score.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
    qs: score.qs,
  }));

  // Calculate trend (simple difference between first and last score)
  const trend = data.length > 1 
    ? ((data[data.length - 1].qs - data[0].qs) / (data[0].qs || 1)) * 100 
    : 0;

  return (
    <div className="flex items-center space-x-2 w-full">
      <div style={{ width, height }} className="text-xs flex-grow">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line 
              type="monotone" 
              dataKey="qs" 
              stroke="#3b82f6" 
              dot={false} 
              strokeWidth={2} 
            />
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, 10]} />
            <Tooltip 
              contentStyle={{ fontSize: '12px' }}
              formatter={(value: number) => [`${value.toFixed(1)}`, 'QS']}
              labelFormatter={(label) => `Date: ${label}`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={`text-sm font-medium min-w-[60px] text-right ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
      </div>
    </div>
  );
};

export default AdGroupSparkline;
