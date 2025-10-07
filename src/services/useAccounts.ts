import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './api';
import { AccountDto } from '../types/api.types';

export const useMccAccounts = () => {
  return useQuery<AccountDto[], Error>({
    queryKey: ['mccAccounts'],
    queryFn: async () => {
      return fetchApi<AccountDto[]>('/accounts');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
