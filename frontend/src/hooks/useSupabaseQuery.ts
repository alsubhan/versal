import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { performanceMonitor } from '@/lib/performance';

// Generic hook for Supabase queries with better caching
export function useSupabaseQuery<T = any>(
  key: string[],
  queryFn: () => any,
  options: {
    staleTime?: number;
    gcTime?: number;
    retry?: number;
    retryDelay?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    staleTime = 30000, // 30 seconds default
    gcTime = 5 * 60 * 1000, // 5 minutes default (formerly cacheTime)
    retry = 2,
    retryDelay = 1000,
    enabled = true
  } = options;

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const queryName = key.join('-');
      performanceMonitor.startTimer(`query-${queryName}`);
      try {
        const result = await queryFn();
        const { data, error } = result;
        if (error) {
          console.error(`Query error for ${key.join('-')}:`, error);
          throw new Error(error.message || 'Query failed');
        }
        return data || [];
      } catch (err) {
        console.error(`Unexpected error in query ${key.join('-')}:`, err);
        throw err;
      } finally {
        performanceMonitor.endTimer(`query-${queryName}`);
      }
    },
    staleTime,
    gcTime,
    retry,
    retryDelay,
    enabled,
    // Add refetch on window focus only for critical data
    refetchOnWindowFocus: false,
    // Reduce background refetch frequency
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

// Generic hook for Supabase mutations with better error handling
export function useSupabaseMutation<T>(
  mutationFn: (data: T) => Promise<{ data: any; error: any }>,
  onSuccess?: () => void,
  invalidateKeys?: string[][],
  options: {
    retry?: number;
    retryDelay?: number;
  } = {}
) {
  const queryClient = useQueryClient();
  const { retry = 1, retryDelay = 1000 } = options;
  
  return useMutation({
    mutationFn: async (data: T) => {
      performanceMonitor.startTimer('mutation-execution');
      try {
        const { data: result, error } = await mutationFn(data);
        if (error) {
          console.error('Mutation error:', error);
          throw new Error(error.message || 'Operation failed');
        }
        return result;
      } catch (err) {
        console.error('Unexpected mutation error:', err);
        throw err;
      } finally {
        performanceMonitor.endTimer('mutation-execution');
      }
    },
    retry,
    retryDelay,
    onSuccess: () => {
      toast.success('Operation completed successfully');
      if (invalidateKeys) {
        // Invalidate queries in the background to avoid blocking UI
        setTimeout(() => {
          invalidateKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }, 100);
      }
      onSuccess?.();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'An error occurred';
      console.error('Mutation failed:', errorMessage);
      toast.error(errorMessage);
    },
  });
}

// Optimized hook for paginated queries
export function usePaginatedSupabaseQuery<T = any>(
  key: string[],
  queryFn: (page: number, limit: number) => any,
  page: number = 1,
  limit: number = 20,
  options: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    staleTime = 60000, // 1 minute for paginated data
    gcTime = 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    enabled = true
  } = options;

  return useQuery({
    queryKey: [...key, page, limit],
    queryFn: async () => {
      const queryName = [...key, page, limit].join('-');
      performanceMonitor.startTimer(`paginated-query-${queryName}`);
      try {
        const result = await queryFn(page, limit);
        const { data, error } = result;
        if (error) {
          console.error(`Paginated query error for ${key.join('-')}:`, error);
          throw new Error(error.message || 'Query failed');
        }
        return data || [];
      } catch (err) {
        console.error(`Unexpected error in paginated query ${key.join('-')}:`, err);
        throw err;
      } finally {
        performanceMonitor.endTimer(`paginated-query-${queryName}`);
      }
    },
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}

// Hook for search queries with debouncing
export function useSearchSupabaseQuery<T = any>(
  key: string[],
  queryFn: (searchTerm: string) => any,
  searchTerm: string = '',
  options: {
    staleTime?: number;
    gcTime?: number;
    enabled?: boolean;
    debounceMs?: number;
  } = {}
) {
  const {
    staleTime = 30000,
    gcTime = 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    enabled = true,
    debounceMs = 300
  } = options;

  return useQuery({
    queryKey: [...key, searchTerm],
    queryFn: async () => {
      const queryName = [...key, searchTerm].join('-');
      performanceMonitor.startTimer(`search-query-${queryName}`);
      try {
        const result = await queryFn(searchTerm);
        const { data, error } = result;
        if (error) {
          console.error(`Search query error for ${key.join('-')}:`, error);
          throw new Error(error.message || 'Search failed');
        }
        return data || [];
      } catch (err) {
        console.error(`Unexpected error in search query ${key.join('-')}:`, err);
        throw err;
      } finally {
        performanceMonitor.endTimer(`search-query-${queryName}`);
      }
    },
    staleTime,
    gcTime,
    enabled: enabled && searchTerm.length > 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
}