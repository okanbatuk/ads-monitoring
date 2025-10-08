import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { CampaignScoreDto } from '../types/api.types';

interface CampaignSparklineProps {
  scores: CampaignScoreDto[];
  width?: number | string;
  height?: number;
  showTrend?: boolean;
}

export const CampaignSparkline: React.FC<CampaignSparklineProps> = ({ 
  scores = [], 
  width = 500, 
  height = 30,
  showTrend = true
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

  // Calculate average QS
  const avgQs = scores.length > 0 
    ? scores.reduce((sum, score) => sum + score.qs, 0) / scores.length 
    : 0;

  // Calculate trend (simple difference between first and last score)
  const trend = data.length > 1 
    ? ((data[data.length - 1].qs - data[0].qs) / (data[0].qs || 1)) * 100 
    : 0;

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
      {showTrend && (
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{avgQs.toFixed(1)}</span>
          <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default CampaignSparkline;
