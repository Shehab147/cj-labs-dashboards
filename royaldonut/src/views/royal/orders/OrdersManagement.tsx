'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
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
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Grid from '@mui/material/Grid'
import Tooltip from '@mui/material/Tooltip'

import { orderApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { formatInCairo, formatLocalDateTime } from '@/utils/timezone'

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  preparing: 'warning',
  ready: 'success',
  picked_up: 'info',
  cancelled: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  preparing: 'قيد التحضير',
  ready: 'جاهز للاستلام',
  picked_up: 'تم الاستلام',
  cancelled: 'ملغي',
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'معلق',
  paid: 'مدفوع',
  refunded: 'مسترد',
  partially_refunded: 'مسترد جزئياً',
}

const today = () => formatInCairo(new Date(), 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
const weekAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 7)
  return formatInCairo(d, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const OrdersManagement = () => {
  const { isAdmin } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [orderDetail, setOrderDetail] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromDate, setFromDate] = useState(weekAgo())
  const [toDate, setToDate] = useState(today())
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Payment update dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payingOrder, setPayingOrder] = useState<any>(null)
  const [payStatus, setPayStatus] = useState<string>('paid')
  const [payMethod, setPayMethod] = useState<string>('cash')

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const params: any = { from: fromDate, to: toDate }
      if (statusFilter !== 'all') params.status = statusFilter

      const res = await orderApi.getAll(params)
      if (res.status === 'success') {
        setOrders(Array.isArray(res.data?.orders) ? res.data.orders : [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, fromDate, toDate])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleExpandOrder = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      setOrderDetail(null)
      return
    }
    try {
      const res = await orderApi.getOrder(String(orderId))
      if (res.status === 'success') {
        setOrderDetail(res.data?.order)
        setExpandedOrder(orderId)
      }
    } catch {
      // ignore
    }
  }

  const handleUpdateStatus = async (orderId: number, status: 'preparing' | 'ready' | 'picked_up' | 'cancelled') => {
    try {
      const res = await orderApi.updateStatus(orderId, status)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: `تم تحديث الطلب #${orderId} إلى "${STATUS_LABELS[status]}"`, severity: 'success' })
        fetchOrders()
        if (expandedOrder === orderId) handleExpandOrder(orderId)
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل تحديث الحالة', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل تحديث الحالة', severity: 'error' })
    }
  }

  const handleCancel = async (orderId: number) => {
    if (!confirm(`إلغاء الطلب #${orderId}؟`)) return
    try {
      const res = await orderApi.cancel(orderId)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: `تم إلغاء الطلب #${orderId}`, severity: 'success' })
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل الإلغاء', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل الإلغاء', severity: 'error' })
    }
  }

  const handlePaymentUpdate = async () => {
    if (!payingOrder) return
    try {
      const res = await orderApi.updatePayment({
        order_id: payingOrder.id,
        payment_status: payStatus as any,
        payment_method: payMethod as any
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم تحديث الدفع', severity: 'success' })
        setPayDialogOpen(false)
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل تحديث الدفع', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل تحديث الدفع', severity: 'error' })
    }
  }

  // Print order detail
  const handlePrint = async (order: any) => {
    let detail = order
    let items = detail?.items || detail?.order_items || detail?.details || []

    // If the table row object doesn't include items, fetch full order detail first.
    if (!Array.isArray(items) || items.length === 0) {
      const res = await orderApi.getOrder(String(order.id))
      if (res.status === 'success') {
        detail = res.data?.order || detail
        items = detail?.items || detail?.order_items || detail?.details || []
      }
    }

    const html = `
      <html dir="rtl"><head><meta charset="utf-8"/><title>طلب ${detail.order_number || `#${detail.id}`}</title>
      <style>body{font-family:Arial;font-size:13px;max-width:300px;margin:0 auto;padding:12px}
      h3{text-align:center}table{width:100%;border-collapse:collapse}
      td,th{padding:4px 6px;border-bottom:1px solid #eee}
      @media print{button{display:none}}</style></head>
      <body>
        <h3>🍩 رويال دونتس</h3>
        <p><strong>${detail.order_number || `#${detail.id}`}</strong> &nbsp;|&nbsp; ${formatLocalDateTime(detail.created_at, 'ar-SA')}</p>
        ${detail.customer_name ? `<p>العميل: ${detail.customer_name}</p>` : ''}
        <table><tr><th>الصنف</th><th>ك</th><th>المجموع</th></tr>
        ${(items || []).map((i: any) => `<tr><td>${i.item_name || i.name || '-'}</td><td>${i.quantity || i.qty || 0}</td><td>${parseFloat(i.line_total || i.total_price || i.total || 0).toFixed(2)}</td></tr>`).join('')}
        </table>
        <p>الإجمالي: <strong>${parseFloat(detail.total||0).toFixed(2)} ج.م</strong></p>
        <p>الحالة: ${STATUS_LABELS[detail.order_status] || detail.order_status}</p>
        <p>الدفع: ${PAYMENT_LABELS[detail.payment_status] || detail.payment_status}</p>
        <script>window.print();</script>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Card>
        <CardHeader
          title='إدارة الطلبات'
          subheader={`${orders.length} طلب`}
        />
        <Divider />

        {/* Filters */}
        <Box className='flex gap-4 p-4 flex-wrap items-end'>
          <TextField
            label='من تاريخ'
            type='date'
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            size='small'
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label='إلى تاريخ'
            type='date'
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            size='small'
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select label='الحالة'
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            size='small' className='min-w-[150px]'
          >
            <MenuItem value='all'>جميع الحالات</MenuItem>
            <MenuItem value='pending'>قيد الانتظار</MenuItem>
            <MenuItem value='preparing'>قيد التحضير</MenuItem>
            <MenuItem value='ready'>جاهز</MenuItem>
            <MenuItem value='picked_up'>تم الاستلام</MenuItem>
            <MenuItem value='cancelled'>ملغي</MenuItem>
          </TextField>
          <Button variant='outlined' startIcon={<i className='tabler-refresh' />} onClick={fetchOrders}>
            تحديث
          </Button>
        </Box>

        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>رقم الطلب</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>العميل</TableCell>
                <TableCell>المجموع</TableCell>
                <TableCell>طريقة الدفع</TableCell>
                <TableCell>حالة الدفع</TableCell>
                <TableCell>التاريخ</TableCell>
                <TableCell align='right'>إجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align='center'>
                    <Typography variant='body2' color='text.secondary'>لا توجد طلبات في هذه الفترة</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => (
                  <Fragment key={order.id}>
                    <TableRow hover onClick={() => handleExpandOrder(order.id)} className='cursor-pointer'>
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
                        {order.payment_method === 'cash' ? 'نقدي' :
                         order.payment_method === 'card' ? 'بطاقة' :
                         order.payment_method === 'online' ? 'إلكتروني' : order.payment_method || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={PAYMENT_LABELS[order.payment_status] || order.payment_status}
                          size='small'
                          color={order.payment_status === 'paid' ? 'success' :
                                 order.payment_status === 'refunded' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='caption' color='text.secondary'>
                          {order.created_at ? formatLocalDateTime(order.created_at, 'ar-SA') : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right' onClick={e => e.stopPropagation()}>
                        {/* Status actions */}
                        {order.order_status === 'pending' && (
                          <Tooltip title='بدء التحضير'>
                            <IconButton size='small' color='warning' onClick={() => handleUpdateStatus(order.id, 'preparing')}>
                              <i className='tabler-flame text-lg' />
                            </IconButton>
                          </Tooltip>
                        )}
                        {order.order_status === 'preparing' && (
                          <Tooltip title='جاهز للاستلام'>
                            <IconButton size='small' color='success' onClick={() => handleUpdateStatus(order.id, 'ready')}>
                              <i className='tabler-check text-lg' />
                            </IconButton>
                          </Tooltip>
                        )}
                        {order.order_status === 'ready' && (
                          <Tooltip title='تم الاستلام'>
                            <IconButton size='small' color='info' onClick={() => handleUpdateStatus(order.id, 'picked_up')}>
                              <i className='tabler-shopping-bag text-lg' />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Payment */}
                        {order.order_status !== 'cancelled' && order.payment_status !== 'paid' && (
                          <Tooltip title='تحديث الدفع'>
                            <IconButton size='small' color='primary' onClick={() => {
                              setPayingOrder(order)
                              setPayStatus('paid')
                              setPayMethod(order.payment_method || 'cash')
                              setPayDialogOpen(true)
                            }}>
                              <i className='tabler-cash text-lg' />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Print */}
                        <Tooltip title='طباعة'>
                          <IconButton size='small' onClick={() => handlePrint(orderDetail?.id === order.id ? orderDetail : order)}>
                            <i className='tabler-printer text-lg' />
                          </IconButton>
                        </Tooltip>
                        {/* Cancel */}
                        {order.order_status !== 'cancelled' && order.order_status !== 'picked_up' && (
                          <Tooltip title='إلغاء الطلب'>
                            <IconButton size='small' color='error' onClick={() => handleCancel(order.id)}>
                              <i className='tabler-x text-lg' />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    <TableRow key={`detail-${order.id}`}>
                      <TableCell colSpan={8} style={{ paddingBottom: 0, paddingTop: 0, border: expandedOrder === order.id ? undefined : 'none' }}>
                        <Collapse in={expandedOrder === order.id} timeout='auto' unmountOnExit>
                          <Box className='p-4 bg-gray-50 dark:bg-gray-900 rounded-b'>
                            {orderDetail && (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <Typography variant='subtitle2' gutterBottom>أصناف الطلب</Typography>
                                  {(orderDetail.items || []).map((item: any, i: number) => (
                                    <Box key={i} className='flex justify-between py-1'>
                                      <div>
                                        <Typography variant='body2'>{item.item_name} × {item.quantity}</Typography>
                                        {item.special_request && (
                                          <Typography variant='caption' color='text.secondary'>ملاحظة: {item.special_request}</Typography>
                                        )}
                                      </div>
                                      <Typography variant='body2'>{parseFloat(item.line_total || 0).toFixed(2)}</Typography>
                                    </Box>
                                  ))}
                                  <Divider className='my-2' />
                                  {parseFloat(orderDetail.discount_amount || 0) > 0 && (
                                    <Box className='flex justify-between'>
                                      <Typography variant='body2'>خصم</Typography>
                                      <Typography variant='body2' color='error'>- {parseFloat(orderDetail.discount_amount).toFixed(2)}</Typography>
                                    </Box>
                                  )}
                                  <Box className='flex justify-between'>
                                    <Typography variant='body2' fontWeight={600}>الإجمالي</Typography>
                                    <Typography variant='body2' fontWeight={600}>{parseFloat(orderDetail.total || 0).toFixed(2)} ج.م</Typography>
                                  </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <Typography variant='subtitle2' gutterBottom>تفاصيل</Typography>
                                  {orderDetail.customer_phone && (
                                    <Typography variant='body2'>الهاتف: {orderDetail.customer_phone}</Typography>
                                  )}
                                  {orderDetail.notes && (
                                    <Typography variant='body2'>ملاحظات: {orderDetail.notes}</Typography>
                                  )}
                                  {orderDetail.status_log && orderDetail.status_log.length > 0 && (
                                    <Box className='mt-2'>
                                      <Typography variant='caption' color='text.secondary'>سجل الحالات:</Typography>
                                      {orderDetail.status_log.map((log: any, i: number) => (
                                        <Typography key={i} variant='caption' display='block' color='text.secondary'>
                                          {log.old_status} → {log.new_status} · {log.changed_by_name}
                                        </Typography>
                                      ))}
                                    </Box>
                                  )}
                                </Grid>
                              </Grid>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Payment Update Dialog */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>تحديث الدفع — {payingOrder?.order_number || `#${payingOrder?.id}`}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important', overflow: 'visible' }}>
          <Typography variant='body2'>
            الإجمالي: <strong>{parseFloat(payingOrder?.total || 0).toFixed(2)} ج.م</strong>
          </Typography>
          <TextField
            select label='حالة الدفع'
            value={payStatus}
            onChange={e => setPayStatus(e.target.value)}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false } } }}
          >
            <MenuItem value='paid'>مدفوع</MenuItem>
            <MenuItem value='pending'>معلق</MenuItem>
            <MenuItem value='refunded'>مسترد</MenuItem>
            <MenuItem value='partially_refunded'>مسترد جزئياً</MenuItem>
          </TextField>
          <TextField
            select label='طريقة الدفع'
            value={payMethod}
            onChange={e => setPayMethod(e.target.value)}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false } } }}
          >
            <MenuItem value='cash'>نقدي</MenuItem>
            <MenuItem value='card'>بطاقة</MenuItem>
            <MenuItem value='online'>إلكتروني</MenuItem>
            <MenuItem value='other'>أخرى</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' onClick={handlePaymentUpdate}>حفظ</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default OrdersManagement
