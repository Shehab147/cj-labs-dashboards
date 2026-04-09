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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'

import { orderApi, kitchenShiftApi, stockApi } from '@/services/api'
import { formatLocalTime } from '@/utils/timezone'

const KitchenOrders = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasShift, setHasShift] = useState(false)
  const [currentShift, setCurrentShift] = useState<any>(null)

  // Shift management
  const [startShiftOpen, setStartShiftOpen] = useState(false)
  const [startNotes, setStartNotes] = useState('')
  const [endShiftOpen, setEndShiftOpen] = useState(false)
  const [endNotes, setEndNotes] = useState('')
  const [stockItems, setStockItems] = useState<any[]>([])
  const [closingStock, setClosingStock] = useState<Record<number, string>>({})

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchShift = useCallback(async () => {
    try {
      const res = await kitchenShiftApi.getMy()
      if (res.status === 'success' && res.data?.shift) {
        setHasShift(true)
        setCurrentShift(res.data.shift)
      } else {
        setHasShift(false)
        setCurrentShift(null)
      }
    } catch {
      setHasShift(false)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await orderApi.getActive({ statuses: 'pending,preparing,ready' })
      if (res.status === 'success') {
        setOrders(Array.isArray(res.data?.orders) ? res.data.orders : [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchShift()
    fetchOrders()
    // Auto-refresh every 20 seconds
    const interval = setInterval(() => {
      fetchOrders()
    }, 20000)
    return () => clearInterval(interval)
  }, [fetchShift, fetchOrders])

  const handleStartShift = async () => {
    try {
      const res = await kitchenShiftApi.start({ notes: startNotes })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم بدء وردية المطبخ بنجاح', severity: 'success' })
        setStartShiftOpen(false)
        fetchShift()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل بدء الوردية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل بدء الوردية', severity: 'error' })
    }
  }

  const handleOpenEndShift = async () => {
    try {
      const stockRes = await stockApi.getStock()
      if (stockRes.status === 'success') {
        const items = stockRes.data?.items || []
        setStockItems(items)
        // Pre-fill with current quantities
        const init: Record<number, string> = {}
        items.forEach((item: any) => { init[item.id] = item.current_qty })
        setClosingStock(init)
      }
    } catch {
      setStockItems([])
    }
    setEndShiftOpen(true)
  }

  const handleEndShift = async () => {
    try {
      const closingStockData = stockItems.map((item: any) => ({
        stock_item_id: item.id,
        qty: parseFloat(closingStock[item.id] || '0') || 0
      }))
      const res = await kitchenShiftApi.end({
        notes: endNotes,
        closing_stock: closingStockData
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم إنهاء وردية المطبخ بنجاح', severity: 'success' })
        setEndShiftOpen(false)
        fetchShift()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل إنهاء الوردية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل إنهاء الوردية', severity: 'error' })
    }
  }

  const handleUpdateStatus = async (orderId: number, status: 'preparing' | 'ready') => {
    try {
      const res = await orderApi.updateStatus(orderId, status)
      if (res.status === 'success') {
        setSnackbar({
          open: true,
          message: `طلب #${orderId} → ${status === 'preparing' ? 'قيد التحضير' : 'جاهز'}`,
          severity: 'success'
        })
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل التحديث', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل التحديث', severity: 'error' })
    }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const pendingOrders = orders.filter(o => o.order_status === 'pending')
  const preparingOrders = orders.filter(o => o.order_status === 'preparing')
  const readyOrders = orders.filter(o => o.order_status === 'ready')

  return (
    <>
      {/* Shift Banner */}
      <Box className='flex items-center justify-between mb-6 p-3 rounded border'>
        <Box>
          <Typography variant='h5'>شاشة المطبخ 🍩</Typography>
          <Typography variant='body2' color='text.secondary'>
            {pendingOrders.length} انتظار · {preparingOrders.length} تحضير · {readyOrders.length} جاهز
          </Typography>
        </Box>
        <Box className='flex gap-2 items-center'>
          {hasShift ? (
            <>
              <Chip label='وردية نشطة' color='success' size='small' />
              <Typography variant='caption' color='text.secondary'>
                {currentShift?.started_at ? `بدأت: ${formatLocalTime(currentShift.started_at, 'ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
              </Typography>
              <Button variant='outlined' color='error' size='small' onClick={handleOpenEndShift}>
                إنهاء الوردية
              </Button>
            </>
          ) : (
            <Button variant='contained' onClick={() => setStartShiftOpen(true)}>
              بدء وردية المطبخ
            </Button>
          )}
          <Button variant='outlined' startIcon={<i className='tabler-refresh' />} onClick={fetchOrders} size='small'>
            تحديث
          </Button>
        </Box>
      </Box>

      {!hasShift && (
        <Alert severity='warning' className='mb-4'>
          لا توجد وردية مطبخ نشطة. ابدأ وردية لتتمكن من معالجة الطلبات.
        </Alert>
      )}

      {orders.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-4 py-12'>
            <i className='tabler-chef-hat text-6xl text-gray-300' />
            <Typography variant='h6' color='text.secondary'>لا توجد طلبات نشطة حالياً</Typography>
            <Typography variant='body2' color='text.secondary'>ستظهر الطلبات هنا تلقائياً كل 20 ثانية</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={4}>
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' className='mb-3' color='text.secondary'>
                <i className='tabler-clock' /> قيد الانتظار ({pendingOrders.length})
              </Typography>
              <Grid container spacing={3}>
                {pendingOrders.map(order => (
                  <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'grey.400' }}>
                      <CardHeader
                        title={order.order_number || `طلب #${order.id}`}
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                        subheader={
                          <Box className='flex gap-2 mt-1 flex-wrap'>
                            <Chip label='قيد الانتظار' size='small' color='default' />
                            {order.customer_name && (
                              <Chip label={order.customer_name} size='small' variant='outlined' />
                            )}
                          </Box>
                        }
                      />
                      <Divider />
                      <CardContent>
                        {(order.items || []).map((item: any, i: number) => (
                          <Box key={i} className='flex justify-between py-1'>
                            <Typography variant='body2' fontWeight={500}>
                              {item.quantity}× {item.item_name}
                            </Typography>
                          </Box>
                        ))}
                        {(order.items || []).some((i: any) => i.special_request) && (
                          <Box className='mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded'>
                            {(order.items || []).filter((i: any) => i.special_request).map((item: any, idx: number) => (
                              <Typography key={idx} variant='caption' display='block' color='warning.main'>
                                {item.item_name}: {item.special_request}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        <Typography variant='caption' color='text.secondary' className='mt-2 block'>
                          {order.created_at ? formatLocalTime(order.created_at, 'ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button
                          size='small' variant='contained' color='warning'
                          fullWidth
                          disabled={!hasShift}
                          onClick={() => handleUpdateStatus(order.id, 'preparing')}
                          startIcon={<i className='tabler-flame' />}
                        >
                          بدء التحضير
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
              <Typography variant='h6' className='mb-3' color='warning.main'>
                <i className='tabler-flame' /> قيد التحضير ({preparingOrders.length})
              </Typography>
              <Grid container spacing={3}>
                {preparingOrders.map(order => (
                  <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
                      <CardHeader
                        title={order.order_number || `طلب #${order.id}`}
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                        subheader={
                          <Box className='flex gap-2 mt-1'>
                            <Chip label='قيد التحضير' size='small' color='warning' />
                            {order.customer_name && (
                              <Chip label={order.customer_name} size='small' variant='outlined' />
                            )}
                          </Box>
                        }
                      />
                      <Divider />
                      <CardContent>
                        {(order.items || []).map((item: any, i: number) => (
                          <Box key={i} className='flex justify-between py-1'>
                            <Typography variant='body2' fontWeight={500}>
                              {item.quantity}× {item.item_name}
                            </Typography>
                          </Box>
                        ))}
                        {(order.items || []).some((i: any) => i.special_request) && (
                          <Box className='mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded'>
                            {(order.items || []).filter((i: any) => i.special_request).map((item: any, idx: number) => (
                              <Typography key={idx} variant='caption' display='block' color='warning.main'>
                                {item.item_name}: {item.special_request}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        <Typography variant='caption' color='text.secondary' className='mt-2 block'>
                          {order.created_at ? formatLocalTime(order.created_at, 'ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button
                          size='small' variant='contained' color='success'
                          fullWidth
                          disabled={!hasShift}
                          onClick={() => handleUpdateStatus(order.id, 'ready')}
                          startIcon={<i className='tabler-check' />}
                        >
                          جاهز ✓
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {/* Ready Orders */}
          {readyOrders.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' className='mb-3' color='success.main'>
                <i className='tabler-check' /> جاهز للاستلام ({readyOrders.length})
              </Typography>
              <Grid container spacing={3}>
                {readyOrders.map(order => (
                  <Grid key={order.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'success.main' }}>
                      <CardHeader
                        title={order.order_number || `طلب #${order.id}`}
                        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                        subheader={<Chip label='جاهز' size='small' color='success' />}
                      />
                      <Divider />
                      <CardContent>
                        {(order.items || []).map((item: any, i: number) => (
                          <Box key={i} className='flex justify-between py-1'>
                            <Typography variant='body2'>{item.quantity}× {item.item_name}</Typography>
                          </Box>
                        ))}
                        {order.customer_name && (
                          <Typography variant='caption' color='text.secondary'>العميل: {order.customer_name}</Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
        </Grid>
      )}

      {/* Start Shift Dialog */}
      <Dialog open={startShiftOpen} onClose={() => setStartShiftOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>بدء وردية المطبخ</DialogTitle>
        <DialogContent sx={{ pt: '1rem !important' }}>
          <TextField
            label='ملاحظات (اختياري)'
            value={startNotes}
            onChange={e => setStartNotes(e.target.value)}
            fullWidth multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartShiftOpen(false)}>إلغاء</Button>
          <Button variant='contained' onClick={handleStartShift}>بدء الوردية</Button>
        </DialogActions>
      </Dialog>

      {/* End Shift Dialog */}
      <Dialog open={endShiftOpen} onClose={() => setEndShiftOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>إنهاء وردية المطبخ — جرد المخزون الختامي</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '1rem !important' }}>
          <Typography variant='body2' color='text.secondary'>
            أدخل الكميات الفعلية المتبقية من كل صنف في المخزون:
          </Typography>
          {stockItems.map((item: any) => (
            <Box key={item.id} className='flex items-center gap-3'>
              <Typography variant='body2' className='flex-1'>
                {item.name} ({item.unit})
              </Typography>
              <TextField
                type='number'
                size='small'
                value={closingStock[item.id] || ''}
                onChange={e => setClosingStock(prev => ({ ...prev, [item.id]: e.target.value }))}
                sx={{ width: 120 }}
                inputProps={{ step: '0.001', min: '0' }}
                label='الكمية'
              />
            </Box>
          ))}
          <Divider />
          <TextField
            label='ملاحظات (اختياري)'
            value={endNotes}
            onChange={e => setEndNotes(e.target.value)}
            fullWidth multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndShiftOpen(false)}>إلغاء</Button>
          <Button variant='contained' color='error' onClick={handleEndShift}>إنهاء الوردية</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default KitchenOrders
