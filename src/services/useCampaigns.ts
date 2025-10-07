import { useQuery } from '@tanstack/react-query';
import { CampaignDto } from '../types/api.types';
import { fetchApi } from './api';

interface GetCampaignsResponse {
  campaigns: CampaignDto[];
  total: number;
}

interface UseCampaignsOptions {
  enabled?: boolean;
}

export const useCampaigns = (
  accountId: string,
  options: UseCampaignsOptions = { enabled: true }
) => {
  return useQuery<GetCampaignsResponse, Error>({
    queryKey: ['campaigns', accountId],
    queryFn: async () => {
      return fetchApi<GetCampaignsResponse>(`/accounts/${accountId}/campaigns`);
    },
    enabled: options.enabled && !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
