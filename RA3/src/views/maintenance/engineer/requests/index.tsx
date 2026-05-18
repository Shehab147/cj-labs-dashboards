'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'

import CustomTextField from '@core/components/mui/TextField'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { engineerRequestApi } from '@/services/api'
import type { MaintenanceRequest, RequestStatus } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

const STATUS_OPTIONS: (RequestStatus | '')[] = ['', 'accepted', 'in_progress', 'on_hold', 'completed']

export default function EngineerRequestsList() {
  const dictionary = useDictionary()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'

  const [rows, setRows] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<RequestStatus | ''>('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await engineerRequestApi.myRequests(status || undefined)

    if (res.status === 'success' && res.data?.requests) setRows(res.data.requests)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [status, dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()

    return rows.filter(
      r =>
        String(r.id).includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.customer_phone.includes(q) ||
        r.summary.toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4'>{dictionary.navigation.myRequests}</Typography>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>{error}</Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary.common.filter} />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.requests.filterStatus}
                  value={status}
                  onChange={e => setStatus(e.target.value as RequestStatus | '')}
                >
                  {STATUS_OPTIONS.map(s => (
                    <MenuItem key={s || 'all'} value={s}>
                      {s ? dictionary.requestStatus[s] : dictionary.common.all}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField fullWidth label={dictionary.common.search} value={search} onChange={e => setSearch(e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{dictionary.requests.tableId}</TableCell>
                  <TableCell>{dictionary.requests.tableCustomer}</TableCell>
                  <TableCell>{dictionary.requests.summary}</TableCell>
                  <TableCell>{dictionary.requests.tableZone}</TableCell>
                  <TableCell>{dictionary.requests.tableStatus}</TableCell>
                  <TableCell>{dictionary.requests.priceRange}</TableCell>
                  <TableCell>{dictionary.requests.tableCreated}</TableCell>
                  <TableCell align='right'>{dictionary.requests.tableActions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton variant='rectangular' height={28} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align='center'>{dictionary.requests.noRequestsFound}</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>#{r.id}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant='body2' fontWeight={600}>
                            {r.customer_name}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {r.customer_phone}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{r.summary}</TableCell>
                      <TableCell>{r.zone_name || '—'}</TableCell>
                      <TableCell>
                        <RequestStatusChip status={r.status} />
                      </TableCell>
                      <TableCell>
                        {r.price_range_from != null && r.price_range_to != null
                          ? `${r.price_range_from} - ${r.price_range_to} ${dictionary.common.currency}`
                          : '—'}
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' component={Link} href={getLocalizedUrl(`/engineer/requests/${r.id}`, locale)}>
                          <i className='tabler-eye text-lg' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}
