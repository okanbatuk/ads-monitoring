import { useMemo, useState } from 'react';
import { Container, Title, Tabs, Card, Text } from '@mantine/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useGlobalScores } from '../services/api';

const timeRanges = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

export function DashboardPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useGlobalScores(days);

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((item) => ({
      date: new Date(item.date).toLocaleDateString(),
      qs: item.qs,
      accountCount: item.accountCount,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Title order={2} mb="md">Loading dashboard...</Title>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Title order={2} styles={{ root: { color: "red" } }} mb="md">
          Error loading dashboard data
        </Title>
        <Text c="dimmed">{error.message}</Text>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Title order={2} mb="md">Global Performance</Title>

      <Tabs
        value={days.toString()}
        onChange={(value) => setDays(Number(value))}
        mb="xl"
      >
        <Tabs.List>
          {timeRanges.map((range) => (
            <Tabs.Tab key={range.value} value={range.value}>
              {range.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Title order={4} mb="md">Quality Score Trend</Title>
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="qs"
                name="Average QS"
                stroke="#4dabf7"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {data?.data && data.data.length > 0 && (
        <Card shadow="sm" p="lg" radius="md" mt="md" withBorder>
          <Title order={4} mb="md">Summary</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <Text size="sm" c="dimmed">Average QS</Text>
              <Text size="xl" styles={{ root: { fontWeight: 700 } }}>
                {(
                  data.data.reduce((sum, item) => sum + item.qs, 0) / data.data.length
                ).toFixed(2)}
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Total Accounts</Text>
              <Text size="xl" styles={{ root: { fontWeight: 700 } }}>
                {Math.max(...data.data.map((item) => item.accountCount))}
              </Text>
            </div>
          </div>
        </Card>
      )}
    </Container>
  );
}

export default DashboardPage;
