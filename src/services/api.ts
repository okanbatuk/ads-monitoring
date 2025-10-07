import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  // Global
  GetGlobalScoresResponse,
  // Account
  GetMccAccountsResponse,
  GetSubAccountsResponse,
  GetAccountResponse,
  GetAccountCampaignsResponse,
  AccountDto,
  GetAccountScoresResponse,
  PostAccountBulkScoresRequest,
  PostAccountBulkScoresResponse,
  // Campaign
  GetCampaignsResponse,
  GetCampaignResponse,
  GetCampaignAdGroupsResponse,
  PostCampaignBulkScoresRequest,
  PostCampaignBulkScoresResponse,
  GetCampaignScoreResponse,
  AdGroupDto,
  GetAdGroupResponse,
  GetAdGroupScoresResponse,
  KeywordDto,
  GetKeywordsResponse,
  GetKeywordResponse,
  GetKeywordScoresResponse,
  PostAdGroupBulkScoresRequest,
  PostAdGroupBulkScoresResponse,
} from '../types/api.types';

const API_BASE_URL = 'https://ads-script-api-production.up.railway.app/api'; // Update with your API base URL

export const fetchApi = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const requestId = Math.random().toString(36).substring(2, 9);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || `API request failed with status ${response.status}`
      );
      console.error(`[API] Error in request #${requestId}:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[API] Unhandled error in request #${requestId}:`, error);
    throw error;
  }
};

// Global endpoints
export const useGlobalScores = (days: number) => {
  return useQuery<GetGlobalScoresResponse>({
    queryKey: ['global', 'scores', days],
    queryFn: () => fetchApi<GetGlobalScoresResponse>(`/global?days=${days}`),
    enabled: !!days,
  });
};

// Account endpoints
export const useMccAccounts = () => {
  return useQuery<GetMccAccountsResponse>({
    queryKey: ['accounts', 'mcc'],
    queryFn: async () => {
      try {
        const url = `${API_BASE_URL}/accounts`;
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('[useMccAccounts] Error fetching MCC accounts:', error);
        throw error;
      } finally {
        console.groupEnd();
      }
    },
    retry: 3,
    retryDelay: 1000,
  });
};

interface SubAccountsApiResponse {
  data: {
    subAccounts: AccountDto[];
    total: number;
  };
  success: boolean;
  message?: string;
  statusCode?: number;
  timestamp?: string;
}

interface UseSubAccountsOptions {
  enabled?: boolean;
}

export const useSubAccounts = (accountId: string, options: UseSubAccountsOptions = {}) => {
  const { enabled = true } = options;
  
  return useQuery<SubAccountsApiResponse, Error>({
    queryKey: ['accounts', accountId, 'sub-accounts'],
    queryFn: async (): Promise<SubAccountsApiResponse> => {
      try {
        const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/accounts?include=true`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`[useSubAccounts] Error fetching sub-accounts for ${accountId}:`, error);
        throw error;
      }
    },
    enabled: !!accountId && enabled,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useAccount = (accountId: string) => {
  return useQuery<GetAccountResponse>({
    queryKey: ['accounts', accountId],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`[useAccount] Error fetching account ${accountId}:`, error);
        throw error;
      } finally {
        console.groupEnd();
      }
    },
    enabled: !!accountId,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useAccountCampaigns = (accountId: string) => {
  return useQuery<GetAccountCampaignsResponse>({
    queryKey: ['accounts', accountId, 'campaigns'],
    queryFn: async () => {
      try {
        const url = `${API_BASE_URL}/accounts/${accountId}/campaigns`;
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`[useAccountCampaigns] Error fetching campaigns for account ${accountId}:`, error);
        throw error;
      } finally {
        console.groupEnd();
      }
    },
    enabled: !!accountId,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useAccountScores = (accountId: string, days: number) => {
  return useQuery<GetAccountScoresResponse>({
    queryKey: ['accounts', accountId, 'scores', days],
    queryFn: async () => {
      try {
        const url = `${API_BASE_URL}/accounts/${accountId}/scores?days=${days}`;
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`[useAccountScores] Error fetching scores for account ${accountId}:`, error);
        throw error;
      } finally {
        console.groupEnd();
      }
    },
    enabled: !!accountId && !!days,
    retry: 3,
    retryDelay: 1000,
  });
};

export const useBulkAccountScores = () => {
  return useMutation<PostAccountBulkScoresResponse, Error, PostAccountBulkScoresRequest & { days: number }>({
    mutationFn: ({ ids, days }) => 
      fetchApi<PostAccountBulkScoresResponse>(`/accounts/bulkscores?days=${days}`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  });
};

// Campaign endpoints
export const useCampaign = (campaignId: string) => {
  return useQuery<GetCampaignResponse>({
    queryKey: ['campaigns', campaignId],
    queryFn: () => fetchApi<GetCampaignResponse>(`/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
};

export const useCampaignScores = (campaignId: string, days: number) => {
  return useQuery<GetCampaignScoreResponse>({
    queryKey: ['campaigns', campaignId, 'scores', days],
    queryFn: () => fetchApi<GetCampaignScoreResponse>(`/campaigns/${campaignId}/scores?days=${days}`),
    enabled: !!campaignId && !!days,
  });
};

export const useCampaignAdGroups = (campaignId: string) => {
  return useQuery<GetCampaignAdGroupsResponse>({
    queryKey: ['campaigns', campaignId, 'adgroups'],
    queryFn: () => fetchApi<GetCampaignAdGroupsResponse>(`/campaigns/${campaignId}/adgroups?include=true`),
    enabled: !!campaignId,
  });
};

export const useBulkCampaignScores = () => {
  return useMutation<PostCampaignBulkScoresResponse, Error, PostCampaignBulkScoresRequest & { days: number }>({
    mutationFn: ({ ids, days }) => 
      fetchApi<PostCampaignBulkScoresResponse>(`/campaigns/bulkscores?days=${days}`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
  });
};

// Keyword endpoints
export const useKeyword = (keywordId: string) => {
  return useQuery<GetKeywordResponse>({
    queryKey: ['keyword', keywordId],
    queryFn: () => fetchApi<GetKeywordResponse>(`/keywords/${keywordId}`),
    enabled: !!keywordId,
  });
};

export const useKeywordScores = (keywordId: string, days: number) => {
  return useQuery<GetKeywordScoresResponse>({
    queryKey: ['keyword', keywordId, 'scores', days],
    queryFn: () => fetchApi<GetKeywordScoresResponse>(`/keywords/${keywordId}/scores?days=${days}`),
    enabled: !!keywordId && !!days,
  });
};

// Ad Group endpoints
export const useAdGroup = (adGroupId: string) => {
  return useQuery<GetAdGroupResponse, Error>({
    queryKey: ['adGroup', adGroupId],
    queryFn: () => fetchApi(`/adgroups/${adGroupId}`),
    enabled: !!adGroupId,
  });
};

export const useAdGroupScores = (adGroupId: string, days: number) => {
  return useQuery<GetAdGroupScoresResponse, Error>({
    queryKey: ['adGroupScores', adGroupId, days],
    queryFn: () => fetchApi(`/adgroups/${adGroupId}/scores?days=${days}`),
    enabled: !!adGroupId,
  });
};

interface UseAdGroupKeywordsOptions {
  enabled?: boolean;
  [key: string]: any;
}

export const useAdGroupKeywords = (adGroupId: string, options: UseAdGroupKeywordsOptions = {}) => {
  return useQuery<GetKeywordsResponse, Error>({
    queryKey: ['adGroupKeywords', adGroupId],
    queryFn: () => fetchApi(`/adgroups/${adGroupId}/keywords`),
    enabled: !!adGroupId && (options.enabled !== undefined ? options.enabled : true),
    ...options,
  });
};

export const useBulkAdGroupScores = () => {
  return useMutation<PostAdGroupBulkScoresResponse, Error, PostAdGroupBulkScoresRequest>({
    mutationFn: (data) => fetchApi('/adgroups/bulkscores', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  });
};