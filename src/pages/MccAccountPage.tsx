import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useSubAccounts, useAccountScores } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './MccAccountPage.css';

// Custom components
const Container = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`container ${className}`}>{children}</div>
);

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`card ${className}`}>{children}</div>
);

const Badge = ({ 
  children, 
  variant = 'default',
  className = '' 
}: { 
  children: React.ReactNode; 
  variant?: 'enabled' | 'paused' | 'removed' | 'default';
  className?: string;
}) => (
  <span className={`badge badge-${variant} ${className}`}>
    {children}
  </span>
);

type Account = {
  id: string;
  name: string;
  accountId: string;
  status: string;
  scores?: Array<{ qs: number }>;
};

export const MccAccountPage = () => {
  const { mccId } = useParams<{ mccId: string }>();
  const navigate = useNavigate();
  const { data: accountData, isLoading: isLoadingAccount } = useAccount(mccId || '');
  const { data: subAccountData, isLoading: isLoadingSubAccounts } = useSubAccounts(mccId || '');
  const { data: scoresData, isLoading: isLoadingScores } = useAccountScores(mccId || '', 7); // Last 7 days

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ENABLED': return 'enabled';
      case 'PAUSED': return 'paused';
      case 'REMOVED': return 'removed';
      default: return 'default';
    }
  };

  if (isLoadingAccount || isLoadingScores || isLoadingSubAccounts) {
    return (
      <Container>
        <h2 className="page-title">Loading account data...</h2>
        <div className="skeleton" style={{ height: '200px' }}></div>
      </Container>
    );
  }

  const account = accountData?.data;
  const subAccounts = subAccountData?.data?.subAccounts;
  const scores = scoresData?.data?.scores || [];

  if (!account) {
    return (
      <Container>
        <h2 className="page-title">Account not found</h2>
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/')}
        >
          Back to Dashboard
        </button>
      </Container>
    );
  }

  // Prepare data for the chart
  const chartData = scores.map(score => ({
    date: new Date(score.date).toLocaleDateString(),
    qs: score.qs,
  }));

  // Get top 5 accounts by QS
  const topAccounts: Account[] = subAccounts
    ? [...subAccounts]
        .sort((a, b) => (b.scores?.[0]?.qs || 0) - (a.scores?.[0]?.qs || 0))
        .slice(0, 5)
    : [];

  return (
    <Container>
      <h1 className="page-title">{account.name}</h1>

      <div className="grid">
        <Card>
          <p className="text-muted">Status</p>
          <div className="flex items-center mt-1">
            <span className={`status-dot ${getStatusVariant(account.status)}`}></span>
            <span className="ml-2">{account.status}</span>
          </div>
        </Card>

        <Card>
          <p className="text-muted">Sub Accounts</p>
          <h3 className="text-xl font-semibold">
            {subAccounts?.length || 0}
          </h3>
        </Card>
      </div>

      <h2 className="section-title">Quality Score History</h2>
      <Card className="chart-container">
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis 
                domain={[0, 10]} 
                tickCount={11}
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="qs" 
                stroke="#4f46e5" 
                strokeWidth={2}
                dot={{ r: 2, fill: '#4f46e5' }}
                activeDot={{ r: 4, fill: '#4338ca', stroke: '#fff', strokeWidth: 2 }}
                name="Quality Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <h2 className="section-title">Top Performing Sub Accounts</h2>
      <Card>
        <div className="account-list">
          {topAccounts.length > 0 ? (
            topAccounts.map((subAccount) => (
              <div 
                key={subAccount.id} 
                className="account-item"
                onClick={() => navigate(`/sub-accounts/${subAccount.id}`)}
              >
                <div className="account-info">
                  <span className="account-name">{subAccount.name}</span>
                  <div className="account-details">
                    <span>{subAccount.accountId}</span>
                    <Badge variant={getStatusVariant(subAccount.status) as any}>
                      {subAccount.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-blue-600 font-medium">
                  QS: {subAccount.scores?.[0]?.qs?.toFixed(1) || 'N/A'}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted italic">No sub accounts found</p>
          )}
        </div>
      </Card>
    </Container>
  );
};

export default MccAccountPage;
