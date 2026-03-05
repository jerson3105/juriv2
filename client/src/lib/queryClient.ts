import { QueryClient } from '@tanstack/react-query';

const getHttpStatusFromError = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { response?: { status?: number } };
  return candidate.response?.status;
};

const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  const status = getHttpStatusFromError(error);

  // Evitar ráfagas de reintentos para errores no recuperables o rate-limit.
  if (status === 401 || status === 403 || status === 404 || status === 429) {
    return false;
  }

  return failureCount < 1;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
