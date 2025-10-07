import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Title, Tabs, Card, Text, SimpleGrid, Badge, LoadingOverlay } from '@mantine/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAccount, useAccountScores, useAccountCampaigns } from '../services/api';
import { AccountScoreDto } from '../types/api.types';

const timeRanges = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

export function AccountPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [days, setDays] = useState(7);
  
  const { data: account, isLoading: isLoadingAccount } = useAccount(accountId || '');
  const { data: scores, isLoading: isLoadingScores } = useAccountScores(accountId || '', days);
  const { data: campaigns, isLoading: isLoadingCampaigns } = useAccountCampaigns(accountId || '');

  const isLoading = isLoadingAccount || isLoadingScores || isLoadingCampaigns;

  const chartData = useMemo(() => {

    if (!scores?.data) return [];
    return scores.data.scores.map((item: AccountScoreDto) => ({
      date: new Date(item.date).toLocaleDateString(),
      qs: item.qs,
      campaignCount: item.campaignCount,
    }));
  }, [scores]);

  const campaignScores = useMemo(() => {
    if (!campaigns?.data?.campaigns) return [];
    return campaigns.data.campaigns
      .map(campaign => ({
        name: campaign.name,
        qs: campaign.scores?.[0]?.qs ?? 0, // Use the first score if available
        status: campaign.status,
      }))
      .sort((a, b) => b.qs - a.qs)
      .slice(0, 10); // Top 10 campaigns by QS
  }, [campaigns]);

  if (!accountId) {
    return (
      <Container size="lg" py="xl">
        <Title order={2} c="red">Error: No account ID provided</Title>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl" style={{ position: 'relative' }}>
      <LoadingOverlay visible={isLoading} />
      
      <Title order={2} mb="md">
        {account?.data?.name || 'Account Details'}
      </Title>
      {account?.data?.status && (
        <Badge 
          color={account.data.status === 'ENABLED' ? 'green' : 'red'} 
          ml="sm" 
          variant="outline"
        >
          {account.data.status}
        </Badge>
      )}

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

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Title order={4} mb="md">Quality Score Trend</Title>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="qs" 
                    stroke="#4dabf7" 
                    name="Quality Score" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Text c="dimmed" ta="center" my="xl">
              Select a time range to view quality score trends
            </Text>
          )}
        </Card>
        
        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Title order={4} mb="md">Top Campaigns by QS</Title>
          {campaignScores.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={campaignScores}
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 10]} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={90}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qs" fill="#4dabf7" name="Quality Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Text c="dimmed" ta="center" my="xl">
              No campaign data available
            </Text>
          )}
        </Card>
      </SimpleGrid>

      <Card shadow="sm" p="lg" radius="md" withBorder>
        <Title order={4} mb="md">Account Summary</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
          <div>
            <Text size="sm" c="dimmed">Account ID</Text>
            <Text fw={500}>{accountId}</Text>
          </div>
          {scores?.data && scores.data.scores.length > 0 && (
            <>
              <div>
                <Text size="sm" c="dimmed">Current QS</Text>
                <Text fw={500} size="lg">
                  {scores.data.scores[scores.data.scores.length - 1].qs.toFixed(1)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Campaigns</Text>
                <Text fw={600} size="lg">
                  {campaigns?.data?.total || 0}
                </Text>
              </div>
            </>
          )}
        </SimpleGrid>
      </Card>
    </Container>
  );
}

export default AccountPage;
