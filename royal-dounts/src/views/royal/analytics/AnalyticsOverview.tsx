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
import LinearProgress from '@mui/material/LinearProgress'

import { analyticsApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import CustomAvatar from '@core/components/mui/Avatar'

const TYPE_COLORS: Record<string, 'primary' | 'info' | 'warning'> = {
  dine_in: 'primary',
  takeaway: 'info',
  delivery: 'warning'
}

const AnalyticsOverview = () => {
  const t = useDictionary()
  const [data, setData] = useState<any>(null)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const params: any = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const [salesRes, productsRes] = await Promise.all([
        analyticsApi.getSalesAnalytics(params),
        analyticsApi.getTopProducts({ ...params, limit: 10 })
      ])

      if (salesRes.status === 'success') setData(salesRes.data)
      if (productsRes.status === 'success') {
        const d = productsRes.data
        setTopProducts(Array.isArray(d) ? d : d?.top_products || d?.products || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  const summary = data?.summary || {}
  const averages = data?.averages || {}
  const byOrderType = data?.by_order_type || {}
  const byPayment = data?.by_payment_method || {}
  const dailyBreakdown = data?.daily_breakdown || []
  const period = data?.period
  const maxQty = Math.max(...topProducts.map((p: any) => p.total_quantity_sold || 0), 1)

  return (
    <Grid container spacing={6}>
      {/* Date Filters */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-4 items-end flex-wrap'>
            <TextField
              label={t.common.startDate}
              type='date'
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size='small'
            />
            <TextField
              label={t.common.endDate}
              type='date'
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size='small'
            />
            <Button variant='contained' onClick={fetchData}>{t.common.apply}</Button>
            {period && (
              <Chip
                label={`${period.start_date} → ${period.end_date} (${period.days} ${t.salesAnalytics.days})`}
                size='small'
                variant='outlined'
                color='primary'
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{summary.total_orders || 0}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.analyticsOverview.totalOrders}</Typography>
            <Box className='flex gap-1'>
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
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(summary.total_revenue || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.analyticsOverview.totalRevenue}</Typography>
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
              <i className='tabler-chart-line text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(averages.order_value || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.analyticsOverview.avgOrderValue}</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Profit Breakdown + Payment Breakdown */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.profitBreakdown} />
          <Divider />
          <CardContent>
            <Box className='flex flex-col gap-3'>
              {[
                { label: t.salesAnalytics.itemsProfit, value: summary.items_profit, color: 'success' },
                { label: t.salesAnalytics.itemsCost, value: summary.items_cost, color: 'warning' },
                { label: t.salesAnalytics.expenses, value: summary.expenses, color: 'secondary' },
                { label: t.salesAnalytics.refunds, value: summary.refunds, color: 'error', extra: data?.refunds_count ? `(${data.refunds_count})` : '' },
                { label: t.salesAnalytics.netProfit, value: summary.net_profit, color: 'info', bold: true }
              ].map((item, i) => (
                <Box key={i} className='flex items-center justify-between'>
                  <Typography variant={item.bold ? 'subtitle1' : 'body2'} fontWeight={item.bold ? 700 : 400}>
                    {item.label} {item.extra || ''}
                  </Typography>
                  <Chip
                    label={parseFloat(item.value || 0).toFixed(2)}
                    size='small'
                    color={item.color as any}
                    variant={item.bold ? 'filled' : 'tonal'}
                  />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.paymentBreakdown} />
          <Divider />
          <CardContent>
            <Box className='flex flex-col gap-3'>
              {Object.entries(byPayment).map(([method, info]: [string, any]) => (
                <Box key={method} className='flex items-center justify-between'>
                  <Box className='flex items-center gap-2'>
                    <CustomAvatar variant='rounded' color={method === 'cash' ? 'success' : 'primary'} skin='light' size={36}>
                      <i className={method === 'cash' ? 'tabler-cash text-lg' : 'tabler-credit-card text-lg'} />
                    </CustomAvatar>
                    <div>
                      <Typography variant='subtitle2'>
                        {method === 'cash' ? t.salesAnalytics.cashPayments : t.salesAnalytics.cardPayments}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {info.count} {t.salesAnalytics.orders}
                      </Typography>
                    </div>
                  </Box>
                  <Typography variant='h6'>{parseFloat(info.total || 0).toFixed(2)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Orders by Type + Averages */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.ordersByType} />
          <Divider />
          <CardContent>
            <Box className='flex flex-col gap-3'>
              {Object.entries(byOrderType).map(([type, info]: [string, any]) => {
                const typeLabel = type === 'dine_in' ? t.salesAnalytics.dineIn
                  : type === 'takeaway' ? t.salesAnalytics.takeaway
                  : t.salesAnalytics.delivery
                return (
                  <Box key={type} className='flex items-center justify-between'>
                    <Box className='flex items-center gap-2'>
                      <Chip label={typeLabel} size='small' color={TYPE_COLORS[type] || 'default'} />
                      <Typography variant='caption' color='text.secondary'>
                        {info.count} {t.salesAnalytics.orders}
                      </Typography>
                    </Box>
                    <Typography variant='subtitle2'>{parseFloat(info.revenue || 0).toFixed(2)}</Typography>
                  </Box>
                )
              })}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title={t.salesAnalytics.dailySales} subheader={period ? `${period.days} ${t.salesAnalytics.days}` : ''} />
          <Divider />
          <CardContent>
            <Box className='flex flex-col gap-3 mb-4'>
              <Box className='flex items-center justify-between'>
                <Typography variant='body2'>{t.salesAnalytics.dailyOrders}</Typography>
                <Chip label={averages.daily_orders || 0} size='small' color='primary' variant='tonal' />
              </Box>
              <Box className='flex items-center justify-between'>
                <Typography variant='body2'>{t.salesAnalytics.dailyRevenue}</Typography>
                <Chip label={parseFloat(averages.daily_revenue || 0).toFixed(2)} size='small' color='success' variant='tonal' />
              </Box>
            </Box>
            {dailyBreakdown.length > 0 && (
              <>
                <Divider className='mb-3' />
                <TableContainer>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t.salesAnalytics.colDate}</TableCell>
                        <TableCell align='center'>{t.salesAnalytics.colOrders}</TableCell>
                        <TableCell align='right'>{t.salesAnalytics.colRevenue}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dailyBreakdown.map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell>{day.date}</TableCell>
                          <TableCell align='center'>{day.orders}</TableCell>
                          <TableCell align='right'>{parseFloat(day.revenue || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Top Products */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={t.analyticsOverview.topProducts} />
          <Divider />
          <CardContent>
            {topProducts.length === 0 ? (
              <Typography variant='body2' color='text.secondary' align='center'>{t.analyticsOverview.noData}</Typography>
            ) : (
              topProducts.map((p: any) => {
                const qty = p.total_quantity_sold || 0
                const profit = parseFloat(p.profit || 0)
                return (
                  <Box key={p.id} className='flex items-center justify-between py-2 border-b last:border-b-0'>
                    <Box className='flex items-center gap-3'>
                      <Chip
                        label={`#${p.rank || ''}`}
                        size='small'
                        color={p.rank <= 3 ? 'primary' : 'default'}
                        variant={p.rank <= 3 ? 'filled' : 'outlined'}
                      />
                      <div>
                        <Typography variant='subtitle2'>{p.name}</Typography>
                        <Typography variant='caption' color='text.secondary'>{p.category || ''}</Typography>
                      </div>
                    </Box>
                    <Box className='flex items-center gap-3'>
                      <Box sx={{ width: 80 }}>
                        <LinearProgress variant='determinate' value={(qty / maxQty) * 100} color={p.rank <= 3 ? 'primary' : 'secondary'} />
                      </Box>
                      <Box className='text-right' sx={{ minWidth: 100 }}>
                        <Typography variant='subtitle2'>{qty} {t.analyticsOverview.sold}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {parseFloat(p.revenue || 0).toFixed(2)} {t.analyticsOverview.revenue}
                        </Typography>
                      </Box>
                      <Chip
                        label={profit.toFixed(2)}
                        size='small'
                        color={profit >= 0 ? 'success' : 'error'}
                      />
                    </Box>
                  </Box>
                )
              })
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default AnalyticsOverview
