'use client'

import { useEffect, useState, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import { orderApi } from '@/services/api'
import { formatInCairo, formatLocalDateTime } from '@/utils/timezone'

const today = () => formatInCairo(new Date(), 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })

const monthStart = () => {
  const d = new Date()

  d.setDate(1)

  return formatInCairo(d, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const RefundsManagement = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [paymentStatus, setPaymentStatus] = useState<'refunded' | 'partially_refunded'>('refunded')
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await orderApi.getAll({ from: fromDate, to: toDate })

      if (res.status === 'success') {
        setOrders(Array.isArray(res.data?.orders) ? res.data.orders : [])
      }
    } finally {
      setIsLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleSubmit = async () => {
    if (!selectedOrder) return

    try {
      const res = await orderApi.updatePayment({
        order_id: selectedOrder.id,
        payment_status: paymentStatus
      })

      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم تحديث حالة الدفع بنجاح', severity: 'success' })
        setDialogOpen(false)
        setSelectedOrder(null)
        fetchOrders()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل تحديث حالة الدفع', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل تحديث حالة الدفع', severity: 'error' })
    }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const refundedOrders = orders.filter(o => ['refunded', 'partially_refunded'].includes(o.payment_status))

  return (
    <>
      <Card>
        <CardHeader
          title='إدارة المرتجعات'
          subheader={`عدد الطلبات المسترجعة: ${refundedOrders.length}`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setDialogOpen(true)}>
              تحديث حالة استرجاع
            </Button>
          }
        />
        <Divider />

        <div className='flex gap-3 p-4 flex-wrap'>
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
          <Button variant='outlined' onClick={fetchOrders} startIcon={<i className='tabler-refresh' />}>
            تحديث
          </Button>
        </div>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>رقم الطلب</TableCell>
                <TableCell>العميل</TableCell>
                <TableCell>الإجمالي</TableCell>
                <TableCell>حالة الدفع</TableCell>
                <TableCell>تاريخ الطلب</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refundedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align='center'>
                    <Typography variant='body2' color='text.secondary'>لا توجد طلبات مسترجعة في هذه الفترة</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                refundedOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.order_number || `#${order.id}`}</TableCell>
                    <TableCell>{order.customer_name || '—'}</TableCell>
                    <TableCell>{parseFloat(order.total || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={order.payment_status === 'refunded' ? 'مسترد بالكامل' : 'استرداد جزئي'}
                        size='small'
                        color={order.payment_status === 'refunded' ? 'error' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>{order.created_at ? formatLocalDateTime(order.created_at, 'ar-SA') : '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>تحديث حالة الدفع إلى استرجاع</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pt-4'>
          <TextField
            select
            label='الطلب'
            value={selectedOrder?.id || ''}
            onChange={e => setSelectedOrder(orders.find(o => o.id === Number(e.target.value)) || null)}
            fullWidth
          >
            {orders.filter(o => ['paid', 'partially_refunded', 'refunded'].includes(o.payment_status)).map(order => (
              <MenuItem key={order.id} value={order.id}>
                {(order.order_number || `#${order.id}`)} - {parseFloat(order.total || 0).toFixed(2)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label='نوع الاسترجاع'
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value as 'refunded' | 'partially_refunded')}
            fullWidth
          >
            <MenuItem value='refunded'>استرجاع كامل</MenuItem>
            <MenuItem value='partially_refunded'>استرجاع جزئي</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' color='error' onClick={handleSubmit} disabled={!selectedOrder}>تحديث</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default RefundsManagement
