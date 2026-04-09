/**
 * Timezone Utility for X-Station
 * 
 * The server stores all times in UTC+0.
 * This utility converts server times to the user's local browser timezone
 * and vice versa for sending data back to the server.
 */

/**
 * Parse a MySQL datetime string (YYYY-MM-DD HH:MM:SS) from server (UTC)
 * and return a Date object in local timezone
 */
export const parseServerDateTime = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null
  
  // Server sends dates in "YYYY-MM-DD HH:MM:SS" format (UTC)
  // We need to treat it as UTC and convert to local
  const normalized = dateStr.replace(' ', 'T') + 'Z' // Add Z to indicate UTC
  const date = new Date(normalized)
  
  return isNaN(date.getTime()) ? null : date
}

/**
 * Parse server datetime and return timestamp (milliseconds)
 */
export const parseServerDateTimeMs = (dateStr: string | null | undefined): number => {
  const date = parseServerDateTime(dateStr)
  return date ? date.getTime() : 0
}

/**
 * Format a Date object or server datetime string to local time string
 */
export const formatLocalTime = (
  dateInput: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateInput) return ''
  
  const date = typeof dateInput === 'string' ? parseServerDateTime(dateInput) : dateInput
  if (!date) return ''
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options
  }
  
  return date.toLocaleTimeString(locale, defaultOptions)
}

/**
 * Format a Date object or server datetime string to local date string
 */
export const formatLocalDate = (
  dateInput: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateInput) return ''
  
  const date = typeof dateInput === 'string' ? parseServerDateTime(dateInput) : dateInput
  if (!date) return ''
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  }
  
  return date.toLocaleDateString(locale, defaultOptions)
}

/**
 * Format a Date object or server datetime string to local datetime string
 */
export const formatLocalDateTime = (
  dateInput: Date | string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateInput) return ''
  
  const date = typeof dateInput === 'string' ? parseServerDateTime(dateInput) : dateInput
  if (!date) return ''
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  }
  
  return date.toLocaleString(locale, defaultOptions)
}

/**
 * Convert a local Date to server format (UTC) for sending to API
 * Returns string in "YYYY-MM-DD HH:MM:SS" format
 */
export const toServerDateTime = (localDate: Date): string => {
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  const hours = String(localDate.getUTCHours()).padStart(2, '0')
  const minutes = String(localDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(localDate.getUTCSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * Convert a local Date to server date format (UTC) for sending to API
 * Returns string in "YYYY-MM-DD" format
 */
export const toServerDate = (localDate: Date): string => {
  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get the current time as a server-formatted string (UTC)
 */
export const getCurrentServerDateTime = (): string => {
  return toServerDateTime(new Date())
}

/**
 * Calculate remaining time between now and a server end time
 * Returns remaining seconds (0 if already passed)
 */
export const getRemainingSeconds = (serverEndTime: string | null | undefined): number => {
  if (!serverEndTime) return 0
  
  const endTime = parseServerDateTimeMs(serverEndTime)
  const now = Date.now()
  
  return Math.max(0, Math.floor((endTime - now) / 1000))
}

/**
 * Calculate elapsed time since a server start time
 * Returns elapsed seconds
 */
export const getElapsedSeconds = (serverStartTime: string | null | undefined): number => {
  if (!serverStartTime) return 0
  
  const startTime = parseServerDateTimeMs(serverStartTime)
  const now = Date.now()
  
  return Math.max(0, Math.floor((now - startTime) / 1000))
}

/**
 * Format seconds to a timer display (HH:MM:SS or MM:SS)
 */
export const formatTimerDisplay = (totalSeconds: number): string => {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Check if a server datetime has passed (is in the past)
 */
export const hasTimePassed = (serverDateTime: string | null | undefined): boolean => {
  if (!serverDateTime) return false
  
  const time = parseServerDateTimeMs(serverDateTime)
  return Date.now() > time
}

/**
 * Check if a server datetime is in the future
 */
export const isInFuture = (serverDateTime: string | null | undefined): boolean => {
  if (!serverDateTime) return false
  
  const time = parseServerDateTimeMs(serverDateTime)
  return Date.now() < time
}

/**
 * Get the user's timezone name
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Get the timezone offset in hours (e.g., +2, -5)
 */
export const getTimezoneOffset = (): number => {
  return -(new Date().getTimezoneOffset() / 60)
}

/**
 * Format timezone offset as string (e.g., "UTC+2", "UTC-5")
 */
export const getTimezoneOffsetString = (): string => {
  const offset = getTimezoneOffset()
  const sign = offset >= 0 ? '+' : ''
  return `UTC${sign}${offset}`
}

/**
 * Get locale string based on RTL setting
 */
export const getLocaleForRtl = (isRtl: boolean): string => {
  return isRtl ? 'ar-EG' : 'en-US'
}

// Re-export common format presets
export const dateFormats = {
  shortDate: { year: 'numeric', month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions,
  longDate: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' } as Intl.DateTimeFormatOptions,
  shortTime: { hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions,
  longTime: { hour: '2-digit', minute: '2-digit', second: '2-digit' } as Intl.DateTimeFormatOptions,
  shortDateTime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions,
}
