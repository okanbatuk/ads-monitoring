import { createBrowserRouter, Outlet, redirect } from 'react-router-dom';
import MainLayout from '../layout/MainLayout';
import GlobalDashboard from '../pages/GlobalDashboard';
import CampaignPage from '../pages/CampaignPage';
import MccAccountPage from '../pages/MccAccountPage';
import MccSubAccountPage from '../pages/MccSubAccountPage';
import NotFound from '../pages/NotFound';
import AdGroupPage from '../pages/AdGroupPage';
import KeywordPage from '../pages/KeywordPage';
import { fetchApi } from '../services/api';
import { AccountDto } from '@/types/api.types';
import { ApiResponse } from '@/types';

// Function to fetch MCC accounts for the router loader
const fetchMccAccounts = async () => {
  try {
    const response:ApiResponse<{accounts:AccountDto[], total:number}> = await fetchApi<ApiResponse<{accounts:AccountDto[], total:number}> >('/accounts');
    return response?.data;
  } catch (error) {
    console.error('Failed to fetch MCC accounts:', error);
    return undefined;
  }
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout><Outlet /></MainLayout>,
    errorElement: <MainLayout><NotFound /></MainLayout>,
    children: [
      {
        index: true,
        loader: async () => {
          const data: {accounts: AccountDto[], total:number} | undefined = await fetchMccAccounts();
          if(!data){
            return null;
          }
          if (data?.total > 0) {
            const firstAccount = data.accounts[0];
            // Check account type: false = MCC account, true = sub-account
            if (firstAccount.type === false) {
              // It's an MCC account
              return redirect(`/manager/${firstAccount.id}`);
            } else {
              // It's a sub-account or individual account
              return redirect(`/account/${firstAccount.id}`);
            }
          }
          return null;
        },
        element: <GlobalDashboard />,
      },
      {
        path: 'manager/:mccId',
        element: <MccAccountPage />,
      },
      {
        path: 'account/:accountId',
        element: <MccSubAccountPage />,
      },
      {
        path: 'account/:accountId/campaign/:campaignId',
        element: <CampaignPage />,
      },
      {
        path: 'campaign/:campaignId/adgroup/:adGroupId',
        element: <AdGroupPage />,
      },
      {
        path: 'adgroup/:adGroupId/keyword/:keywordId',
        element: <KeywordPage />
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
