'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

import CustomTextField from '@core/components/mui/TextField'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { adminRequestApi, engineerApi, geoZoneApi } from '@/services/api'
import type { EngineerAccount, GeoZone, MaintenanceRequest, RequestStatus } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

import NewRequestDialog from './NewRequestDialog'

const STATUS_OPTIONS: (RequestStatus | '')[] = [
  '',
  'pending',
  'price_offered',
  'accepted',
  'in_progress',
  'on_hold',
  'completed',
  'rejected',
  'cancelled'
]

export default function AdminRequestsList() {
  const dictionary = useDictionary()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'
  const searchParams = useSearchParams()

  const [rows, setRows] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<GeoZone[]>([])
  const [engineers, setEngineers] = useState<EngineerAccount[]>([])

  const [status, setStatus] = useState<RequestStatus | ''>('')
  const [zoneId, setZoneId] = useState<string>('')
  const [engineerId, setEngineerId] = useState<string>('')
  const [search, setSearch] = useState('')

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === '1')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await adminRequestApi.list({
      status: status || undefined,
      zone_id: zoneId ? Number(zoneId) : undefined,
      engineer_id: engineerId ? Number(engineerId) : undefined
    })

    if (res.status === 'success' && res.data?.requests) setRows(res.data.requests)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [status, zoneId, engineerId, dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    geoZoneApi.list().then(r => r.status === 'success' && r.data?.zones && setZones(r.data.zones))
    engineerApi.list().then(r => r.status === 'success' && r.data?.engineers && setEngineers(r.data.engineers))
  }, [])

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

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between flex-wrap gap-3'>
          <Typography variant='h4'>{dictionary.requests.title}</Typography>
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            onClick={() => setDialogOpen(true)}
          >
            {dictionary.requests.newRequest}
          </Button>
        </Box>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary.common.filter} />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.requests.filterStatus}
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value as RequestStatus | '')
                    setPage(0)
                  }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <MenuItem key={s || 'all'} value={s}>
                      {s ? dictionary.requestStatus[s] : dictionary.common.all}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.requests.filterZone}
                  value={zoneId}
                  onChange={e => {
                    setZoneId(e.target.value)
                    setPage(0)
                  }}
                >
                  <MenuItem value=''>{dictionary.common.all}</MenuItem>
                  {zones.map(z => (
                    <MenuItem key={z.id} value={String(z.id)}>
                      {z.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.requests.filterEngineer}
                  value={engineerId}
                  onChange={e => {
                    setEngineerId(e.target.value)
                    setPage(0)
                  }}
                >
                  <MenuItem value=''>{dictionary.common.all}</MenuItem>
                  {engineers.map(e => (
                    <MenuItem key={e.id} value={String(e.id)}>
                      {e.full_name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <CustomTextField
                  fullWidth
                  label={dictionary.common.search}
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          {error && <Alert severity='error' className='m-4'>{error}</Alert>}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{dictionary.requests.tableId}</TableCell>
                  <TableCell>{dictionary.requests.tableCustomer}</TableCell>
                  <TableCell>{dictionary.requests.tableZone}</TableCell>
                  <TableCell>{dictionary.requests.tableEngineer}</TableCell>
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
                        <Skeleton variant='rectangular' height={32} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align='center'>
                      {dictionary.requests.noRequestsFound}
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map(r => (
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
                      <TableCell>{r.zone_name || '—'}</TableCell>
                      <TableCell>{r.engineer_name || dictionary.requests.noEngineer}</TableCell>
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
                        <IconButton
                          size='small'
                          component={Link}
                          href={getLocalizedUrl(`/admin/requests/${r.id}`, locale)}
                        >
                          <i className='tabler-eye text-lg' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component='div'
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => {
              setRowsPerPage(Number(e.target.value))
              setPage(0)
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Card>
      </Grid>

      <NewRequestDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </Grid>
  )
}
