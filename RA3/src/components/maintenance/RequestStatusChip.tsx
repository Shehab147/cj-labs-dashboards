'use client'

import Chip from '@mui/material/Chip'

import type { RequestStatus } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'

type ChipColor = 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary' | 'secondary'

const COLOR_BY_STATUS: Record<RequestStatus, ChipColor> = {
  pending: 'warning',
  price_offered: 'info',
  accepted: 'primary',
  in_progress: 'secondary',
  on_hold: 'warning',
  completed: 'success',
  rejected: 'error',
  cancelled: 'default'
}

export function statusColor(status: RequestStatus): ChipColor {
  return COLOR_BY_STATUS[status] ?? 'default'
}

interface Props {
  status: RequestStatus
  size?: 'small' | 'medium'
  variant?: 'filled' | 'tonal' | 'outlined'
}

export default function RequestStatusChip({ status, size = 'small', variant = 'tonal' }: Props) {
  const dictionary = useDictionary()
  const label = dictionary.requestStatus?.[status] || status

  return <Chip label={label} color={statusColor(status)} size={size} variant={variant as any} />
}
