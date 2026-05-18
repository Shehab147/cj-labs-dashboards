'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'

import { dashboardApi } from '@/services/api'
import type { AdminDashboardData, RequestStatus } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { useAuth } from '@/contexts/authContext'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

const STAT_STATUSES: RequestStatus[] = ['pending', 'price_offered', 'accepted', 'in_progress', 'on_hold', 'completed']

const ICON_BY_STATUS: Record<RequestStatus, string> = {
  pending: 'tabler-clock',
  price_offered: 'tabler-tag',
  accepted: 'tabler-check',
  in_progress: 'tabler-progress',
  on_hold: 'tabler-pause',
  completed: 'tabler-circle-check',
  rejected: 'tabler-x',
  cancelled: 'tabler-ban'
}

export default function AdminDashboard() {
  const dictionary = useDictionary()
  const { admin } = useAuth()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'

  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      setLoading(true)
      const res = await dashboardApi.admin()

      if (!mounted) return

      if (res.status === 'success' && res.data) setData(res.data)
      else setError(res.message || dictionary.common.anErrorOccurred)

      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [dictionary.common.anErrorOccurred])

  const currency = dictionary.common.currency

  const summaryCards = useMemo(() => {
    if (!data) return []

    return STAT_STATUSES.map(s => ({
      key: s,
      label: dictionary.requestStatus[s] ?? s,
      value: data.requests?.[s] ?? 0,
      icon: ICON_BY_STATUS[s]
    }))
  }, [data, dictionary])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between flex-wrap gap-3'>
          <Box>
            <Typography variant='h4'>{dictionary.dashboard.title}</Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary.dashboard.welcome} {admin?.name || ''}
            </Typography>
          </Box>
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            component={Link}
            href={getLocalizedUrl('/admin/requests?new=1', locale)}
          >
            {dictionary.requests.newRequest}
          </Button>
        </Box>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>{error}</Alert>
        </Grid>
      )}

      {/* Top totals */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center gap-3'>
              <Box className='p-3 rounded-full bg-primary/10 text-primary'>
                <i className='tabler-clipboard-list text-2xl' />
              </Box>
              <Box>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary.dashboard.totalRequests}
                </Typography>
                {loading ? (
                  <Skeleton width={60} height={32} />
                ) : (
                  <Typography variant='h4'>{data?.requests?.total ?? 0}</Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center gap-3'>
              <Box className='p-3 rounded-full bg-success/10 text-success'>
                <i className='tabler-tool text-2xl' />
              </Box>
              <Box>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary.dashboard.activeEngineers}
                </Typography>
                {loading ? (
                  <Skeleton width={60} height={32} />
                ) : (
                  <Typography variant='h4'>
                    {data?.engineers?.active ?? 0} / {data?.engineers?.total ?? 0}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center gap-3'>
              <Box className='p-3 rounded-full bg-warning/10 text-warning'>
                <i className='tabler-coin text-2xl' />
              </Box>
              <Box>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary.dashboard.totalRevenue}
                </Typography>
                {loading ? (
                  <Skeleton width={120} height={32} />
                ) : (
                  <Typography variant='h4'>
                    {(data?.revenue?.total_revenue ?? 0).toLocaleString()} {currency}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Per-status cards */}
      {summaryCards.map(c => (
        <Grid key={c.key} size={{ xs: 6, md: 4, lg: 2 }}>
          <Card>
            <CardContent>
              <Box className='flex flex-col items-start gap-1'>
                <Box className='flex items-center gap-2 text-textSecondary'>
                  <i className={`${c.icon} text-xl`} />
                  <Typography variant='caption'>{c.label}</Typography>
                </Box>
                {loading ? <Skeleton width={50} height={28} /> : <Typography variant='h5'>{c.value}</Typography>}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* Recent requests */}
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
                    <TableCell>{dictionary.requests.tableZone}</TableCell>
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
                        <TableCell>{r.zone_name || '—'}</TableCell>
                        <TableCell>
                          <RequestStatusChip status={r.status} />
                        </TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell align='right'>
                          <Button
                            size='small'
                            component={Link}
                            href={getLocalizedUrl(`/admin/requests/${r.id}`, locale)}
                          >
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
