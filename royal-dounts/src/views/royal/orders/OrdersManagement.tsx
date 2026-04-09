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

import { orderApi, paymentApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { useDictionary } from '@/contexts/dictionaryContext'
import { formatLocalDateTime } from '@/utils/timezone'

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  preparing: 'warning',
  done: 'success',
  cancelled: 'error',
}

const TYPE_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  dine_in: 'primary',
  takeaway: 'info',
  delivery: 'warning',
}

const OrdersManagement = () => {
  const { isAdmin } = useAuth()
  const t = useDictionary()
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [payingOrder, setPayingOrder] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paymentAmount, setPaymentAmount] = useState('')

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (typeFilter !== 'all') params.order_type = typeFilter
      const res = await orderApi.getAll(params)
      if (res.status === 'success') {
        setOrders(Array.isArray(res.data) ? res.data : res.data?.orders || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleExpandOrder = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      setOrderDetails(null)
      return
    }
    try {
      const res = await orderApi.getById(orderId)
      if (res.status === 'success') {
        setOrderDetails(res.data)
        setExpandedOrder(orderId)
      }
    } catch {
      // ignore
    }
  }

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      const res = await orderApi.updateStatus(orderId, status as any)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: `${t.orders.title} #${orderId} ${t.orders.statusUpdated} ${status}`, severity: 'success' })
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || t.orders.failedToUpdateStatus, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.orders.failedToUpdateStatus, severity: 'error' })
    }
  }

  const handleProcessPayment = async () => {
    if (!payingOrder || !paymentAmount) return
    try {
      const res = await paymentApi.process({
        order_id: payingOrder.id,
        payment_method: paymentMethod,
        amount: parseFloat(paymentAmount)
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: `${t.orders.paymentProcessed} #${payingOrder.id}`, severity: 'success' })
        setPaymentDialogOpen(false)
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || t.orders.paymentFailed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.orders.paymentFailed, severity: 'error' })
    }
  }

  const handleDelete = async (orderId: number) => {
    if (!confirm(`${t.orders.confirmDelete} #${orderId}?`)) return
    try {
      const res = await orderApi.delete(orderId)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.orders.orderDeleted, severity: 'success' })
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || t.orders.failedToDelete, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.orders.failedToDelete, severity: 'error' })
    }
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.orders.title}
          subheader={`${orders.length} ${t.orders.orderCount}`}
        />
        <Divider />
        {/* Filters */}
        <Box className='flex gap-4 p-4 flex-wrap'>
          <TextField
            select
            label={t.orders.labelStatus}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            size='small'
            className='min-w-[150px]'
          >
            <MenuItem value='all'>{t.orders.allStatuses}</MenuItem>
            <MenuItem value='pending'>{t.orders.statusPending}</MenuItem>
            <MenuItem value='preparing'>{t.orders.statusPreparing}</MenuItem>
            <MenuItem value='done'>{t.orders.statusDone}</MenuItem>
            <MenuItem value='cancelled'>{t.orders.statusCancelled}</MenuItem>
          </TextField>
          <TextField
            select
            label={t.orders.labelType}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            size='small'
            className='min-w-[150px]'
          >
            <MenuItem value='all'>{t.orders.allTypes}</MenuItem>
            <MenuItem value='dine_in'>{t.orders.typeDineIn}</MenuItem>
            <MenuItem value='takeaway'>{t.orders.typeTakeaway}</MenuItem>
            <MenuItem value='delivery'>{t.orders.typeDelivery}</MenuItem>
          </TextField>
          <Button variant='outlined' startIcon={<i className='tabler-refresh' />} onClick={fetchOrders}>
            {t.common.refresh}
          </Button>
        </Box>
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.orders.tableId}</TableCell>
                <TableCell>{t.orders.tableType}</TableCell>
                <TableCell>{t.orders.tableStatus}</TableCell>
                <TableCell>{t.orders.tableTotal}</TableCell>
                <TableCell>{t.orders.tableCustomer}</TableCell>
                <TableCell>{t.orders.tableDate}</TableCell>
                <TableCell align='right'>{t.orders.tableActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.orders.noOrdersFound}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => (
                  <Fragment key={order.id}>
                    <TableRow hover onClick={() => handleExpandOrder(order.id)} className='cursor-pointer'>
                      <TableCell>#{order.id}</TableCell>
                      <TableCell>
                        <Chip label={order.order_type?.replace('_', ' ')} size='small' color={TYPE_COLORS[order.order_type] || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip label={order.status} size='small' color={STATUS_COLORS[order.status] || 'default'} />
                      </TableCell>
                      <TableCell>{parseFloat(order.total || order.total_price || 0).toFixed(2)}</TableCell>
                      <TableCell>{order.customer_name || '-'}</TableCell>
                      <TableCell>{order.created_at ? formatLocalDateTime(order.created_at) : '-'}</TableCell>
                      <TableCell align='right' onClick={e => e.stopPropagation()}>
                        {order.status !== 'cancelled' && order.status !== 'done' && (
                          <>
                            {order.status === 'pending' && (
                              <IconButton size='small' color='warning' title='Mark Preparing'
                                onClick={() => handleUpdateStatus(order.id, 'preparing')}>
                                <i className='tabler-flame text-lg' />
                              </IconButton>
                            )}
                            {(order.status === 'pending' || order.status === 'preparing') && (
                              <IconButton size='small' color='success' title='Mark Done'
                                onClick={() => handleUpdateStatus(order.id, 'done')}>
                                <i className='tabler-check text-lg' />
                              </IconButton>
                            )}
                            <IconButton size='small' color='info' title='Process Payment'
                              onClick={() => {
                                setPayingOrder(order)
                                setPaymentAmount(String(parseFloat(order.total || order.total_price || 0)))
                                setPaymentDialogOpen(true)
                              }}>
                              <i className='tabler-cash text-lg' />
                            </IconButton>
                          </>
                        )}
                        {order.status !== 'cancelled' && (
                          <IconButton size='small' color='error' title='Cancel Order'
                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}>
                            <i className='tabler-x text-lg' />
                          </IconButton>
                        )}
                        {isAdmin && (
                          <IconButton size='small' color='error' title='Delete Order'
                            onClick={() => handleDelete(order.id)}>
                            <i className='tabler-trash text-lg' />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Expanded Details */}
                    <TableRow key={`detail-${order.id}`}>
                      <TableCell colSpan={7} style={{ paddingBottom: 0, paddingTop: 0, border: expandedOrder === order.id ? undefined : 'none' }}>
                        <Collapse in={expandedOrder === order.id} timeout='auto' unmountOnExit>
                          <Box className='p-4'>
                            {orderDetails && (
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <Typography variant='subtitle2' gutterBottom>{t.orders.orderItems}</Typography>
                                  {(orderDetails.items || orderDetails.order_items || []).map((item: any) => (
                                    <Box key={item.id} className='flex justify-between py-1'>
                                      <Typography variant='body2'>
                                        {item.product_name || item.name} x{item.quantity}
                                      </Typography>
                                      <Typography variant='body2'>
                                        {(parseFloat(item.price) * item.quantity).toFixed(2)}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <Typography variant='subtitle2'>{t.orders.details}</Typography>
                                  {orderDetails.customer_phone && (
                                    <Typography variant='body2'>{t.orders.phoneLabel}: {orderDetails.customer_phone}</Typography>
                                  )}
                                  {orderDetails.address && (
                                    <Typography variant='body2'>{t.orders.addressLabel}: {orderDetails.address}</Typography>
                                  )}
                                  {orderDetails.table_id && (
                                    <Typography variant='body2'>{t.orders.tableLabel}: #{orderDetails.table_id}</Typography>
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

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{t.orders.processPaymentTitle} #{payingOrder?.id}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important', overflow: 'visible' }}>
          <Typography variant='body2'>
            {t.orders.orderTotal} <strong>{parseFloat(payingOrder?.total || payingOrder?.total_price || 0).toFixed(2)}</strong>
          </Typography>
          <TextField
            select
            label={t.orders.labelPaymentMethod}
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as 'cash' | 'card')}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}
          >
            <MenuItem value='cash'>{t.orders.paymentCash}</MenuItem>
            <MenuItem value='card'>{t.orders.paymentCard}</MenuItem>
          </TextField>
          <TextField
            label={t.orders.labelAmount}
            type='number'
            value={paymentAmount}
            onChange={e => setPaymentAmount(e.target.value)}
            fullWidth
            inputProps={{ step: '0.01' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleProcessPayment}>{t.orders.processPayment}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default OrdersManagement
