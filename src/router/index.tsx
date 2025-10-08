import { createBrowserRouter, Outlet } from 'react-router-dom';
import MainLayout from '../layout/MainLayout';
import GlobalDashboard from '../pages/GlobalDashboard';
import CampaignPage from '../pages/CampaignPage';
import MccAccountPage from '../pages/MccAccountPage';
import MccSubAccountPage from '../pages/MccSubAccountPage';
import NotFound from '../pages/NotFound';
import AdGroupPage from '../pages/AdGroupPage';
import KeywordPage from '../pages/KeywordPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout><Outlet /></MainLayout>,
    errorElement: <MainLayout><NotFound /></MainLayout>,
    children: [
      {
        index: true,
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
