import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api';
import { AdGroupDto } from '../types/api.types';

export const useCampaignAdGroups = (campaignId: string) => {
  return useQuery<AdGroupDto[], Error>({
    queryKey: ['campaignAdGroups', campaignId],
    queryFn: async () => {
      return fetchApi<AdGroupDto[]>(`/campaigns/${campaignId}/adgroups`);
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
