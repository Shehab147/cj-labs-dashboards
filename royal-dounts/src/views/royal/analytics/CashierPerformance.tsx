'use client'

import { useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Grid from '@mui/material/Grid'

import { analyticsApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import CustomAvatar from '@core/components/mui/Avatar'

const CashierPerformance = () => {
  const t = useDictionary()
  const [data, setData] = useState<any[]>([])
  const [period, setPeriod] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await analyticsApi.getCashierPerformance()
        if (res.status === 'success') {
          setData(Array.isArray(res.data) ? res.data : res.data?.cashiers || res.data?.performance || [])
          if (res.data?.period) setPeriod(res.data.period)
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchData()
  }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  // Summary stats
  const totalOrders = data.reduce((sum, c) => sum + (c.orders_count || 0), 0)
  const totalSales = data.reduce((sum, c) => sum + parseFloat(c.orders_total || 0), 0)
  const totalCancelled = data.reduce((sum, c) => sum + (c.cancelled_orders || 0), 0)

  return (
    <Grid container spacing={6}>
      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-users text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{data.length}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.cashierPerformance.totalCashiers}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalOrders}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.cashierPerformance.tableTotalOrders}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalSales.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.cashierPerformance.tableTotalSales}</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Period Info */}
      {period && (
        <Grid size={{ xs: 12 }}>
          <Box className='flex items-center gap-2'>
            <Chip label={`${period.start_date} → ${period.end_date}`} size='small' variant='outlined' color='primary' />
          </Box>
        </Grid>
      )}

      {/* Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={t.cashierPerformance.title} subheader={t.cashierPerformance.subheader} />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t.cashierPerformance.tableCashier}</TableCell>
                  <TableCell align='center'>{t.cashierPerformance.tableShifts}</TableCell>
                  <TableCell align='center'>{t.cashierPerformance.tableTotalOrders}</TableCell>
                  <TableCell align='right'>{t.cashierPerformance.tableOrdersTotal}</TableCell>
                  <TableCell align='right'>{t.cashierPerformance.tableCashPayments}</TableCell>
                  <TableCell align='right'>{t.cashierPerformance.tableCardPayments}</TableCell>
                  <TableCell align='right'>{t.cashierPerformance.tableCashDiff}</TableCell>
                  <TableCell align='center'>{t.cashierPerformance.tableCancelled}</TableCell>
                  <TableCell align='right'>{t.cashierPerformance.tableAvgOrderValue}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align='center'>
                      <Typography variant='body2' color='text.secondary'>{t.cashierPerformance.noData}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((cashier: any) => (
                    <TableRow key={cashier.id || cashier.name}>
                      <TableCell>
                        <Box>
                          <Typography variant='subtitle2'>{cashier.name || cashier.cashier_name}</Typography>
                          <Typography variant='caption' color='text.secondary'>{cashier.email}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align='center'>
                        <Chip label={cashier.shifts_count || 0} size='small' variant='tonal' color='primary' />
                      </TableCell>
                      <TableCell align='center'>{cashier.orders_count || 0}</TableCell>
                      <TableCell align='right'>{parseFloat(cashier.orders_total || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(cashier.total_cash_payments || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(cashier.total_card_payments || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>
                        <Chip
                          label={parseFloat(cashier.cash_difference || 0).toFixed(2)}
                          size='small'
                          color={parseFloat(cashier.cash_difference || 0) === 0 ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align='center'>
                        {cashier.cancelled_orders > 0 ? (
                          <Chip label={cashier.cancelled_orders} size='small' color='error' />
                        ) : (
                          <Chip label='0' size='small' color='success' />
                        )}
                      </TableCell>
                      <TableCell align='right'>{parseFloat(cashier.avg_order_value || 0).toFixed(2)}</TableCell>
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

export default CashierPerformance
