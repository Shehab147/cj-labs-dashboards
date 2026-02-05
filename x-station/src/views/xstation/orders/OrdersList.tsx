'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Pagination from '@mui/material/Pagination'

import { orderApi, cafeteriaApi, customerApi, bookingApi } from '@/services/api'
import type { Order, CafeteriaItem, Customer, ActiveBooking } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import { i18n } from '@/configs/i18n'
import { formatLocalTime, formatLocalDate, getLocaleForRtl } from '@/utils/timezone'

interface OrdersListProps {
  dictionary: any
}

interface OrderItem {
  item_id: number
  name: string
  price: number
  quantity: number
}

const OrdersList = ({ dictionary }: OrdersListProps) => {
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const isRtl = i18n.langDirection[lang as keyof typeof i18n.langDirection] === 'rtl'

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNum = (num: number | string) => {
    if (!isRtl) return String(num)
    const arabicNumerals = '٠١٢٣٤٥٦٧٨٩'
    return String(num).replace(/[0-9]/g, d => arabicNumerals[parseInt(d)])
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [availableItems, setAvailableItems] = useState<CafeteriaItem[]>([])
  const [lowStockItems, setLowStockItems] = useState<CafeteriaItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  
  // Pagination states
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Dialog states
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false)
  const [viewOrderDialogOpen, setViewOrderDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // New order form
  const [orderData, setOrderData] = useState({
    customer_id: 'walk-in' as string | number,
    booking_id: 0, // 0 = no booking linked
    items: [] as OrderItem[]
  })
  const [orderTab, setOrderTab] = useState(0)

  // Get selected customer details
  const selectedCustomer = orderData.customer_id 
    ? customers.find(c => String(c.id) === String(orderData.customer_id))
    : null

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Determine which orders API to call based on date filter
      const ordersApiCall = dateFilter === 'today' ? orderApi.getTodays() : orderApi.getAll()
      
      const [ordersRes, itemsRes, customersRes, lowStockRes, activeBookingsRes] = await Promise.all([
        ordersApiCall,
        cafeteriaApi.getAvailable(),
        customerApi.getAll(),
        cafeteriaApi.getLowStock(),
        bookingApi.getActive()
      ])

      if (ordersRes.status === 'success') {
        // Handle both superadmin (data.orders) and regular admin (data array) responses
        const ordersData = ordersRes.data?.orders || ordersRes.data || []
        setOrders(Array.isArray(ordersData) ? ordersData : [])
      }
      if (itemsRes.status === 'success') {
        setAvailableItems(itemsRes.data || [])
      }
      if (lowStockRes.status === 'success') {
        setLowStockItems(lowStockRes.data || [])
      }
      if (customersRes.status === 'success') {
        setCustomers(customersRes.data || [])
      }
      if (activeBookingsRes.status === 'success') {
        setActiveBookings(activeBookingsRes.data as ActiveBooking[] || [])
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary, dateFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateOrder = async (shouldPrint: boolean = false) => {
    if (orderData.items.length === 0) {
      setError(dictionary?.orders?.addItemsFirst || 'Please add items to the order')
      return
    }

    // Use selected customer or default "Walk-in Customer" data
    const isWalkIn = orderData.customer_id === 'walk-in' || !orderData.customer_id
    const customerName = isWalkIn ? (dictionary?.orders?.walkInCustomer || 'Walk-in Customer') : (selectedCustomer?.name || 'Walk-in Customer')
    const customerPhone = isWalkIn ? '0000000000' : (selectedCustomer?.phone || '0000000000')

    try {
      setIsSubmitting(true)
      const response = await orderApi.quick({
        customer_phone: customerPhone,
        customer_name: customerName,
        items: orderData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity
        })),
        ...(orderData.booking_id > 0 && { booking_id: orderData.booking_id })
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.orders?.orderCreated || 'Order created successfully')
        
        // Print receipt if requested
        if (shouldPrint && response.data) {
          const newOrder = response.data
          printReceipt({
            id: newOrder.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            items: orderData.items.map(item => ({
              ...item,
              item_name: item.name,
              total_price: item.price * item.quantity
            })),
            total_amount: orderTotal,
            created_at: newOrder.created_at || new Date().toISOString()
          })
        }
        
        setNewOrderDialogOpen(false)
        setOrderData({ customer_id: 'walk-in', booking_id: 0, items: [] })
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateStatus = async (orderId: number, status: 'completed' | 'cancelled') => {
    try {
      setIsSubmitting(true)
      const response = await orderApi.update(orderId, { status })

      if (response.status === 'success') {
        setSuccessMessage(
          status === 'completed'
            ? dictionary?.orders?.orderCompleted || 'Order completed'
            : dictionary?.orders?.orderCancelled || 'Order cancelled'
        )
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addItemToOrder = (item: CafeteriaItem) => {
    const existingItem = orderData.items.find(i => i.item_id === item.id)
    if (existingItem) {
      setOrderData({
        ...orderData,
        items: orderData.items.map(i =>
          i.item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      })
    } else {
      setOrderData({
        ...orderData,
        items: [
          ...orderData.items,
          { item_id: item.id, name: item.name, price: Number(item.price), quantity: 1 }
        ]
      })
    }
  }

  const updateItemQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      setOrderData({
        ...orderData,
        items: orderData.items.filter(i => i.item_id !== itemId)
      })
    } else {
      setOrderData({
        ...orderData,
        items: orderData.items.map(i =>
          i.item_id === itemId ? { ...i, quantity } : i
        )
      })
    }
  }

  const orderTotal = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const getStatusColor = (status?: string): 'success' | 'error' | 'info' => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'info'
    }
  }

  // Print receipt function
  const printReceipt = (order: Order | { id: number; customer_name: string; customer_phone: string; items: any[]; total_amount: number; created_at: string }) => {
    const itemsHtml = 'items' in order && Array.isArray(order.items) 
      ? order.items.map((item: any) => {
          const name = item.item_name || item.name
          const qty = item.quantity
          const price = Number(item.total_price || item.price * item.quantity).toFixed(2)
          return `<div class="item"><span class="item-name">${name}</span><span class="item-qty">x${qty}</span><span class="item-price">${price}</span></div>`
        }).join('') 
      : ''
    
    const dir = isRtl ? 'rtl' : 'ltr'
    const priceAlign = isRtl ? 'left' : 'right'
    const orderLabel = dictionary?.orders?.orderId || 'Order'
    const dateLabel = dictionary?.common?.date || 'Date'
    const timeLabel = dictionary?.common?.time || 'Time'
    const customerLabel = dictionary?.orders?.customer || 'Customer'
    const phoneLabel = dictionary?.customers?.phoneNumber || 'Phone'
    const itemLabel = dictionary?.orders?.item || 'Item'
    const qtyLabel = dictionary?.orders?.quantity || 'Qty'
    const priceLabel = dictionary?.common?.price || 'Price'
    const totalLabel = dictionary?.orders?.total || 'Total'
    const thankYouLabel = dictionary?.orders?.thankYou || 'Thank you for your order!'
    const currency = dictionary?.common?.currency || 'EGP'
    const receiptLabel = dictionary?.orders?.receipt || 'Receipt'
    const totalAmount = Number('total_amount' in order ? order.total_amount : 0).toFixed(2)
    const orderDate = formatLocalDate(order.created_at, getLocaleForRtl(isRtl))
    const orderTime = formatLocalTime(order.created_at, getLocaleForRtl(isRtl))
    const todayDate = new Date().toLocaleDateString(getLocaleForRtl(isRtl))
    
    const receiptContent = `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>${receiptLabel} #${order.id}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Courier New", monospace; padding: 10mm; max-width: 80mm; margin: 0 auto; font-size: 12px; direction: ${dir}; }
.header { text-align: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #000; }
.header h1 { font-size: 18px; margin-bottom: 5px; }
.header p { font-size: 10px; color: #666; }
.info { margin: 10px 0; font-size: 11px; }
.info-row { display: flex; justify-content: space-between; margin: 3px 0; }
.items { margin: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
.item { display: flex; justify-content: space-between; margin: 5px 0; font-size: 11px; }
.item-name { flex: 1; }
.item-qty { width: 30px; text-align: center; }
.item-price { width: 60px; text-align: ${priceAlign}; }
.total { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000; }
.total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 5px 0; }
.footer { margin-top: 15px; text-align: center; font-size: 10px; color: #666; }
@media print { body { padding: 0; } @page { size: 80mm auto; margin: 5mm; } }
</style>
</head>
<body>
<div class="header">
<h1>X-Station</h1>
<p>${receiptLabel}</p>
</div>
<div class="info">
<div class="info-row"><span>${orderLabel}:</span><span>#${order.id}</span></div>
<div class="info-row"><span>${dateLabel}:</span><span>${orderDate}</span></div>
<div class="info-row"><span>${timeLabel}:</span><span>${orderTime}</span></div>
<div class="info-row"><span>${customerLabel}:</span><span>${order.customer_name}</span></div>
<div class="info-row"><span>${phoneLabel}:</span><span>${order.customer_phone}</span></div>
</div>
<div class="items">
<div class="item" style="font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
<span class="item-name">${itemLabel}</span>
<span class="item-qty">${qtyLabel}</span>
<span class="item-price">${priceLabel}</span>
</div>
${itemsHtml}
</div>
<div class="total">
<div class="total-row">
<span>${totalLabel}:</span>
<span>${totalAmount} ${currency}</span>
</div>
</div>
<div class="footer">
<p>${thankYouLabel}</p>
<p style="margin-top: 5px;">${todayDate}</p>
</div>
</body>
</html>`

    // Use pywebview print API if available
    const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null
    
    if (pywebview?.api?.print_html) {
      pywebview.api.print_html(receiptContent)
    } else {
      // Fallback: Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (printWindow) {
        printWindow.document.write(receiptContent)
        printWindow.document.close()
        printWindow.onload = () => {
          printWindow.print()
        }
        // Trigger print after a short delay as fallback
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    }
  }

  // Filter orders (API already handles date filtering)
  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false
    if (searchQuery && !order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage)
  const paginatedOrders = filteredOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  // Calculate summary
  const lowStockItemsCount = lowStockItems.length
  const total_orders = orders.length
  const total_revenue = orders.reduce((sum, o) => sum + Number(o.price || o.total_amount || 0), 0)

  if (isLoading && orders.length === 0) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6} dir={isRtl ? 'rtl' : 'ltr'}>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity='error' 
          onClose={() => setError(null)}
          variant='filled'
          sx={{ 
            overflow: 'hidden',
            '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          severity='success' 
          onClose={() => setSuccessMessage(null)}
          variant='filled'
          sx={{ 
            overflow: 'hidden',
            '& .MuiAlert-message': { overflow: 'hidden', textOverflow: 'ellipsis' }
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.orders || 'Orders'}
            action={
              <Button
                variant='contained'
                startIcon={<i className={`tabler-plus ${isRtl ? 'ml-2' : ''}`} />}
                onClick={() => setNewOrderDialogOpen(true)}
              >
                {dictionary?.orders?.newOrder || 'New Order'}
              </Button>
            }
          />
          <CardContent>
            <div className='flex flex-wrap gap-4'>
              <CustomTextField
                select
                label={dictionary?.common?.period || 'Period'}
                value={dateFilter}
                onChange={e => {
                  setDateFilter(e.target.value)
                  setPage(1)
                }}
                className='min-w-[120px]'
              >
                <MenuItem value='today'>{dictionary?.common?.today || 'Today'}</MenuItem>
                <MenuItem value='all'>{dictionary?.common?.all || 'All Time'}</MenuItem>
              </CustomTextField>
            
              <CustomTextField
                label={dictionary?.common?.search || 'Search'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={dictionary?.customers?.customerName || 'Customer name'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i className='tabler-search' />
                    </InputAdornment>
                  )
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Cards */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
      
          <Card variant='outlined'>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className='rounded-lg p-3 bg-warning'>
                <i className='tabler-alert-triangle text-white text-2xl' />
              </div>
              <div className={`flex-1 overflow-hidden ${isRtl ? 'text-right' : ''}`}>
                <Typography variant='h5'>{toLocalizedNum(lowStockItemsCount)}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.cafeteria?.lowStock || 'Low Stock Items'}
                </Typography>
                {lowStockItems.length > 0 && (
                  <div className='mt-2 overflow-hidden'>
                    <div className='animate-slideshow'>
                      {[...lowStockItems, ...lowStockItems].map((item, index) => (
                        <span key={`${item.id}-${index}`} className='inline-block mr-4 text-sm text-warning-main'>
                          {item.name} ({toLocalizedNum(item.stock)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card variant='outlined'>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className='rounded-lg p-3 bg-info'>
                <i className='tabler-shopping-cart text-white text-2xl' />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5'>{toLocalizedNum(total_orders)}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.orders?.totalOrders || 'Total Orders'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card variant='outlined'>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className='rounded-lg p-3 bg-primary'>
                <i className='tabler-currency-dollar text-white text-2xl' />
              </div>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5'>{toLocalizedNum(total_revenue.toFixed(0))} {dictionary?.common?.currency || 'EGP'}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.orders?.total_revenue || 'Revenue'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Orders Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            {filteredOrders.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>#</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.orders?.customer || 'Customer'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.orders?.items || 'Items'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.orders?.total || 'Total'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.time || 'Time'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map(order => (
                      <tr key={order.id} className='border-b last:border-0'>
                        <td className='p-3'>
                          <Typography variant='body2' fontWeight={500}>
                            #{toLocalizedNum(order.id)}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>{order.customer_name}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {order.customer_phone}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>
                            {toLocalizedNum(order.items_count || order.items?.length || 0)} {dictionary?.orders?.items || 'items'}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2' color='success.main' fontWeight={500}>
                            {toLocalizedNum(Number(order.total_amount || order.price).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>
                            {formatLocalTime(order.created_at, getLocaleForRtl(isRtl))}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <div className={`flex gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <IconButton
                              size='small'
                              onClick={() => {
                                setSelectedOrder(order)
                                setViewOrderDialogOpen(true)
                              }}
                              title={dictionary?.orders?.viewOrder || 'View Order'}
                            >
                              <i className='tabler-eye' />
                            </IconButton>
                            <IconButton
                              size='small'
                              onClick={() => printReceipt(order)}
                              title={dictionary?.orders?.printReceipt || 'Print Receipt'}
                            >
                              <i className='tabler-printer' />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            
            {filteredOrders.length === 0 ? (
              <div className='text-center py-12'>
                <i className='tabler-shopping-cart-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.orders?.noOrders || 'No orders found'}
                </Typography>
              </div>
            ) : (
              <div className={`flex justify-between items-center mt-6 flex-wrap gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.common?.showing || 'Showing'} {toLocalizedNum(((page - 1) * rowsPerPage) + 1)} {dictionary?.common?.to || 'to'} {toLocalizedNum(Math.min(page * rowsPerPage, filteredOrders.length))} {dictionary?.common?.of || 'of'} {toLocalizedNum(filteredOrders.length)} {dictionary?.orders?.orders || 'orders'}
                  </Typography>
                  <CustomTextField
                    select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value))
                      setPage(1)
                    }}
                    size='small'
                    className='w-24'
                  >
                    <MenuItem value={5}>5</MenuItem>
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </CustomTextField>
                </div>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color='primary'
                  showFirstButton
                  showLastButton
                />
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* New Order Dialog */}
      <Dialog open={newOrderDialogOpen} onClose={() => setNewOrderDialogOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>{dictionary?.orders?.newOrder || 'New Order'}</DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <div className='flex flex-col gap-4 pt-2'>
            {/* Link to Active Booking (Optional) */}
            {activeBookings.length > 0 && (
              <CustomTextField
                select
                label={dictionary?.orders?.linkToBooking || 'Link to Active Booking'}
                value={orderData.booking_id}
                onChange={e => {
                  const bookingId = Number(e.target.value)
                  const selectedBooking = activeBookings.find(b => b.id === bookingId)
                  setOrderData({ 
                    ...orderData, 
                    booking_id: bookingId,
                    // Auto-fill customer if booking has one
                    customer_id: selectedBooking?.customer_name && selectedBooking.customer_name !== 'Guest' 
                      ? (customers.find(c => c.name === selectedBooking.customer_name)?.id || 'walk-in')
                      : orderData.customer_id
                  })
                }}
                fullWidth
                helperText={dictionary?.orders?.linkToBookingHelp || 'Optional: Add this order to an active room session'}
              >
                <MenuItem value={0}>
                  <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <i className='tabler-unlink' />
                    {dictionary?.orders?.noBookingLink || 'No booking (standalone order)'}
                  </div>
                </MenuItem>
                {activeBookings.map(booking => (
                  <MenuItem key={booking.id} value={booking.id}>
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <i className='tabler-door' />
                      {booking.room_name} - {booking.customer_name || dictionary?.bookings?.guestCustomer || 'Guest'}
                    </div>
                  </MenuItem>
                ))}
              </CustomTextField>
            )}

            <CustomTextField
              select
              label={dictionary?.customers?.selectCustomer || 'Select Customer'}
              value={orderData.customer_id}
              onChange={e => {
                setOrderData({ ...orderData, customer_id: e.target.value })
              }}
              fullWidth
            >
              <MenuItem value='walk-in'>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <i className='tabler-user-question' />
                  {dictionary?.orders?.walkInCustomer || 'Walk-in Customer'}
                </div>
              </MenuItem>
              {customers.map(customer => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </MenuItem>
              ))}
            </CustomTextField>
            {selectedCustomer && (
              <div className={`p-3 bg-actionHover rounded-lg ${isRtl ? 'text-right' : ''}`}>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.customers?.selectedCustomer || 'Selected Customer'}
                </Typography>
                <Typography variant='body1' fontWeight={500}>
                  {selectedCustomer.name}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {selectedCustomer.phone}
                </Typography>
              </div>
            )}

            <Divider />

            <Box>
              <Tabs value={orderTab} onChange={(_, v) => setOrderTab(v)}>
                <Tab label={dictionary?.orders?.selectItems || 'Select Items'} />
                <Tab label={`${dictionary?.orders?.orderItems || 'Order'} (${orderData.items.length})`} />
              </Tabs>

              <Box className='mt-4'>
                {orderTab === 0 && (
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto'>
                    {availableItems.map(item => (
                      <Card
                        key={item.id}
                        variant='outlined'
                        className='cursor-pointer hover:border-primary transition-colors'
                        onClick={() => addItemToOrder(item)}
                      >
                        <CardContent className='p-3'>
                          <Typography variant='body2' fontWeight={500} noWrap>
                            {item.name}
                          </Typography>
                          <div className={`flex justify-between items-center mt-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <Typography variant='caption' color='success.main'>
                              {toLocalizedNum(item.price)} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toLocalizedNum(item.stock)} {dictionary?.common?.inStock || 'left'}
                            </Typography>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {orderTab === 1 && (
                  <div>
                    {orderData.items.length > 0 ? (
                      <div className='flex flex-col gap-3'>
                        {orderData.items.map(item => (
                          <div
                            key={item.item_id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${isRtl ? 'flex-row-reverse' : ''}`}
                          >
                            <div className={isRtl ? 'text-right' : ''}>
                              <Typography variant='body2' fontWeight={500}>
                                {item.name}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {toLocalizedNum(item.price)} {dictionary?.common?.currency || 'EGP'} x {toLocalizedNum(item.quantity)} = {toLocalizedNum((item.price * item.quantity).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </div>
                            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <IconButton
                                size='small'
                                onClick={() => updateItemQuantity(item.item_id, item.quantity - 1)}
                              >
                                <i className='tabler-minus text-sm' />
                              </IconButton>
                              <Typography variant='body2' className='w-8 text-center'>
                                {toLocalizedNum(item.quantity)}
                              </Typography>
                              <IconButton
                                size='small'
                                onClick={() => updateItemQuantity(item.item_id, item.quantity + 1)}
                              >
                                <i className='tabler-plus text-sm' />
                              </IconButton>
                            </div>
                          </div>
                        ))}
                        <Divider />
                        <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                          <Typography variant='h6'>
                            {dictionary?.orders?.total || 'Total'}
                          </Typography>
                          <Typography variant='h5' color='success.main'>
                            {toLocalizedNum(orderTotal.toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </div>
                      </div>
                    ) : (
                      <Typography color='text.secondary' className='text-center py-8'>
                        {dictionary?.orders?.addItemsFirst || 'Add items to the order'}
                      </Typography>
                    )}
                  </div>
                )}
              </Box>
            </Box>
          </div>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 1 }}>
          <Button onClick={() => setNewOrderDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='outlined'
            onClick={() => handleCreateOrder(false)}
            disabled={isSubmitting || orderData.items.length === 0}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              dictionary?.orders?.createOrder || 'Create Order'
            )}
          </Button>
          <Button
            variant='contained'
            startIcon={<i className='tabler-printer' />}
            onClick={() => handleCreateOrder(true)}
            disabled={isSubmitting || orderData.items.length === 0}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              `${dictionary?.orders?.createAndPrint || 'Create & Print'} (${toLocalizedNum(orderTotal.toFixed(2))} ${dictionary?.common?.currency || 'EGP'})`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={viewOrderDialogOpen} onClose={() => setViewOrderDialogOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>
          <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
            <span>{dictionary?.orders?.orderDetails || 'Order Details'}</span>
            <Chip
              label={selectedOrder?.status ? (dictionary?.orders?.[selectedOrder.status] || selectedOrder.status) : 'completed'}
              color={getStatusColor(selectedOrder?.status)}
              size='small'
            />
          </div>
        </DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          {selectedOrder && (
            <div className='flex flex-col gap-4 pt-2'>
              {/* Order ID and Date */}
              <Card variant='outlined'>
                <CardContent>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.orders?.orderId || 'Order ID'}
                      </Typography>
                      <Typography variant='h6'>#{toLocalizedNum(selectedOrder.id)}</Typography>
                    </div>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.orders?.orderDate || 'Order Date'}
                      </Typography>
                      <Typography variant='body1'>
                        {formatLocalDate(selectedOrder.created_at, getLocaleForRtl(isRtl))}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {formatLocalTime(selectedOrder.created_at, getLocaleForRtl(isRtl))}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600} className={`mb-3 ${isRtl ? 'text-right' : ''}`}>
                    {dictionary?.orders?.customer || 'Customer Information'}
                  </Typography>
                  <div className='grid grid-cols-2 gap-4'>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.customers?.name || 'Name'}
                      </Typography>
                      <Typography variant='body1'>{selectedOrder.customer_name}</Typography>
                    </div>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.customers?.phoneNumber || 'Phone'}
                      </Typography>
                      <Typography variant='body1'>{selectedOrder.customer_phone}</Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items Ordered */}
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600} className={`mb-3 ${isRtl ? 'text-right' : ''}`}>
                    {dictionary?.orders?.itemsOrdered || 'Items Ordered'}
                  </Typography>
                  
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b'>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.orders?.item || 'Item'}</th>
                          <th className='text-center p-2'>{dictionary?.orders?.quantity || 'Qty'}</th>
                          <th className={`${isRtl ? 'text-start' : 'text-end'} p-2`}>{dictionary?.common?.price || 'Price'}</th>
                          <th className={`${isRtl ? 'text-start' : 'text-end'} p-2`}>{dictionary?.orders?.total || 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((item: any, index: number) => (
                          <tr key={index} className='border-b last:border-0'>
                            <td className='p-2'>
                              <Typography variant='body2' fontWeight={500}>
                                {item.item_name || item.name}
                              </Typography>
                            </td>
                            <td className='p-2 text-center'>
                              <Typography variant='body2'>
                                x{toLocalizedNum(item.quantity)}
                              </Typography>
                            </td>
                            <td className={`p-2 ${isRtl ? 'text-start' : 'text-end'}`}>
                              <Typography variant='body2' color='text.secondary'>
                                {toLocalizedNum(Number(item.price || item.total_price / item.quantity).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                            <td className={`p-2 ${isRtl ? 'text-start' : 'text-end'}`}>
                              <Typography variant='body2' fontWeight={500}>
                                {toLocalizedNum(Number(item.total_price || item.price * item.quantity).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Divider className='my-3' />

                  {/* Order Summary */}
                  <div className='flex flex-col gap-2'>
                    <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.orders?.subtotal || 'Subtotal'}
                      </Typography>
                      <Typography variant='body2'>
                        {toLocalizedNum(Number(selectedOrder.total_amount || selectedOrder.price).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                    
                    {selectedOrder.discount && Number(selectedOrder.discount) > 0 && (
                      <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <Typography variant='body2' color='text.secondary'>
                          {dictionary?.orders?.discount || 'Discount'}
                        </Typography>
                        <Typography variant='body2' color='error.main'>
                          -{toLocalizedNum(Number(selectedOrder.discount).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                        </Typography>
                      </div>
                    )}
                    
                    <Divider />
                    
                    <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='h6'>{dictionary?.orders?.total || 'Total'}</Typography>
                      <Typography variant='h5' color='success.main' fontWeight={600}>
                        {toLocalizedNum((Number(selectedOrder.total_amount || selectedOrder.price) - Number(selectedOrder.discount || 0)).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <Button onClick={() => setViewOrderDialogOpen(false)}>
            {dictionary?.common?.close || 'Close'}
          </Button>
          {selectedOrder && (
            <Button
              variant='contained'
              startIcon={<i className='tabler-printer' />}
              onClick={() => printReceipt(selectedOrder)}
            >
              {dictionary?.orders?.printReceipt || 'Print Receipt'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default OrdersList