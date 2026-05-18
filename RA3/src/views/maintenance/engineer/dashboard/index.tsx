'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'

import { dashboardApi } from '@/services/api'
import type { EngineerDashboardData } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { useAuth } from '@/contexts/authContext'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

const STATS = [
  { key: 'new_assigned', label: 'newAssigned', icon: 'tabler-bell', color: 'primary' },
  { key: 'in_progress', label: 'inProgress', icon: 'tabler-progress', color: 'info' },
  { key: 'on_hold', label: 'onHold', icon: 'tabler-pause', color: 'warning' },
  { key: 'completed', label: 'completed', icon: 'tabler-circle-check', color: 'success' }
] as const

const COLOR_CLASSES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success'
}

export default function EngineerDashboard() {
  const dictionary = useDictionary()
  const { engineer } = useAuth()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'

  const [data, setData] = useState<EngineerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const res = await dashboardApi.engineer()

      if (!mounted) return

      if (res.status === 'success' && res.data) setData(res.data)
      else setError(res.message || dictionary.common.anErrorOccurred)
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [dictionary.common.anErrorOccurred])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box>
          <Typography variant='h4'>{dictionary.dashboard.title}</Typography>
          <Typography variant='body2' color='text.secondary'>
            {dictionary.dashboard.welcome} {engineer?.full_name || ''}
          </Typography>
        </Box>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>{error}</Alert>
        </Grid>
      )}

      {STATS.map(s => (
        <Grid key={s.key} size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box className='flex items-center gap-3'>
                <Box className={`p-3 rounded-full ${COLOR_CLASSES[s.color]}`}>
                  <i className={`${s.icon} text-2xl`} />
                </Box>
                <Box>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.dashboard[s.label as keyof typeof dictionary.dashboard]}
                  </Typography>
                  {loading ? (
                    <Skeleton width={50} height={28} />
                  ) : (
                    <Typography variant='h5'>{data?.counts?.[s.key] ?? 0}</Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center gap-3'>
              <Box className='p-3 rounded-full bg-success/10 text-success'>
                <i className='tabler-coin text-2xl' />
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  {dictionary.dashboard.myRevenue}
                </Typography>
                {loading ? (
                  <Skeleton width={120} height={32} />
                ) : (
                  <Typography variant='h5'>
                    {(data?.revenue?.total_revenue ?? 0).toLocaleString()} {dictionary.common.currency}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary.dashboard.recentRequests} />
          <CardContent>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{dictionary.requests.tableId}</TableCell>
                    <TableCell>{dictionary.requests.tableCustomer}</TableCell>
                    <TableCell>{dictionary.requests.summary}</TableCell>
                    <TableCell>{dictionary.requests.tableStatus}</TableCell>
                    <TableCell>{dictionary.requests.tableCreated}</TableCell>
                    <TableCell align='right'>{dictionary.requests.tableActions}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Skeleton variant='rectangular' height={80} />
                      </TableCell>
                    </TableRow>
                  ) : data?.recent && data.recent.length > 0 ? (
                    data.recent.map(r => (
                      <TableRow key={r.id} hover>
                        <TableCell>#{r.id}</TableCell>
                        <TableCell>{r.customer_name}</TableCell>
                        <TableCell>{r.summary}</TableCell>
                        <TableCell>
                          <RequestStatusChip status={r.status} />
                        </TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell align='right'>
                          <Button size='small' component={Link} href={getLocalizedUrl(`/engineer/requests/${r.id}`, locale)}>
                            {dictionary.common.view}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align='center'>
                        {dictionary.dashboard.noRecent}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
