import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAccount, useAccountScores, useAccountCampaigns, useMccAccounts } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import type { GetAccountResponse } from '../types/api.types';

// Import CSS for styling
import './MccSubAccountPage.css';

// Custom icons as React components
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

interface Campaign {
  id: string;
  name: string;
  status: string;
  scores?: Array<{ qs: number }>;
}

interface Score {
  date: string;
  qs: number;
}

// Status color mapping
const statusColors = {
  ENABLED: 'status-enabled',
  PAUSED: 'status-paused',
  REMOVED: 'status-removed',
  UNKNOWN: 'status-unknown',
} as const;

// Helper component for loading skeleton
const Skeleton = ({ width = '100%', height = '1rem', className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height }}
  />
);

// Helper function to get quality score color class
const getQualityScoreColorClass = (score: number): string => {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-500';
  if (score >= 4) return 'text-orange-500';
  return 'text-red-600';
};

// Helper component for buttons
const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  leftIcon,
  rightIcon,
  fullWidth = false,
}: {
  children: React.ReactNode;
  onClick?: (() => void | Promise<void>) | (() => Promise<any>);
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const sizeMap = {
    sm: 'sm',
    small: 'sm',
    md: 'md',
    medium: 'md',
    lg: 'lg',
    large: 'lg',
  };
  const normalizedSize = sizeMap[size as keyof typeof sizeMap] || 'md';
  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-blue-500',
  };

  return (
    <button
      type={type}
      onClick={onClick as any}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[normalizedSize as keyof typeof sizeStyles]} ${variantStyles[variant as keyof typeof variantStyles]
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${fullWidth ? 'w-full' : ''
        } ${className}`}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

// Alert component props interface
interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'success' | 'warning' | 'info';
  title?: string;
  className?: string;
}

// Helper component for alerts
const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'error',
  title,
  className = ''
}) => (
  <div className={`alert alert-${variant} ${className}`}>
    <span className="alert-icon">
      <AlertCircleIcon />
    </span>
    <div>
      {title && <h4 className="alert-title">{title}</h4>}
      <div className="alert-content">{children}</div>
    </div>
  </div>
);

// Helper component for cards
const Card = ({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) => (
  <div className={`card ${className}`}>
    {title && <h3 className="card-title">{title}</h3>}
    {children}
  </div>
);

// Helper component for badges
const Badge: React.FC<{ children: React.ReactNode; color?: string; className?: string }> = ({
  children,
  color = 'default',
  className = ''
}) => (
  <span className={`status-badge ${color} ${className}`}>
    {children}
  </span>
);

// Main container component
const Container: React.FC<{ children: React.ReactNode; className?: string; size?: string }> = ({ children, className = '', size = 'xl' }) => (
  <div className={`mcc-account-container ${className}`}>
    {children}
  </div>
);

// Stack layout component
const Stack: React.FC<{ children: React.ReactNode; spacing?: string; className?: string }> = ({ children, spacing = 'md', className = '' }) => {
  const spacingClass = `stack-${spacing}`;
  return <div className={`stack ${spacingClass} ${className}`}>{children}</div>;
};

// Group layout component
const Group: React.FC<{ children: React.ReactNode; position?: string; className?: string; spacing?: string }> = ({ children, position = 'left', className = '', spacing = 'md' }) => {
  const positionClass = `group-${position}`;
  const spacingClass = `group-spacing-${spacing}`;
  return (
    <div className={`group ${positionClass} ${spacingClass} ${className}`}>
      {children}
    </div>
  );
};

export const MccSubAccountPage = () => {
  const params = useParams<{ subAccountId: string }>();
  const subAccountId = params?.subAccountId;
  const location = useLocation();
  const navigate = useNavigate();

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Fetch account data
  const {
    data: accountData,
    isLoading: isLoadingAccount,
    error: accountError,
    isError: isAccountError,
    refetch: refetchAccount
  } = useAccount(subAccountId || '');

  // Fetch MCC accounts data
  const {
    data: mccAccountsData,
    isLoading: isLoadingMccAccounts,
    error: mccAccountsError,
    refetch: refetchMccAccounts
  } = useMccAccounts();

  // Fetch scores and campaigns
  const {
    data: scoresData,
    isLoading: isLoadingScores,
    error: scoresError,
    isError: isScoresError,
    refetch: refetchScores
  } = useAccountScores(subAccountId || '', 30);

  const {
    data: campaignsData,
    isLoading: isLoadingCampaigns,
    error: campaignsError,
    isError: isCampaignsError,
    refetch: refetchCampaigns
  } = useAccountCampaigns(subAccountId || '');

  // Helper function to safely extract error message
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'An unknown error occurred';
  };

  // If we don't have an ID, show an error
  if (!subAccountId) {
    return (
      <Container>
        <Alert
          variant="error"
          title="Error"
          className="mb-2"
        >
          No account ID provided
        </Alert>
        <Button
          onClick={() => navigate('/')}
          variant="secondary"
          leftIcon={<ArrowLeftIcon />}
        >
          Go to Dashboard
        </Button>
      </Container>
    );
  }

  // Find the account in the MCC accounts if not found as a sub-account
  const mccAccount = mccAccountsData?.data?.accounts?.find(
    (acc: any) => acc.id === subAccountId || acc.accountId === subAccountId
  );

  // Use the account from either source
  const account = accountData?.data || mccAccount;
  const scores = scoresData?.data?.scores || [];
  const campaigns = campaignsData?.data?.campaigns || [];

  // Show loading state
  if (isLoadingAccount || isLoadingMccAccounts) {
    return (
      <Container>
        <Stack spacing="md">
          <Skeleton width="100%" height="24px" />
          <Skeleton width="80%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="70%" height="16px" />
        </Stack>
      </Container>
    );
  }

  // Show error state
  if (isAccountError || mccAccountsError) {
    const errorMessage =
      (accountError && getErrorMessage(accountError)) ||
      (mccAccountsError && getErrorMessage(mccAccountsError)) ||
      'Failed to load account data';

    return (
      <Container>
        <Alert
          variant="error"
          title="Error Loading Account Data"
          className="mb-2"
        >
          {errorMessage}
        </Alert>
        <Group>
          <Button
            onClick={() => isAccountError ? refetchAccount() : refetchMccAccounts()}
            variant="secondary"
            leftIcon={<RefreshIcon />}
          >
            Retry
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
          >
            Go to Dashboard
          </Button>
        </Group>
      </Container>
    );
  }

  // If no account found, show not found state
  if (!account) {
    return (
      <Container>
        <Alert
          variant="warning"
          title="Account Not Found"
          className="mb-2"
        >
          The requested account could not be found. It may have been removed or you may not have permission to view it.
        </Alert>
        <Button
          onClick={() => navigate('/')}
          variant="secondary"
          leftIcon={<ArrowLeftIcon />}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  // Extract account details with fallbacks
  const accountName = account.name || 'Unnamed Account';
  const accountId = account.id || account.accountId || 'N/A';
  const status = account.status || 'UNKNOWN';

  // Show loading states for scores and campaigns
  if (isLoadingScores || isLoadingCampaigns) {
    return (
      <Container>
        <h2 className="account-title">{accountName}</h2>
        <p className="text-muted">Loading account data...</p>
        <div className="grid">
          <div className="skeleton" style={{ height: '300px' }} />
          <div className="skeleton" style={{ height: '200px' }} />
        </div>
      </Container>
    );
  }

  // Show error states for scores and campaigns
  if (isScoresError || isCampaignsError) {
    const errorMessage =
      (scoresError && getErrorMessage(scoresError)) ||
      (campaignsError && getErrorMessage(campaignsError)) ||
      'Failed to load some data. Please try refreshing the page.';

    return (
      <Container>
        <h2 className="account-title">{accountName}</h2>
        <Alert
          variant="error"
          title="Error loading data"
          className="mb-2"
        >
          {errorMessage}
          <div className="mt-2">
            <Button
              onClick={() => {
                if (isScoresError) refetchScores();
                if (isCampaignsError) refetchCampaigns();
              }}
              variant="secondary"
              leftIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  // Prepare data for the chart
  const chartData = scores ? scores.map((score: Score) => ({
    date: new Date(score.date).toLocaleDateString(),
    qs: score.qs,
  })) : [];

  // Get top 5 campaigns by QS
  const topCampaigns = campaigns
    ? [...campaigns].sort((a: Campaign, b: Campaign) => {
      const aScore = a.scores?.[0]?.qs || 0;
      const bScore = b.scores?.[0]?.qs || 0;
      return bScore - aScore;
    }).slice(0, 5)
    : [];

  return (
    <Container>
      <div className="account-header">
        <div>
          <h1 className="account-title">{accountName}</h1>
          <p className="account-subtitle">Account ID: {accountId}</p>
        </div>
        <div className="button-group">
          <Badge
            color={statusColors[status ? status.toUpperCase() as keyof typeof statusColors : "UNKNOWN"]}
            className="status-badge"
          >
            {status}
          </Badge>
          <Button
            variant="primary"
            onClick={() => {
              refetchAccount();
              refetchMccAccounts();
              refetchScores();
              refetchCampaigns();
            }}
            leftIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <p className="text-muted mb-1">Account Status</p>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${statusColors[status as keyof typeof statusColors] || 'status-unknown'}`}></span>
            <span className="font-medium">
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

      </div>

      <div className="card mt-4">
        <h3 className="text-xl font-medium mb-4">Top Campaigns by Quality Score</h3>
        {topCampaigns.length > 0 ? (
          <div className="campaigns-grid">
            {topCampaigns.map((campaign: Campaign) => (
              <div key={campaign.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{campaign.name}</h4>
                  <Badge
                    color={statusColors[campaign.status as keyof typeof statusColors] || 'UNKNOWN'}
                    className="status-badge"
                  >
                    {campaign.status}
                  </Badge>
                </div>

                <hr className="my-3 border-gray-200" />

                <div className="flex items-center gap-2 text-sm text-muted mb-3">
                  <span>
                    QS: <span className={`font-semibold ${getQualityScoreColorClass(campaign.scores?.[0]?.qs || 0)}`}>
                      {campaign.scores?.[0]?.qs?.toFixed(1) || 'N/A'}
                    </span>
                  </span>
                  <span>•</span>
                  {/* <span>
                    Campaigns: <span className="font-semibold">{campaign.campaignCount || 0}</span>
                  </span> */}
                </div>

                <Button
                  variant="secondary"
                  size="small"
                  fullWidth
                  rightIcon={<ArrowRightIcon />}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  View Details
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted italic">No campaign data available</p>
        )}
      </div>
    </Container>
  );
};

export default MccSubAccountPage;
