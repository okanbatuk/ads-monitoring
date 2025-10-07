import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api';
import { GetCampaignScoreResponse } from '@/types/api.types';


export const useCampaignScores = (campaignId: string, days: number) => {
  return useQuery<GetCampaignScoreResponse, Error>({
    queryKey: ['campaignScores', campaignId, days],
    queryFn: async () => {
      return fetchApi<GetCampaignScoreResponse>(`/campaigns/${campaignId}/scores?days=${days}`);
    },
    enabled: !!campaignId && !!days,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  });
};
