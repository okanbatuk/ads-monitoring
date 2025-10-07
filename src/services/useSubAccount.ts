import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api';
import { AccountDto } from '../types/api.types';

export const useSubAccount = (subAccountId: string) => {
  return useQuery<AccountDto, Error>({
    queryKey: ['subAccount', subAccountId],
    queryFn: async () => {
      return fetchApi<AccountDto>(`/accounts/${subAccountId}`);
    },
    enabled: !!subAccountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
