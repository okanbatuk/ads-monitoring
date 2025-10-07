import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useGlobalScores } from '../services/api';

const GlobalDashboard: React.FC = () => {
  const { data: globalScores, isLoading, error } = useGlobalScores(7);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 px-6">
        <p className="text-red-500 text-xl mt-3 mb-2">
          Error loading dashboard data
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error.message}
        </p>
      </div>
    );
  }

  // Transform data for the chart - only using available properties from GlobalScoreDto
  const chartData = globalScores?.data?.map(score => ({
    date: new Date(score.date).toLocaleDateString(),
    qs: score.qs,
    // Note: impressions, clicks, and ctr are not available in GlobalScoreDto
    // so we'll use 0 as a fallback for the chart
    impressions: 0,
    clicks: 0,
    ctr: 0,
  })) || [];

  // Calculate averages - only using available properties
  const averageQs = globalScores?.data?.length 
    ? (globalScores.data.reduce((sum, score) => sum + score.qs, 0) / globalScores.data.length).toFixed(2) 
    : 'N/A';
    
  // These metrics aren't available in the DTO, so we'll show N/A or 0
  const averageCtr = 'N/A';
  const totalImpressions = '0';
  const totalClicks = '0';

  return (
    <div className="w-full">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Global Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="pb-2">
            <p className="text-sm text-gray-500">Average QS</p>
          </div>
          <div className="py-2">
            <p className="text-2xl font-bold">{averageQs}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="pb-2">
            <p className="text-sm text-gray-500">Average CTR</p>
          </div>
          <div className="py-2">
            <p className="text-2xl font-bold">{averageCtr}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="pb-2">
            <p className="text-sm text-gray-500">Total Impressions</p>
          </div>
          <div className="py-2">
            <p className="text-2xl font-bold">{totalImpressions}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="pb-2">
            <p className="text-sm text-gray-500">Total Clicks</p>
          </div>
          <div className="py-2">
            <p className="text-2xl font-bold">{totalClicks}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Quality Score Trend</h2>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="qs" 
                name="Quality Score" 
                stroke="#3182ce" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Engagement Metrics</h2>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" orientation="left" stroke="#3182ce" />
              <YAxis yAxisId="right" orientation="right" stroke="#38a169" />
              <Tooltip />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="impressions" 
                name="Impressions" 
                stroke="#3182ce" 
                strokeWidth={2}
                dot={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="clicks" 
                name="Clicks" 
                stroke="#38a169" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalDashboard;
