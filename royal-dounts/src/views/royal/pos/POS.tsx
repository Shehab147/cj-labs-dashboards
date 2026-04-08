'use client'

import { useEffect, useState, useCallback } from 'react'
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

import { productApi, categoryApi, orderApi, tableApi, shiftApi, paymentApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { useDictionary } from '@/contexts/dictionaryContext'

interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
}

const POS = () => {
  const t = useDictionary()
  const { admin } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasShift, setHasShift] = useState(false)
  const [shiftData, setShiftData] = useState<any>(null)

  // Order form
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('takeaway')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [deliveryCost, setDeliveryCost] = useState('0')
  const [selectedTable, setSelectedTable] = useState('')

  // Shift dialog
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [openingCash, setOpeningCash] = useState('')

  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [lastOrderId, setLastOrderId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paymentAmount, setPaymentAmount] = useState('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [prodRes, catRes, tableRes, shiftRes] = await Promise.all([
        productApi.getAll(),
        categoryApi.getAll(),
        tableApi.getAvailable(),
        shiftApi.getCurrent()
      ])

      if (prodRes.status === 'success') setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.products || [])
      if (catRes.status === 'success') setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data?.categories || [])
      if (tableRes.status === 'success') setTables(Array.isArray(tableRes.data) ? tableRes.data : tableRes.data?.available_tables || tableRes.data?.tables || [])

      if (shiftRes.status === 'success' && shiftRes.data) {
        setHasShift(true)
        setShiftData(shiftRes.data)
      } else {
        setHasShift(false)
      }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category_id === selectedCategory)

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product_id: product.id, name: product.name, price: parseFloat(product.price), quantity: 1 }]
    })
  }

  const updateCartQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product_id !== productId))
    } else {
      setCart(prev => prev.map(item =>
        item.product_id === productId ? { ...item, quantity: qty } : item
      ))
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const orderTotal = cartTotal + (orderType === 'delivery' ? parseFloat(deliveryCost) || 0 : 0)

  const handleStartShift = async () => {
    if (!openingCash) return
    try {
      const res = await shiftApi.start({ opening_cash: parseFloat(openingCash) })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.pos.shiftStarted || 'Shift started!', severity: 'success' })
        setShiftDialogOpen(false)
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || t.pos.failedToStartShift || 'Failed to start shift', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.pos.failedToStartShift || 'Failed to start shift', severity: 'error' })
    }
  }

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      setSnackbar({ open: true, message: t.pos.cartIsEmpty, severity: 'error' })
      return
    }

    try {
      const data: any = {
        order_type: orderType,
        items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity, price: item.price }))
      }
      if (customerName) data.customer_name = customerName
      if (customerPhone) data.customer_phone = customerPhone
      if (orderType === 'dine_in' && selectedTable) data.table_id = parseInt(selectedTable)
      if (orderType === 'delivery') {
        data.address = address
        data.delivery_cost = parseFloat(deliveryCost) || 0
      }

      const res = await orderApi.create(data)
      if (res.status === 'success') {
        const orderId = res.data?.order?.id || res.data?.id || res.data?.order_id
        setLastOrderId(orderId)
        setPaymentAmount(String(orderTotal))
        setPaymentDialogOpen(true)
        setSnackbar({ open: true, message: `${t.pos.orderCreated} #${orderId}`, severity: 'success' })
        setCart([])
        setCustomerName('')
        setCustomerPhone('')
        setAddress('')
        setDeliveryCost('0')
        setSelectedTable('')
      } else {
        setSnackbar({ open: true, message: res.message || t.pos.failedToCreateOrder, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.pos.failedToCreateOrder, severity: 'error' })
    }
  }

  const handleProcessPayment = async () => {
    if (!lastOrderId || !paymentAmount) return
    try {
      const res = await paymentApi.process({
        order_id: lastOrderId,
        payment_method: paymentMethod,
        amount: parseFloat(paymentAmount)
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.pos.paymentProcessed, severity: 'success' })
        setPaymentDialogOpen(false)
      } else {
        setSnackbar({ open: true, message: res.message || t.pos.paymentFailed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.pos.paymentFailed, severity: 'error' })
    }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  // Show shift start prompt if no active shift
  if (!hasShift) {
    return (
      <Box className='flex flex-col items-center justify-center min-h-[60vh] gap-4'>
        <i className='tabler-clock-off text-6xl text-gray-400' />
        <Typography variant='h5'>{t.pos.noActiveShift}</Typography>
        <Typography variant='body2' color='text.secondary'>{t.pos.needShiftMessage}</Typography>
        <Button variant='contained' size='large' onClick={() => setShiftDialogOpen(true)}>
          {t.pos.startShift}
        </Button>
        <Dialog open={shiftDialogOpen} onClose={() => setShiftDialogOpen(false)} maxWidth='xs' fullWidth>
          <DialogTitle>{t.pos.dialogStartShift}</DialogTitle>
          <DialogContent>
            <TextField
              label={t.pos.labelOpeningCash}
              type='number'
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              fullWidth
              autoFocus
              className='mt-2'
              inputProps={{ step: '0.01' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShiftDialogOpen(false)}>{t.common.cancel}</Button>
            <Button variant='contained' onClick={handleStartShift}>{t.pos.startShift}</Button>
          </DialogActions>
        </Dialog>
      </Box>
    )
  }

  return (
    <>
      <Grid container spacing={4}>
        {/* Product Grid */}
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          {/* Category filter */}
          <Box className='flex gap-2 mb-4 flex-wrap'>
            <Chip
              label={t.pos.categoryAll}
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

          {/* Products */}
          <Grid container spacing={2}>
            {filteredProducts.map(product => {
              const inCart = cart.find(item => item.product_id === product.id)
              return (
                <Grid key={product.id} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Card
                    className='cursor-pointer hover:shadow-lg transition-shadow h-full'
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className='flex flex-col items-center gap-2 p-3 text-center'>
                      <Badge badgeContent={inCart?.quantity || 0} color='primary' invisible={!inCart}>
                        <Box className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center'>
                          <i className='tabler-cookie text-xl text-primary' />
                        </Box>
                      </Badge>
                      <Typography variant='subtitle2' className='line-clamp-2'>{product.name}</Typography>
                      <Typography variant='h6' color='primary'>
                        {parseFloat(product.price).toFixed(2)}
                      </Typography>
                      {product.stock <= 5 && (
                        <Chip label={`${product.stock} ${t.pos.stockLeft}`} size='small' color='error' />
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
              title={t.pos.currentOrder}
              subheader={`${cart.length} ${t.pos.itemCount}`}
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
              {/* Order Type */}
              <TextField
                select
                label={t.pos.labelOrderType}
                value={orderType}
                onChange={e => setOrderType(e.target.value as any)}
                fullWidth
                size='small'
                className='mb-3'
              >
                <MenuItem value='takeaway'>{t.pos.optionTakeaway}</MenuItem>
                <MenuItem value='dine_in'>{t.pos.optionDineIn}</MenuItem>
                <MenuItem value='delivery'>{t.pos.optionDelivery}</MenuItem>
              </TextField>

              {orderType === 'dine_in' && (
                <TextField
                  select
                  label={t.pos.labelTable}
                  value={selectedTable}
                  onChange={e => setSelectedTable(e.target.value)}
                  fullWidth
                  size='small'
                  className='mb-3'
                  slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}
                >
                  {tables.map(tbl => (
                    <MenuItem key={tbl.id} value={tbl.id.toString()}>{t.pos.tableOption} #{tbl.table_number}</MenuItem>
                  ))}
                </TextField>
              )}

              {orderType === 'delivery' && (
                <>
                  <TextField
                    label={t.pos.labelAddress}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    fullWidth
                    size='small'
                    className='mb-3'
                  />
                  <TextField
                    label={t.pos.labelDeliveryCost}
                    type='number'
                    value={deliveryCost}
                    onChange={e => setDeliveryCost(e.target.value)}
                    fullWidth
                    size='small'
                    className='mb-3'
                  />
                </>
              )}

              <TextField
                label={t.pos.labelCustomerName}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                fullWidth
                size='small'
                className='mb-3'
              />
              <TextField
                label={t.pos.labelPhone}
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                fullWidth
                size='small'
                className='mb-4'
              />

              <Divider className='mb-3' />

              {/* Cart Items */}
              {cart.length === 0 ? (
                <Typography variant='body2' color='text.secondary' align='center' className='py-8'>
                  {t.pos.emptyCartMessage}
                </Typography>
              ) : (
                <Box className='flex flex-col gap-2 mb-4 max-h-[300px] overflow-auto'>
                  {cart.map(item => (
                    <Box key={item.product_id} className='flex items-center justify-between'>
                      <div className='flex-1'>
                        <Typography variant='body2' fontWeight={500}>{item.name}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {item.price.toFixed(2)} {t.pos.priceEach}
                        </Typography>
                      </div>
                      <Box className='flex items-center gap-1'>
                        <IconButton size='small' onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}>
                          <i className='tabler-minus text-sm' />
                        </IconButton>
                        <Typography variant='body2' className='min-w-[24px] text-center'>{item.quantity}</Typography>
                        <IconButton size='small' onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}>
                          <i className='tabler-plus text-sm' />
                        </IconButton>
                      </Box>
                      <Typography variant='body2' fontWeight={600} className='min-w-[60px] text-right'>
                        {(item.price * item.quantity).toFixed(2)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Divider className='mb-3' />

              {/* Totals */}
              <Box className='flex justify-between mb-1'>
                <Typography variant='body2'>{t.pos.subtotal}</Typography>
                <Typography variant='body2'>{cartTotal.toFixed(2)}</Typography>
              </Box>
              {orderType === 'delivery' && parseFloat(deliveryCost) > 0 && (
                <Box className='flex justify-between mb-1'>
                  <Typography variant='body2'>{t.pos.delivery}</Typography>
                  <Typography variant='body2'>{parseFloat(deliveryCost).toFixed(2)}</Typography>
                </Box>
              )}
              <Box className='flex justify-between mb-4'>
                <Typography variant='h6'>{t.pos.total}</Typography>
                <Typography variant='h6' color='primary'>{orderTotal.toFixed(2)}</Typography>
              </Box>

              <Button
                variant='contained'
                fullWidth
                size='large'
                disabled={cart.length === 0}
                onClick={handleCreateOrder}
              >
                {t.pos.placeOrder}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{t.pos.processPaymentTitle} - #{lastOrderId}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important', overflow: 'visible' }}>
          <TextField
            select
            label={t.pos.labelPaymentMethod}
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as 'cash' | 'card')}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}
          >
            <MenuItem value='cash'>{t.pos.paymentCash}</MenuItem>
            <MenuItem value='card'>{t.pos.paymentCard}</MenuItem>
          </TextField>
          <TextField
            label={t.pos.labelAmount}
            type='number'
            value={paymentAmount}
            onChange={e => setPaymentAmount(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>{t.pos.skipPayLater}</Button>
          <Button variant='contained' onClick={handleProcessPayment}>{t.pos.processPayment}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default POS
