'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { reportsApi, orderApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { formatInCairo, formatLocalTime } from '@/utils/timezone'
import CustomAvatar from '@core/components/mui/Avatar'

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'default',
  preparing: 'warning',
  ready: 'success',
  picked_up: 'info',
  cancelled: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  picked_up: 'تم الاستلام',
  cancelled: 'ملغي',
}

const AdminDashboard = () => {
  const { admin, isAdmin, isCashier, isKitchen } = useAuth()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const dashRes = await reportsApi.getDashboard()
        if (dashRes.status === 'success') {
          setDashboardData(dashRes.data)
        }

        // Fetch recent active orders for all roles
        const ordersRes = await orderApi.getActive({ statuses: 'pending,preparing,ready' })
        if (ordersRes.status === 'success') {
          const orders = Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders : []
          setRecentOrders(orders.slice(0, 10))
        }
      } catch {
        setError('فشل تحميل بيانات لوحة التحكم')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isAdmin, isKitchen])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  if (error) {
    return <Alert severity='error' className='m-4'>{error}</Alert>
  }

  const todayReport = dashboardData?.today_report || {}
  const lowStockItems: any[] = dashboardData?.low_stock_items || []
  const openCashierShifts: any[] = dashboardData?.open_cashier_shifts || []
  const openKitchenShifts: any[] = dashboardData?.open_kitchen_shifts || []
  const orderCounts: any[] = dashboardData?.order_counts || []

  const pendingCount = orderCounts.find((c: any) => c.order_status === 'pending')?.cnt || 0
  const preparingCount = orderCounts.find((c: any) => c.order_status === 'preparing')?.cnt || 0

  return (
    <Grid container spacing={6}>
      {/* Welcome Card */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={56}>
              <i className='tabler-cookie text-3xl' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>
                مرحباً بعودتك، {admin?.name || 'مستخدم'}! 🍩
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {formatInCairo(new Date(), 'ar-SA', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {' · '}
                <Chip
                  label={isAdmin ? 'مدير' : isCashier ? 'كاشير' : 'مطبخ'}
                  size='small'
                  color={isAdmin ? 'primary' : isCashier ? 'success' : 'warning'}
                />
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Stats Cards — hidden for kitchen */}
      {!isKitchen && (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                  <i className='tabler-receipt text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{todayReport.total_orders || 0}</Typography>
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
                <Typography variant='h4'>{parseFloat(todayReport.gross_income || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>إيرادات اليوم</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                  <i className='tabler-chart-bar text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(todayReport.net_profit || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>صافي الربح اليوم</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
                  <i className='tabler-clock text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{openCashierShifts.length + openKitchenShifts.length}</Typography>
                <Typography variant='body2' color='text.secondary'>الورديات النشطة</Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}

      {/* Kitchen: order count cards */}
      {isKitchen && (
        <>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='secondary' skin='light' size={48}>
                  <i className='tabler-clock text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{pendingCount}</Typography>
                <Typography variant='body2' color='text.secondary'>قيد الانتظار</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
                  <i className='tabler-flame text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{preparingCount}</Typography>
                <Typography variant='body2' color='text.secondary'>قيد التحضير</Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}

      {/* Low Stock Alert */}
      {(isAdmin || isKitchen) && lowStockItems.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
            <Typography variant='subtitle2' gutterBottom>
              تنبيه مخزون منخفض: {lowStockItems.length} صنف على وشك النفاد
            </Typography>
            <Typography variant='body2'>
              {lowStockItems.map((p: any) => `${p.name} (${p.current_qty} ${p.unit} متبقي)`).join(' · ')}
            </Typography>
          </Alert>
        </Grid>
      )}

      {/* Active Orders Table */}
      <Grid size={{ xs: 12, md: isAdmin ? 8 : 12 }}>
        <Card>
          <CardHeader title={isKitchen ? 'الطلبات النشطة' : 'الطلبات الأخيرة'} />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>رقم الطلب</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>العميل</TableCell>
                  <TableCell>الإجمالي</TableCell>
                  <TableCell>الدفع</TableCell>
                  <TableCell>الوقت</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد طلبات نشطة حالياً</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Typography variant='body2' fontWeight={600}>
                          {order.order_number || `#${order.id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[order.order_status] || order.order_status}
                          size='small'
                          color={STATUS_COLORS[order.order_status] || 'default'}
                        />
                      </TableCell>
                      <TableCell>{order.customer_name || '—'}</TableCell>
                      <TableCell>{parseFloat(order.total || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={order.payment_status === 'paid' ? 'مدفوع' : 'معلق'}
                          size='small'
                          color={order.payment_status === 'paid' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='caption' color='text.secondary'>
                          {order.created_at ? formatLocalTime(order.created_at, 'ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>

      {/* Active Shifts — Admin Only */}
      {isAdmin && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title='الورديات النشطة' />
            <Divider />
            <CardContent>
              {openCashierShifts.length === 0 && openKitchenShifts.length === 0 ? (
                <Typography variant='body2' color='text.secondary' align='center'>
                  لا توجد ورديات نشطة
                </Typography>
              ) : (
                <Box className='flex flex-col gap-3'>
                  {openCashierShifts.map((shift: any) => (
                    <Box key={`c-${shift.id}`} className='flex items-center gap-3 p-2 rounded border'>
                      <CustomAvatar variant='rounded' color='success' skin='light' size={36}>
                        <i className='tabler-cash text-lg' />
                      </CustomAvatar>
                      <div>
                        <Typography variant='subtitle2'>{shift.cashier_name}</Typography>
                        <Typography variant='caption' color='text.secondary'>كاشير</Typography>
                      </div>
                    </Box>
                  ))}
                  {openKitchenShifts.map((shift: any) => (
                    <Box key={`k-${shift.id}`} className='flex items-center gap-3 p-2 rounded border'>
                      <CustomAvatar variant='rounded' color='warning' skin='light' size={36}>
                        <i className='tabler-chef-hat text-lg' />
                      </CustomAvatar>
                      <div>
                        <Typography variant='subtitle2'>{shift.full_name}</Typography>
                        <Typography variant='caption' color='text.secondary'>مطبخ</Typography>
                      </div>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Admin summary: expenses + cancelled */}
      {isAdmin && (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='error' skin='light' size={48}>
                  <i className='tabler-receipt-2 text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{parseFloat(todayReport.total_expenses || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>مصاريف اليوم</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='error' skin='light' size={48}>
                  <i className='tabler-x text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{todayReport.cancelled_orders || 0}</Typography>
                <Typography variant='body2' color='text.secondary'>طلبات ملغاة اليوم</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='secondary' skin='light' size={48}>
                  <i className='tabler-box text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{lowStockItems.length}</Typography>
                <Typography variant='body2' color='text.secondary'>أصناف مخزون منخفض</Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}
    </Grid>
  )
}

export default AdminDashboard
