'use client'

import { useEffect, useState, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

import { kitchenApi, orderApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

const KitchenOrders = () => {
  const t = useDictionary()
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await kitchenApi.getOrders()
      if (res.status === 'success') {
        setOrders(Array.isArray(res.data) ? res.data : res.data?.orders || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchOrders, 15000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      const res = await orderApi.updateStatus(orderId, status as any)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: `${t.kitchen.orderNumber} #${orderId} → ${status}`, severity: 'success' })
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || t.kitchen.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.kitchen.failedToUpdate, severity: 'error' })
    }
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const preparingOrders = orders.filter(o => o.status === 'preparing')

  return (
    <>
      <Box className='flex items-center justify-between mb-6'>
        <div>
          <Typography variant='h4'>{t.kitchen.displayTitle} 🍩</Typography>
          <Typography variant='body2' color='text.secondary'>
            {pendingOrders.length} {t.kitchen.pending} · {preparingOrders.length} {t.kitchen.preparing}
          </Typography>
        </div>
        <Button variant='outlined' startIcon={<i className='tabler-refresh' />} onClick={fetchOrders}>
          {t.common.refresh}
        </Button>
      </Box>

      {orders.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-4 py-12'>
            <i className='tabler-chef-hat text-6xl text-gray-300' />
            <Typography variant='h6' color='text.secondary'>{t.kitchen.noActiveOrders}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.kitchen.ordersAppearAutomatically}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={4}>
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' className='mb-3' color='text.secondary'>
                <i className='tabler-clock' /> {t.kitchen.pendingSection} ({pendingOrders.length})
              </Typography>
              <Grid container spacing={3}>
                {pendingOrders.map(order => (
                  <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card className='border-l-4 border-l-gray-400'>
                      <CardHeader
                        title={`${t.kitchen.orderNumber} #${order.id}`}
                        subheader={
                          <Box className='flex gap-2 mt-1'>
                            <Chip label={order.order_type?.replace('_', ' ')} size='small' variant='outlined' />
                            <Chip label={t.kitchen.chipPending} size='small' color='default' />
                          </Box>
                        }
                      />
                      <Divider />
                      <CardContent>
                        {(order.items || order.order_items || []).map((item: any, i: number) => (
                          <Box key={i} className='flex justify-between py-1'>
                            <Typography variant='body2' fontWeight={500}>
                              {item.quantity}x {item.product_name || item.name}
                            </Typography>
                          </Box>
                        ))}
                        {order.customer_name && (
                          <Typography variant='caption' color='text.secondary' className='mt-2 block'>
                            {t.kitchen.customerLabel}: {order.customer_name}
                          </Typography>
                        )}
                        {order.table_id && (
                          <Typography variant='caption' color='text.secondary'>
                            {t.kitchen.tableLabel} #{order.table_id}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button
                          size='small'
                          variant='contained'
                          color='warning'
                          fullWidth
                          onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        >
                          {t.kitchen.startPreparing}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {/* Preparing Orders */}
          {preparingOrders.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' className='mb-3 mt-4' color='warning.main'>
                <i className='tabler-flame' /> {t.kitchen.preparingSection} ({preparingOrders.length})
              </Typography>
              <Grid container spacing={3}>
                {preparingOrders.map(order => (
                  <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card className='border-l-4 border-l-orange-400'>
                      <CardHeader
                        title={`${t.kitchen.orderNumber} #${order.id}`}
                        subheader={
                          <Box className='flex gap-2 mt-1'>
                            <Chip label={order.order_type?.replace('_', ' ')} size='small' variant='outlined' />
                            <Chip label={t.kitchen.chipPreparing} size='small' color='warning' />
                          </Box>
                        }
                      />
                      <Divider />
                      <CardContent>
                        {(order.items || order.order_items || []).map((item: any, i: number) => (
                          <Box key={i} className='flex justify-between py-1'>
                            <Typography variant='body2' fontWeight={500}>
                              {item.quantity}x {item.product_name || item.name}
                            </Typography>
                          </Box>
                        ))}
                        {order.customer_name && (
                          <Typography variant='caption' color='text.secondary' className='mt-2 block'>
                            {t.kitchen.customerLabel}: {order.customer_name}
                          </Typography>
                        )}
                        {order.table_id && (
                          <Typography variant='caption' color='text.secondary'>
                            {t.kitchen.tableLabel} #{order.table_id}
                          </Typography>
                        )}
                      </CardContent>
                      <CardActions>
                        <Button
                          size='small'
                          variant='contained'
                          color='success'
                          fullWidth
                          onClick={() => handleUpdateStatus(order.id, 'done')}
                        >
                          {t.kitchen.markDone}
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
        </Grid>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default KitchenOrders
