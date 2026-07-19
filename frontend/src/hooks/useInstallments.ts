import { useQuery } from '@tanstack/react-query';
import {
  getInstallments,
  getInstallmentsPaginated,
  type QueryInstallmentsParams,
} from '../api/tuition.api';
import { queryKeys } from '../lib/queryKeys';

export function useInstallments(params?: QueryInstallmentsParams) {
  return useQuery({
    queryKey: queryKeys.installments.list(params),
    queryFn: () => getInstallments(params).then((res) => res.data),
  });
}

// Phase 4B: real server-side pagination for InstallmentsPage only.
// Distinct from useInstallments() above — ReportsPage keeps using that
// one and must keep getting a plain array back.
export function useInstallmentsPaginated(
  page: number,
  limit: number,
  params?: QueryInstallmentsParams,
) {
  return useQuery({
    queryKey: queryKeys.installments.list({ ...params, page, limit }),
    queryFn: () => getInstallmentsPaginated(page, limit, params).then((res) => res.data),
  });
}
