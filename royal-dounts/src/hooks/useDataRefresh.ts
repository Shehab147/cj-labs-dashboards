import { useCallback, useState } from 'react'

interface UseDataRefreshOptions {
  onSuccess?: () => void | Promise<void>
  showSuccessNotification?: (message: string) => void
  showErrorNotification?: (message: string) => void
}

interface UseDataRefreshReturn<T> {
  execute: (apiCall: () => Promise<T>) => Promise<T | null>
  isLoading: boolean
}

/**
 * Hook to handle API requests with automatic data refresh and notification
 * @param options Configuration options
 * @returns Object with execute function and loading state
 */
export const useDataRefresh = <T = any>(
  options?: UseDataRefreshOptions
): UseDataRefreshReturn<T> => {
  const [isLoading, setIsLoading] = useState(false)

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    try {
      setIsLoading(true)
      const response = await apiCall()
      
      // Silent refresh: call the onSuccess callback (typically a data refetch)
      if (options?.onSuccess) {
        await options.onSuccess()
      }
      
      return response
    } catch (error) {
      if (options?.showErrorNotification) {
        options.showErrorNotification(
          error instanceof Error ? error.message : 'An error occurred'
        )
      }
      return null
    } finally {
      setIsLoading(false)
    }
  }, [options])

  return {
    execute,
    isLoading
  }
}
