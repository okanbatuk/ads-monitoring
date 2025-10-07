import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api';
import { Campaign } from '../types/api.types';

export const useCampaign = (campaignId: string) => {
  return useQuery<Campaign, Error>({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      return fetchApi<Campaign>(`/campaigns/${campaignId}`);
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
