'use client'

import { useEffect, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'

import { reportsApi } from '@/services/api'
import CustomAvatar from '@core/components/mui/Avatar'

const AnalyticsOverview = () => {
  const [dashboard, setDashboard] = useState<any>(null)
  const [topItems, setTopItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        const [dashboardRes, topRes] = await Promise.all([
          reportsApi.getDashboard(),
          reportsApi.getTopSelling({ limit: '10' })
        ])

        if (dashboardRes.status === 'success') setDashboard(dashboardRes.data)
        if (topRes.status === 'success') setTopItems(Array.isArray(topRes.data?.items) ? topRes.data.items : [])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  const report = dashboard?.today_report || {}
  const lowStockItems = dashboard?.low_stock_items || []
  const orderCounts = dashboard?.order_counts || []

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{report.total_orders || 0}</Typography>
            <Typography variant='body2' color='text.secondary'>طلبات اليوم</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(report.gross_income || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الدخل اليوم</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
              <i className='tabler-chart-line text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{parseFloat(report.net_profit || 0).toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>صافي الربح اليوم</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
              <i className='tabler-alert-triangle text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{lowStockItems.length}</Typography>
            <Typography variant='body2' color='text.secondary'>أصناف منخفضة المخزون</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardHeader title='حالات الطلبات الحالية' />
          <Divider />
          <CardContent className='flex flex-col gap-3'>
            {(orderCounts.length === 0) ? (
              <Typography variant='body2' color='text.secondary'>لا توجد بيانات</Typography>
            ) : (
              orderCounts.map((row: any) => (
                <div key={row.order_status} className='flex items-center justify-between'>
                  <Chip label={row.order_status} size='small' variant='tonal' />
                  <Typography variant='subtitle2'>{row.cnt}</Typography>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }}>
        <Card>
          <CardHeader title='أفضل الأصناف مبيعاً' />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>الصنف</TableCell>
                  <TableCell align='center'>الكمية</TableCell>
                  <TableCell align='right'>الإيراد</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topItems.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align='center'><Typography variant='body2' color='text.secondary'>لا توجد بيانات</Typography></TableCell></TableRow>
                ) : (
                  topItems.map((item: any, index: number) => (
                    <TableRow key={item.id || item.menu_item_id || index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.name || item.item_name || '-'}</TableCell>
                      <TableCell align='center'>{item.total_qty || item.total_quantity_sold || item.qty || 0}</TableCell>
                      <TableCell align='right'>{parseFloat(item.total_revenue || item.revenue || 0).toFixed(2)}</TableCell>
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

export default AnalyticsOverview
