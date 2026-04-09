'use client'

import { useEffect, useState, useCallback } from 'react'
import { printHtml } from '@/utils/printHtml'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Badge from '@mui/material/Badge'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

import { menuApi, orderApi, cashierShiftApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { formatInCairo, formatLocalTime } from '@/utils/timezone'

interface CartItem {
  menu_item_id: number
  name: string
  price: number
  quantity: number
  special_request?: string
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'card', label: 'بطاقة' },
  { value: 'online', label: 'إلكتروني' },
  { value: 'other', label: 'أخرى' },
]

const POS = () => {
  const { admin } = useAuth()
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasShift, setHasShift] = useState(false)
  const [currentShift, setCurrentShift] = useState<any>(null)

  // Order form
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online' | 'other'>('cash')
  const [orderNotes, setOrderNotes] = useState('')

  // Shift dialog
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [endShiftDialogOpen, setEndShiftDialogOpen] = useState(false)
  const [closingCash, setClosingCash] = useState('')
  const [shiftNotes, setShiftNotes] = useState('')
  const [shiftSummary, setShiftSummary] = useState<any>(null)

  // Payment dialog after order placed
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [lastOrder, setLastOrder] = useState<any>(null)

  // Special request dialog
  const [specialReqItem, setSpecialReqItem] = useState<CartItem | null>(null)
  const [specialReqText, setSpecialReqText] = useState('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [menuRes, catRes, shiftRes] = await Promise.all([
        menuApi.getMenu('1'),
        menuApi.getCategories(),
        cashierShiftApi.getMy()
      ])

      if (menuRes.status === 'success') setMenuItems(menuRes.data?.items || [])
      if (catRes.status === 'success') setCategories(catRes.data?.categories || [])

      if (shiftRes.status === 'success' && shiftRes.data?.shift) {
        setHasShift(true)
        setCurrentShift(shiftRes.data.shift)
      } else {
        setHasShift(false)
        setCurrentShift(null)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredItems = selectedCategory === 'all'
    ? menuItems
    : menuItems.filter(item => item.category_id === selectedCategory)

  const addToCart = (item: any) => {
    if (!item.is_available) return
    setCart(prev => {
      const existing = prev.find(c => c.menu_item_id === item.id)
      if (existing) {
        return prev.map(c => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: parseFloat(item.price), quantity: 1 }]
    })
  }

  const updateQty = (itemId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.menu_item_id !== itemId))
    } else {
      setCart(prev => prev.map(c => c.menu_item_id === itemId ? { ...c, quantity: qty } : c))
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = parseFloat(discountAmount) || 0
  const total = Math.max(0, subtotal - discount)

  const handleStartShift = async () => {
    if (!openingCash) return
    try {
      const res = await cashierShiftApi.start({ opening_cash: parseFloat(openingCash) })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم بدء الوردية بنجاح', severity: 'success' })
        setShiftDialogOpen(false)
        setOpeningCash('')
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل بدء الوردية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل بدء الوردية', severity: 'error' })
    }
  }

  const handleEndShift = async () => {
    if (!closingCash) return
    try {
      const res = await cashierShiftApi.end({ closing_cash: parseFloat(closingCash), notes: shiftNotes })
      if (res.status === 'success') {
        setShiftSummary(res.data?.shift)
        setEndShiftDialogOpen(false)
        setSnackbar({ open: true, message: 'تم إنهاء الوردية بنجاح', severity: 'success' })
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل إنهاء الوردية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل إنهاء الوردية', severity: 'error' })
    }
  }

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setSnackbar({ open: true, message: 'السلة فارغة', severity: 'error' })
      return
    }
    try {
      const res = await orderApi.place({
        items: cart.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          special_request: item.special_request || ''
        })),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        discount_amount: discount || undefined,
        payment_method: paymentMethod,
        payment_status: 'pending',
        notes: orderNotes || undefined
      })

      if (res.status === 'success') {
        setLastOrder(res.data?.order)
        setPaymentDialogOpen(true)
        setSnackbar({ open: true, message: `تم إنشاء الطلب ${res.data?.order?.order_number || ''}`, severity: 'success' })
        setCart([])
        setCustomerName('')
        setCustomerPhone('')
        setDiscountAmount('0')
        setOrderNotes('')
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل إنشاء الطلب', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل إنشاء الطلب', severity: 'error' })
    }
  }

  const handleMarkPaid = async () => {
    if (!lastOrder) return
    try {
      const res = await orderApi.updatePayment({
        order_id: lastOrder.id,
        payment_status: 'paid',
        payment_method: lastOrder.payment_method
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم تسجيل الدفع بنجاح', severity: 'success' })
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل تسجيل الدفع', severity: 'error' })
      }
    } catch {
      // ignore
    }
    setPaymentDialogOpen(false)
  }

  // Print receipt
  const handlePrintReceipt = () => {
    if (!lastOrder) return
    const items = lastOrder.items || lastOrder.order_items || lastOrder.details || []
    const html = `
      <html dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>فاتورة</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 14px; max-width: 320px; margin: 0 auto; padding: 16px; }
          h2 { text-align: center; margin-bottom: 4px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          td, th { padding: 4px 8px; border-bottom: 1px solid #eee; }
          .total { font-weight: bold; font-size: 16px; }
          .center { text-align: center; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h2>🍩 رويال دونتس</h2>
        <p class="center">${lastOrder.order_number || `#${lastOrder.id}`}</p>
        <p class="center">${formatInCairo(new Date(), 'ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
        <hr/>
        ${lastOrder.customer_name ? `<p>العميل: ${lastOrder.customer_name}</p>` : ''}
        ${lastOrder.customer_phone ? `<p>الهاتف: ${lastOrder.customer_phone}</p>` : ''}
        <table>
          <tr><th>الصنف</th><th>ك</th><th>السعر</th></tr>
          ${items.map((i: any) => `<tr><td>${i.item_name || i.name || '-'}</td><td>${i.quantity || i.qty || 0}</td><td>${parseFloat(i.line_total || i.total_price || i.total || 0).toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr/>
        <p>المجموع: ${parseFloat(lastOrder.subtotal || 0).toFixed(2)}</p>
        ${parseFloat(lastOrder.discount_amount || 0) > 0 ? `<p>الخصم: ${parseFloat(lastOrder.discount_amount).toFixed(2)}</p>` : ''}
        <p class="total">الإجمالي: ${parseFloat(lastOrder.total || 0).toFixed(2)} ج.م</p>
        <p>طريقة الدفع: ${lastOrder.payment_method === 'cash' ? 'نقدي' : lastOrder.payment_method === 'card' ? 'بطاقة' : lastOrder.payment_method}</p>
        <hr/>
        <p class="center">شكراً لزيارتكم!</p>
        <script>window.print();</script>
      </body></html>
    `
    printHtml(html)
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  // No shift → prompt to start
  if (!hasShift) {
    return (
      <Box className='flex flex-col items-center justify-center min-h-[60vh] gap-4'>
        <i className='tabler-clock-off text-6xl text-gray-400' />
        <Typography variant='h5'>لا توجد وردية نشطة</Typography>
        <Typography variant='body2' color='text.secondary'>يجب بدء وردية لتتمكن من استقبال الطلبات</Typography>
        <Button variant='contained' size='large' onClick={() => setShiftDialogOpen(true)}>
          بدء الوردية
        </Button>

        <Dialog open={shiftDialogOpen} onClose={() => setShiftDialogOpen(false)} maxWidth='xs' fullWidth>
          <DialogTitle>بدء وردية جديدة</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important' }}>
            <TextField
              label='النقدية الافتتاحية (ج.م)'
              type='number'
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              fullWidth autoFocus
              inputProps={{ step: '0.01', min: '0' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShiftDialogOpen(false)}>إلغاء</Button>
            <Button variant='contained' onClick={handleStartShift}>بدء الوردية</Button>
          </DialogActions>
        </Dialog>
      </Box>
    )
  }

  return (
    <>
      {/* Shift info bar */}
      <Box className='flex items-center justify-between mb-4 p-3 rounded border bg-primary/5'>
        <Box className='flex items-center gap-2'>
          <Chip label='وردية نشطة' color='success' size='small' />
          <Typography variant='body2' color='text.secondary'>
            بدأت: {currentShift?.started_at ? formatLocalTime(currentShift.started_at, 'ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
            {currentShift?.opening_cash && ` · افتتاح: ${parseFloat(currentShift.opening_cash).toFixed(2)} ج.م`}
          </Typography>
        </Box>
        <Button variant='outlined' color='error' size='small' onClick={() => setEndShiftDialogOpen(true)}>
          إنهاء الوردية
        </Button>
      </Box>

      <Grid container spacing={4}>
        {/* Menu Panel */}
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          {/* Category Tabs */}
          <Box className='flex gap-2 mb-4 flex-wrap'>
            <Chip
              label='الكل'
              onClick={() => setSelectedCategory('all')}
              color={selectedCategory === 'all' ? 'primary' : 'default'}
              variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
            />
            {categories.map(cat => (
              <Chip
                key={cat.id}
                label={cat.name}
                onClick={() => setSelectedCategory(cat.id)}
                color={selectedCategory === cat.id ? 'primary' : 'default'}
                variant={selectedCategory === cat.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Menu Grid */}
          <Grid container spacing={2}>
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.menu_item_id === item.id)
              const isUnavailable = !item.is_available
              return (
                <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Card
                    className={`h-full transition-all ${isUnavailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}`}
                    onClick={() => !isUnavailable && addToCart(item)}
                  >
                    <CardContent className='flex flex-col items-center gap-2 p-3 text-center'>
                      <Badge badgeContent={inCart?.quantity || 0} color='primary' invisible={!inCart}>
                        <Box className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center'>
                          <i className='tabler-cookie text-xl text-primary' />
                        </Box>
                      </Badge>
                      <Typography variant='subtitle2' className='line-clamp-2'>{item.name}</Typography>
                      <Typography variant='h6' color='primary'>
                        {parseFloat(item.price).toFixed(2)}
                      </Typography>
                      {isUnavailable && (
                        <Chip label='غير متاح' size='small' color='error' variant='outlined' />
                      )}
                      {item.category_name && (
                        <Typography variant='caption' color='text.disabled'>{item.category_name}</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </Grid>

        {/* Cart / Order Panel */}
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Card className='sticky top-4'>
            <CardHeader
              title='الطلب الحالي'
              subheader={`${cart.length} صنف`}
              action={
                cart.length > 0 ? (
                  <IconButton color='error' onClick={() => setCart([])}>
                    <i className='tabler-trash' />
                  </IconButton>
                ) : undefined
              }
            />
            <Divider />
            <CardContent>
              {/* Customer Info */}
              <TextField
                label='اسم العميل (اختياري)'
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                fullWidth size='small' className='mb-3'
              />
              <TextField
                label='رقم الهاتف (اختياري)'
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                fullWidth size='small' className='mb-3'
              />
              <TextField
                select
                label='طريقة الدفع'
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                fullWidth size='small' className='mb-3'
              >
                {PAYMENT_METHODS.map(m => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </TextField>

              <Divider className='mb-3' />

              {/* Cart Items */}
              {cart.length === 0 ? (
                <Typography variant='body2' color='text.secondary' align='center' className='py-8'>
                  انقر على الأصناف لإضافتها
                </Typography>
              ) : (
                <Box className='flex flex-col gap-2 mb-4 max-h-[300px] overflow-auto'>
                  {cart.map(item => (
                    <Box key={item.menu_item_id} className='flex items-center gap-1'>
                      <Box className='flex-1'>
                        <Typography variant='body2' fontWeight={500}>{item.name}</Typography>
                        {item.special_request && (
                          <Typography variant='caption' color='text.secondary'>
                            ملاحظة: {item.special_request}
                          </Typography>
                        )}
                      </Box>
                      <Box className='flex items-center gap-1'>
                        <IconButton size='small' onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}>
                          <i className='tabler-minus text-sm' />
                        </IconButton>
                        <Typography variant='body2' className='min-w-[24px] text-center'>{item.quantity}</Typography>
                        <IconButton size='small' onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}>
                          <i className='tabler-plus text-sm' />
                        </IconButton>
                      </Box>
                      <Typography variant='body2' fontWeight={600} className='min-w-[60px] text-right'>
                        {(item.price * item.quantity).toFixed(2)}
                      </Typography>
                      <IconButton size='small' onClick={() => { setSpecialReqItem(item); setSpecialReqText(item.special_request || ''); }}>
                        <i className='tabler-message text-sm' />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              <Divider className='mb-3' />

              {/* Discount */}
              <TextField
                label='خصم (ج.م)'
                type='number'
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value)}
                fullWidth size='small' className='mb-3'
                inputProps={{ step: '0.01', min: '0' }}
              />

              {/* Totals */}
              <Box className='flex justify-between mb-1'>
                <Typography variant='body2'>المجموع الجزئي</Typography>
                <Typography variant='body2'>{subtotal.toFixed(2)}</Typography>
              </Box>
              {discount > 0 && (
                <Box className='flex justify-between mb-1'>
                  <Typography variant='body2' color='error'>خصم</Typography>
                  <Typography variant='body2' color='error'>- {discount.toFixed(2)}</Typography>
                </Box>
              )}
              <Box className='flex justify-between mb-4'>
                <Typography variant='h6'>الإجمالي</Typography>
                <Typography variant='h6' color='primary'>{total.toFixed(2)} ج.م</Typography>
              </Box>

              <TextField
                label='ملاحظات الطلب'
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                fullWidth size='small' className='mb-3'
                multiline rows={2}
              />

              <Button
                variant='contained'
                fullWidth size='large'
                disabled={cart.length === 0}
                onClick={handlePlaceOrder}
                startIcon={<i className='tabler-send' />}
              >
                إرسال الطلب
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Shift Summary (after ending) */}
      {shiftSummary && (
        <Dialog open={!!shiftSummary} onClose={() => setShiftSummary(null)} maxWidth='sm' fullWidth>
          <DialogTitle>ملخص الوردية المنتهية</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '1rem !important' }}>
            <Box className='grid grid-cols-2 gap-4'>
              <Box><Typography variant='caption' color='text.secondary'>الكاشير</Typography><Typography fontWeight={600}>{shiftSummary.cashier_name}</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>عدد الطلبات</Typography><Typography fontWeight={600}>{shiftSummary.orders_count}</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>إيراد الوردية</Typography><Typography fontWeight={600} color='success.main'>{parseFloat(shiftSummary.shift_revenue || 0).toFixed(2)} ج.م</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>النقدية الافتتاحية</Typography><Typography fontWeight={600}>{parseFloat(shiftSummary.opening_cash || 0).toFixed(2)}</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>النقدية الختامية الفعلية</Typography><Typography fontWeight={600}>{parseFloat(shiftSummary.closing_cash || 0).toFixed(2)}</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>النقدية المتوقعة</Typography><Typography fontWeight={600}>{parseFloat(shiftSummary.expected_cash || 0).toFixed(2)}</Typography></Box>
              <Box><Typography variant='caption' color='text.secondary'>الفرق</Typography>
                <Typography fontWeight={600} color={parseFloat(shiftSummary.cash_difference || 0) === 0 ? 'success.main' : 'warning.main'}>
                  {parseFloat(shiftSummary.cash_difference || 0).toFixed(2)}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button variant='contained' onClick={() => setShiftSummary(null)}>إغلاق</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* End Shift Dialog */}
      <Dialog open={endShiftDialogOpen} onClose={() => setEndShiftDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>إنهاء الوردية</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important' }}>
          <TextField
            label='النقدية الختامية الفعلية (ج.م)'
            type='number'
            value={closingCash}
            onChange={e => setClosingCash(e.target.value)}
            fullWidth autoFocus
            inputProps={{ step: '0.01', min: '0' }}
          />
          <TextField
            label='ملاحظات'
            value={shiftNotes}
            onChange={e => setShiftNotes(e.target.value)}
            fullWidth multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndShiftDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' color='error' onClick={handleEndShift}>إنهاء الوردية</Button>
        </DialogActions>
      </Dialog>

      {/* After-order Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>تأكيد الطلب — {lastOrder?.order_number || `#${lastOrder?.id}`}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '1rem !important' }}>
          <Typography>
            الإجمالي: <strong>{parseFloat(lastOrder?.total || 0).toFixed(2)} ج.م</strong>
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            طريقة الدفع: {PAYMENT_METHODS.find(m => m.value === lastOrder?.payment_method)?.label || lastOrder?.payment_method}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            حالة الدفع: {lastOrder?.payment_status === 'paid' ? 'مدفوع' : 'معلق'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>لاحقاً</Button>
          <Button onClick={handlePrintReceipt} startIcon={<i className='tabler-printer' />}>طباعة</Button>
          {lastOrder?.payment_status !== 'paid' && (
            <Button variant='contained' onClick={handleMarkPaid}>تسجيل الدفع</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Special Request Dialog */}
      <Dialog open={!!specialReqItem} onClose={() => setSpecialReqItem(null)} maxWidth='xs' fullWidth>
        <DialogTitle>ملاحظة خاصة — {specialReqItem?.name}</DialogTitle>
        <DialogContent sx={{ pt: '1rem !important' }}>
          <TextField
            label='مثل: بدون بصل، إضافي صوص'
            value={specialReqText}
            onChange={e => setSpecialReqText(e.target.value)}
            fullWidth autoFocus multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSpecialReqItem(null)}>إلغاء</Button>
          <Button variant='contained' onClick={() => {
            if (!specialReqItem) return
            setCart(prev => prev.map(c =>
              c.menu_item_id === specialReqItem.menu_item_id
                ? { ...c, special_request: specialReqText }
                : c
            ))
            setSpecialReqItem(null)
          }}>حفظ</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default POS
