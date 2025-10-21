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
            return redirect(`/mcc/${data.accounts[0].id}`);
          }
          return null;
        },
        element: <GlobalDashboard />,
      },
      {
        path: 'mcc/:mccId',
        element: <MccAccountPage />,
      },
      {
        path: 'mcc/:mccId/sub/:subAccountId',
        element: <MccSubAccountPage />,
      },
      {
        path: 'accounts/:accoundId/campaigns/:campaignId',
        element: <CampaignPage />,
      },
      {
        path: 'campaigns/:campaignId/adgroups/:adGroupId',
        element: <AdGroupPage />,
      },
      {
        path: 'adgroups/:adGroupId/keywords/:keywordId',
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
