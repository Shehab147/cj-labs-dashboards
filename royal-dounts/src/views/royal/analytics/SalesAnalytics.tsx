'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { analyticsApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import CustomAvatar from '@core/components/mui/Avatar'

const SalesAnalytics = () => {
  const t = useDictionary()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const params: any = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await analyticsApi.getSalesAnalytics(params)
      if (res.status === 'success') setData(res.data)
    } catch {} finally { setIsLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const summary = data?.summary || {}
  const averages = data?.averages || {}
  const byPayment = data?.by_payment_method || {}
  const byOrderType = data?.by_order_type || {}
  const dailyBreakdown = data?.daily_breakdown || []
  const period = data?.period || null

  const orderTypeLabels: Record<string, string> = {
    takeaway: t.salesAnalytics.takeaway,
    dine_in: t.salesAnalytics.dineIn,
    delivery: t.salesAnalytics.delivery
  }

  const orderTypeColors: Record<string, 'info' | 'primary' | 'warning'> = {
    takeaway: 'info',
    dine_in: 'primary',
    delivery: 'warning'
  }

  return (
    <Grid container spacing={6}>
      {/* Date Filter */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-4 items-end flex-wrap'>
            <TextField label={t.common.startDate} type='date' value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <TextField label={t.common.endDate} type='date' value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <Button variant='contained' onClick={fetchData}>{t.common.apply}</Button>
            {period && (
              <Chip label={`${period.start_date} \u2192 ${period.end_date} (${period.days} ${t.salesAnalytics.days})`} size='small' variant='outlined' color='primary' />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{summary.total_orders || 0}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.totalOrders}</Typography>
            <Box className='flex gap-2'>
              <Chip label={`${summary.completed_orders || 0} ${t.salesAnalytics.completed}`} size='small' color='success' variant='tonal' />
              {(summary.cancelled_orders || 0) > 0 && (
                <Chip label={`${summary.cancelled_orders} ${t.salesAnalytics.cancelled}`} size='small' color='error' variant='tonal' />
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(summary.total_revenue || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.totalRevenue}</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color={parseFloat(summary.net_profit || 0) >= 0 ? 'info' : 'error'} skin='light' size={48}>
              <i className='tabler-trending-up text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(summary.net_profit || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.netProfit}</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
              <i className='tabler-chart-bar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(averages.order_value || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.avgOrderValue}</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Profit Breakdown */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.profitBreakdown} />
          <Divider />
          <CardContent>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.itemsProfit}</Typography>
              <Chip label={parseFloat(summary.items_profit || 0).toFixed(2)} size='small' color='success' />
            </Box>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.itemsCost}</Typography>
              <Typography variant='body2' color='text.secondary'>{parseFloat(summary.items_cost || 0).toFixed(2)}</Typography>
            </Box>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.expenses}</Typography>
              <Typography variant='body2' color='text.secondary'>{parseFloat(summary.expenses || 0).toFixed(2)}</Typography>
            </Box>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.refunds}</Typography>
              <Typography variant='body2' color='error'>{parseFloat(summary.refunds || 0).toFixed(2)} ({data?.refunds_count || 0})</Typography>
            </Box>
            <Divider className='my-2' />
            <Box className='flex justify-between py-2'>
              <Typography variant='subtitle1' fontWeight={600}>{t.salesAnalytics.netProfit}</Typography>
              <Chip
                label={parseFloat(summary.net_profit || 0).toFixed(2)}
                color={parseFloat(summary.net_profit || 0) >= 0 ? 'success' : 'error'}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Payment Breakdown */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.paymentBreakdown} />
          <Divider />
          <CardContent>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.cashPayments}</Typography>
              <Box className='flex gap-2 items-center'>
                <Chip label={`${byPayment.cash?.count || 0} ${t.salesAnalytics.orders}`} size='small' variant='outlined' />
                <Chip label={parseFloat(byPayment.cash?.total || 0).toFixed(2)} color='success' />
              </Box>
            </Box>
            <Box className='flex justify-between py-2'>
              <Typography>{t.salesAnalytics.cardPayments}</Typography>
              <Box className='flex gap-2 items-center'>
                <Chip label={`${byPayment.card?.count || 0} ${t.salesAnalytics.orders}`} size='small' variant='outlined' />
                <Chip label={parseFloat(byPayment.card?.total || 0).toFixed(2)} color='primary' />
              </Box>
            </Box>
            <Divider className='my-2' />
            <Box className='flex justify-between py-2'>
              <Typography variant='subtitle1' fontWeight={600}>{t.salesAnalytics.total}</Typography>
              <Typography variant='subtitle1' fontWeight={600}>{parseFloat(summary.total_revenue || 0).toFixed(2)}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Order Type Breakdown */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.ordersByType} />
          <Divider />
          <CardContent>
            {Object.keys(byOrderType).length === 0 ? (
              <Typography variant='body2' color='text.secondary' align='center'>{t.salesAnalytics.noData}</Typography>
            ) : (
              Object.entries(byOrderType).map(([type, val]: [string, any]) => (
                <Box key={type} className='flex justify-between py-2'>
                  <Chip
                    label={orderTypeLabels[type] || type.replace('_', ' ')}
                    size='small'
                    color={orderTypeColors[type] || 'default'}
                    variant='tonal'
                  />
                  <Box className='flex gap-2 items-center'>
                    <Chip label={`${val.count || 0} ${t.salesAnalytics.orders}`} size='small' variant='outlined' />
                    <Typography variant='subtitle2'>{parseFloat(val.revenue || 0).toFixed(2)}</Typography>
                  </Box>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Averages */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <Typography variant='h5'>{averages.daily_orders || 0}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.dailyOrders}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <Typography variant='h5'>{parseFloat(averages.daily_revenue || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.dailyRevenue}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <Typography variant='h5'>{parseFloat(averages.order_value || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.salesAnalytics.avgOrderValue}</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Daily Breakdown */}
      {dailyBreakdown.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title={t.salesAnalytics.dailySales} />
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.salesAnalytics.colDate}</TableCell>
                    <TableCell align='center'>{t.salesAnalytics.colOrders}</TableCell>
                    <TableCell align='right'>{t.salesAnalytics.colRevenue}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyBreakdown.map((day: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{day.date}</TableCell>
                      <TableCell align='center'>{day.orders || 0}</TableCell>
                      <TableCell align='right'>{parseFloat(day.revenue || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default SalesAnalytics
