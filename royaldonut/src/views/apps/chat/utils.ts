import { formatInCairo, getCairoDateParts } from '@/utils/timezone'

const isToday = (date: Date | string) => {
  const today = getCairoDateParts(new Date())
  const candidate = getCairoDateParts(date)

  return candidate.day === today.day && candidate.month === today.month && candidate.year === today.year
}

export const formatDateToMonthShort = (value: Date | string, toTimeForCurrentDay = true) => {
  const date = new Date(value)
  let formatting: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (toTimeForCurrentDay && isToday(date)) {
    formatting = { hour: 'numeric', minute: 'numeric' }
  }

  return formatInCairo(new Date(value), 'en-US', formatting)
}
