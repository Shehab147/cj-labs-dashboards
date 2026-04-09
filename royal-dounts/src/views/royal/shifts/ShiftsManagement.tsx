'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'

import { shiftApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import CustomAvatar from '@core/components/mui/Avatar'

const ShiftsManagement = () => {
  const t = useDictionary()
  const [shifts, setShifts] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchShifts = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await shiftApi.getAll()
      if (res.status === 'success') {
        setShifts(Array.isArray(res.data) ? res.data : res.data?.shifts || [])
        if (res.data?.totals) setTotals(res.data.totals)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <Grid container spacing={6}>
      {/* Summary Cards */}
      {totals && (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                  <i className='tabler-currency-dollar text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(totals.total_sales || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.shifts.tableTotalSales}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                  <i className='tabler-cash text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(totals.total_cash || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.shifts.tableCashPayments}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                  <i className='tabler-credit-card text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(totals.total_card || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.shifts.tableCardPayments}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color={parseFloat(totals.total_difference || 0) === 0 ? 'success' : 'warning'} skin='light' size={48}>
                  <i className='tabler-plus-minus text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(totals.total_difference || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.shifts.tableDifference}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}

      {/* Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={t.shifts.title}
            subheader={`${shifts.length} ${t.shifts.shiftCount}`}
            action={<Button variant='outlined' startIcon={<i className='tabler-refresh' />} onClick={fetchShifts}>{t.common.refresh}</Button>}
          />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t.shifts.tableId}</TableCell>
                  <TableCell>{t.shifts.tableCashier}</TableCell>
                  <TableCell>{t.shifts.tableStatus}</TableCell>
                  <TableCell align='right'>{t.shifts.tableOpeningCash}</TableCell>
                  <TableCell align='right'>{t.shifts.tableClosingCash}</TableCell>
                  <TableCell align='right'>{t.shifts.tableTotalSales}</TableCell>
                  <TableCell align='right'>{t.shifts.tableCashPayments}</TableCell>
                  <TableCell align='right'>{t.shifts.tableCardPayments}</TableCell>
                  <TableCell align='right'>{t.shifts.tableDifference}</TableCell>
                  <TableCell align='center'>{t.shifts.tableOrders}</TableCell>
                  <TableCell align='center'>{t.shifts.tableExpenses}</TableCell>
                  <TableCell>{t.shifts.tableStarted}</TableCell>
                  <TableCell>{t.shifts.tableEnded}</TableCell>
                  <TableCell>{t.shifts.tableNotes}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align='center'>
                      <Typography variant='body2' color='text.secondary'>{t.shifts.noShiftsFound}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift: any) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shift.id}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant='subtitle2'>{shift.cashier_name || shift.user_name || `${t.shifts.userFallback} #${shift.user_id}`}</Typography>
                          {shift.cashier_email && (
                            <Typography variant='caption' color='text.secondary'>{shift.cashier_email}</Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={shift.status === 'open' ? t.shifts.active : t.shifts.ended} size='small' color={shift.status === 'open' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align='right'>{parseFloat(shift.opening_cash || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{shift.closing_cash ? parseFloat(shift.closing_cash).toFixed(2) : '-'}</TableCell>
                      <TableCell align='right'>{shift.total_sales ? parseFloat(shift.total_sales).toFixed(2) : '-'}</TableCell>
                      <TableCell align='right'>{parseFloat(shift.total_cash_payments || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(shift.total_card_payments || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>
                        {shift.difference !== null && shift.difference !== undefined ? (
                          <Chip
                            label={parseFloat(shift.difference).toFixed(2)}
                            size='small'
                            color={parseFloat(shift.difference) === 0 ? 'success' : 'warning'}
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell align='center'>{shift.orders_count || 0}</TableCell>
                      <TableCell align='center'>
                        {(shift.expenses_count || 0) > 0 ? (
                          <Tooltip title={`${t.shifts.expensesTotal}: ${parseFloat(shift.expenses_total || 0).toFixed(2)}`}>
                            <Chip label={shift.expenses_count} size='small' color='warning' variant='tonal' />
                          </Tooltip>
                        ) : (
                          <Typography variant='body2' color='text.secondary'>0</Typography>
                        )}
                      </TableCell>
                      <TableCell>{shift.start_time ? new Date(shift.start_time).toLocaleString() : '-'}</TableCell>
                      <TableCell>{shift.end_time ? new Date(shift.end_time).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        {shift.notes ? (
                          <Tooltip title={shift.notes}>
                            <Chip label={shift.notes.length > 20 ? shift.notes.substring(0, 20) + '...' : shift.notes} size='small' variant='outlined' />
                          </Tooltip>
                        ) : '-'}
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

export default ShiftsManagement
