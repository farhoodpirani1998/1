import { useQuery } from '@tanstack/react-query';
import { getInstallments, type QueryInstallmentsParams } from '../api/tuition.api';
import { queryKeys } from '../lib/queryKeys';

export function useInstallments(params?: QueryInstallmentsParams) {
  return useQuery({
    queryKey: queryKeys.installments.list(params),
    queryFn: () => getInstallments(params).then((res) => res.data),
  });
}
