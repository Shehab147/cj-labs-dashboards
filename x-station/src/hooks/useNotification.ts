import { useState, useEffect, useCallback } from 'react'

interface NotificationOptions {
  autoDismiss?: boolean
  duration?: number // in milliseconds
}

interface UseNotificationReturn {
  successMessage: string | null
  error: string | null
  showSuccess: (message: string, options?: NotificationOptions) => void
  showError: (message: string, options?: NotificationOptions) => void
  clearSuccess: () => void
  clearError: () => void
  clearAll: () => void
}

export const useNotification = (defaultOptions?: NotificationOptions): UseNotificationReturn => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successTimer, setSuccessTimer] = useState<NodeJS.Timeout | null>(null)
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null)

  const defaultDuration = defaultOptions?.duration ?? 3000
  const defaultAutoDismiss = defaultOptions?.autoDismiss ?? true

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (successTimer) clearTimeout(successTimer)
      if (errorTimer) clearTimeout(errorTimer)
    }
  }, [successTimer, errorTimer])

  const showSuccess = useCallback((message: string, options?: NotificationOptions) => {
    // Clear existing timer
    if (successTimer) clearTimeout(successTimer)
    
    setSuccessMessage(message)
    
    const autoDismiss = options?.autoDismiss ?? defaultAutoDismiss
    const duration = options?.duration ?? defaultDuration

    if (autoDismiss) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, duration)
      setSuccessTimer(timer)
    }
  }, [successTimer, defaultAutoDismiss, defaultDuration])

  const showError = useCallback((message: string, options?: NotificationOptions) => {
    // Clear existing timer
    if (errorTimer) clearTimeout(errorTimer)
    
    setError(message)
    
    const autoDismiss = options?.autoDismiss ?? false // Errors don't auto-dismiss by default
    const duration = options?.duration ?? defaultDuration

    if (autoDismiss) {
      const timer = setTimeout(() => {
        setError(null)
      }, duration)
      setErrorTimer(timer)
    }
  }, [errorTimer, defaultDuration])

  const clearSuccess = useCallback(() => {
    if (successTimer) clearTimeout(successTimer)
    setSuccessMessage(null)
    setSuccessTimer(null)
  }, [successTimer])

  const clearError = useCallback(() => {
    if (errorTimer) clearTimeout(errorTimer)
    setError(null)
    setErrorTimer(null)
  }, [errorTimer])

  const clearAll = useCallback(() => {
    clearSuccess()
    clearError()
  }, [clearSuccess, clearError])

  return {
    successMessage,
    error,
    showSuccess,
    showError,
    clearSuccess,
    clearError,
    clearAll
  }
}
