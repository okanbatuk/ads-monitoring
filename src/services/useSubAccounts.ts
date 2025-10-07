import { useQuery } from '@tanstack/react-query';
import { AccountDto } from '../types/api.types';
import { fetchApi } from './api';

interface GetSubAccountsResponse {
  subAccounts: AccountDto[];
  total: number;
}

interface UseSubAccountsOptions {
  enabled?: boolean;
}

export const useSubAccounts = (
  mccAccountId: string, 
  options: UseSubAccountsOptions = { enabled: true }
) => {
  return useQuery<GetSubAccountsResponse, Error>({
    queryKey: ['subAccounts', mccAccountId],
    queryFn: async () => {
      return fetchApi<GetSubAccountsResponse>(`/accounts/${mccAccountId}/accounts?include=true`);
    },
    enabled: options.enabled && !!mccAccountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
