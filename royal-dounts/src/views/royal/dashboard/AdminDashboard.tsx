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
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { analyticsApi, orderApi, kitchenApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { useDictionary } from '@/contexts/dictionaryContext'
import { formatInCairo, formatLocalTime } from '@/utils/timezone'
import CustomAvatar from '@core/components/mui/Avatar'

const AdminDashboard = () => {
  const { admin, isAdmin, isCashier, isKitchen } = useAuth()
  const t = useDictionary()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // All roles get the dashboard summary (backend filters by role)
        const dashRes = await analyticsApi.getAdminDashboard()
        if (dashRes.status === 'success') {
          setDashboardData(dashRes.data)

          // For non-admin users, use the filtered recent_orders from the dashboard response
          if (!isAdmin && dashRes.data?.recent_orders) {
            setRecentOrders(dashRes.data.recent_orders)
          }
        }

        // Admin gets the full recent orders list
        if (isAdmin) {
          const orderParams: any = { start_date: formatInCairo(new Date(), 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) }
          const ordersRes = await orderApi.getAll(orderParams)
          if (ordersRes.status === 'success') {
            setRecentOrders(Array.isArray(ordersRes.data) ? ordersRes.data.slice(0, 10) : ordersRes.data?.orders?.slice(0, 10) || [])
          }
        }

        // Low stock for admin/kitchen
        if (isAdmin || isKitchen) {
          const stockRes = await kitchenApi.getLowStockProducts()
          if (stockRes.status === 'success') {
            setLowStock(Array.isArray(stockRes.data) ? stockRes.data : stockRes.data?.products || [])
          }
        }
      } catch (err) {
        setError(t.dashboard.failedToLoad)
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

  const today = dashboardData?.today || {}
  const comparison = dashboardData?.comparison || {}

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
                {t.dashboard.welcomeBack} {admin?.name || 'User'}! 🍩
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {formatInCairo(new Date(), undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
                {' · '}
                <Chip
                  label={admin?.role?.toUpperCase()}
                  size='small'
                  color={isAdmin ? 'primary' : isCashier ? 'success' : 'warning'}
                />
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Stats Cards - hidden for kitchen users */}
      {!isKitchen && (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                  <i className='tabler-receipt text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{today.orders || 0}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.dashboard.todaysOrders}</Typography>
                {comparison.orders_change_percent !== undefined && comparison.orders_change_percent !== 0 && (
                  <Chip
                    label={`${comparison.orders_change_percent > 0 ? '+' : ''}${comparison.orders_change_percent}%`}
                    size='small'
                    color={comparison.orders_change_percent >= 0 ? 'success' : 'error'}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                  <i className='tabler-currency-dollar text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{(today.revenue || 0).toFixed(2)}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.dashboard.todaysRevenue}</Typography>
                {comparison.revenue_change_percent !== undefined && comparison.revenue_change_percent !== 0 && (
                  <Chip
                    label={`${comparison.revenue_change_percent > 0 ? '+' : ''}${comparison.revenue_change_percent}%`}
                    size='small'
                    color={comparison.revenue_change_percent >= 0 ? 'success' : 'error'}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
                  <i className='tabler-clock text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{dashboardData?.active_shifts_count || 0}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.dashboard.activeShifts}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex flex-col items-center gap-2 p-6'>
                <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                  <i className='tabler-soup text-2xl' />
                </CustomAvatar>
                <Typography variant='h4'>{today.active_orders || 0}</Typography>
                <Typography variant='body2' color='text.secondary'>{t.dashboard.activeOrders}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}

      {/* Low Stock Alert */}
      {(isAdmin || isKitchen) && lowStock.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
            <Typography variant='subtitle2'>
              {t.dashboard.lowStockAlert}: {lowStock.length} {t.dashboard.productsRunningLow}
            </Typography>
            <Typography variant='body2'>
              {lowStock.map((p: any) => `${p.name} (${p.stock} ${t.dashboard.stockLeft})`).join(', ')}
            </Typography>
          </Alert>
        </Grid>
      )}

      {/* Recent Orders */}
      <Grid size={{ xs: 12, md: isAdmin ? 8 : 12 }}>
        <Card>
          <CardHeader title={isKitchen ? t.dashboard.completedOrders : t.dashboard.recentOrders} />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t.dashboard.tableId}</TableCell>
                  {isKitchen ? (
                    <>
                      <TableCell>{t.dashboard.tableItems}</TableCell>
                      <TableCell>{t.dashboard.tableDate}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>{t.dashboard.tableType}</TableCell>
                      <TableCell>{t.dashboard.tableStatus}</TableCell>
                      <TableCell>{t.dashboard.tableTotal}</TableCell>
                      <TableCell>{t.dashboard.tablePayment}</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isKitchen ? 3 : 5} align='center'>
                      <Typography variant='body2' color='text.secondary'>{t.dashboard.noOrdersYet}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell>#{order.id}</TableCell>
                      {isKitchen ? (
                        <>
                          <TableCell>
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item: any, idx: number) => (
                                <Typography key={idx} variant='caption' display='block' color='text.secondary'>
                                  {item.product_name} ×{item.quantity}
                                </Typography>
                              ))
                            ) : (
                              <Typography variant='caption' color='text.disabled'>—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant='caption' color='text.secondary'>
                              {order.created_at ? formatLocalTime(order.created_at, undefined, { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                            </Typography>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Chip
                              label={order.order_type}
                              size='small'
                              color={order.order_type === 'dine_in' ? 'primary' : order.order_type === 'takeaway' ? 'info' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.status}
                              size='small'
                              color={
                                order.status === 'done' ? 'success' :
                                order.status === 'preparing' ? 'warning' :
                                order.status === 'cancelled' ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{parseFloat(order.total || order.total_price || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Chip
                              label={order.payment_status || 'unpaid'}
                              size='small'
                              color={order.payment_status === 'paid' ? 'success' : 'default'}
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>

      {/* Active Shifts - Admin Only */}
      {isAdmin && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title={t.dashboard.activeShifts} />
            <Divider />
            <CardContent>
              {dashboardData?.active_shifts?.length === 0 ? (
                <Typography variant='body2' color='text.secondary' align='center'>
                  {t.dashboard.noActiveShifts}
                </Typography>
              ) : (
                <Box className='flex flex-col gap-3'>
                  {(dashboardData?.active_shifts || []).map((shift: any) => (
                    <Box key={shift.id} className='flex items-center gap-3 p-2 rounded border'>
                      <CustomAvatar variant='rounded' color='success' skin='light' size={36}>
                        <i className='tabler-user text-lg' />
                      </CustomAvatar>
                      <div>
                        <Typography variant='subtitle2'>{shift.cashier_name || shift.user_name || `User #${shift.user_id || shift.id}`}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {t.dashboard.since} {shift.start_time ? formatLocalTime(shift.start_time, undefined, { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                        </Typography>
                      </div>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Production Today */}
      {(isAdmin || isKitchen) && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-2 p-6'>
              <CustomAvatar variant='rounded' color='secondary' skin='light' size={48}>
                <i className='tabler-chef-hat text-2xl' />
              </CustomAvatar>
              <Typography variant='h4'>{dashboardData?.production_today || 0}</Typography>
              <Typography variant='body2' color='text.secondary'>{t.dashboard.itemsProducedToday}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {isAdmin && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-2 p-6'>
              <CustomAvatar variant='rounded' color='error' skin='light' size={48}>
                <i className='tabler-alert-circle text-2xl' />
              </CustomAvatar>
              <Typography variant='h4'>{dashboardData?.alerts?.low_stock_products || 0}</Typography>
              <Typography variant='body2' color='text.secondary'>{t.dashboard.lowStockProducts}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default AdminDashboard
