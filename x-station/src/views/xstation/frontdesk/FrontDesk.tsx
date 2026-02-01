'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Autocomplete from '@mui/material/Autocomplete'

import { frontDeskApi, roomApi, bookingApi, customerApi, cafeteriaApi, orderApi } from '@/services/api'
import type { FrontDeskDashboard, Room, Customer, CafeteriaItem, ActiveBooking } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { parseServerDateTimeMs, formatLocalTime, formatTimerDisplay, toServerDateTime } from '@/utils/timezone'

interface FrontDeskProps {
  dictionary: any
}

interface QuickBookingData {
  room_id: number
  customer_id?: number
  customer_phone: string
  customer_name: string
  duration_minutes: number // 0 = open-ended, 10-180 minutes
}

interface OrderItemData {
  item_id: number
  name: string
  price: number
  quantity: number
}

interface QuickOrderData {
  customer_id?: number
  customer_phone: string
  customer_name: string
  items: OrderItemData[]
}

const FrontDesk = ({ dictionary }: FrontDeskProps) => {
  const [data, setData] = useState<FrontDeskDashboard | null>(null)
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [availableItems, setAvailableItems] = useState<CafeteriaItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog states
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [endBookingDialogOpen, setEndBookingDialogOpen] = useState(false)
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null)

  // Form states
  const [bookingData, setBookingData] = useState<QuickBookingData>({
    room_id: 0,
    customer_phone: '',
    customer_name: '',
    duration_minutes: 0 // 0 = open-ended
  })
  const [selectedBookingCustomer, setSelectedBookingCustomer] = useState<Customer | null>(null)

  const [orderData, setOrderData] = useState<QuickOrderData>({
    customer_phone: '',
    customer_name: '',
    items: []
  })
  const [selectedOrderCustomer, setSelectedOrderCustomer] = useState<Customer | null>(null)

  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: ''
  })

  const [orderTab, setOrderTab] = useState(0)
  const [showInlineCustomerForm, setShowInlineCustomerForm] = useState(false)
  const [inlineCustomerData, setInlineCustomerData] = useState({ name: '', phone: '' })
  const [isAddingInlineCustomer, setIsAddingInlineCustomer] = useState(false)
  
  // Timer state for scheduled bookings
  const [currentTime, setCurrentTime] = useState(Date.now())
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Inline customer form for order dialog
  const [showOrderInlineCustomerForm, setShowOrderInlineCustomerForm] = useState(false)
  const [orderInlineCustomerData, setOrderInlineCustomerData] = useState({ name: '', phone: '' })
  const [isAddingOrderInlineCustomer, setIsAddingOrderInlineCustomer] = useState(false)

  const fetchData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true)
      const [dashboardRes, roomsRes, itemsRes, customersRes, activeBookingsRes] = await Promise.all([
        frontDeskApi.getDashboard(),
        roomApi.getAvailable(),
        cafeteriaApi.getAvailable(),
        customerApi.getAll(),
        bookingApi.getActive()
      ])

      if (dashboardRes.status === 'success') {
        // Use active bookings from the dedicated endpoint to ensure we get both
        // open sessions and scheduled bookings that are currently active
        const dashboardData = dashboardRes.data
        if (activeBookingsRes.status === 'success' && activeBookingsRes.data) {
          dashboardData.active_bookings = activeBookingsRes.data
        }
        setData(dashboardData)
      }
      if (roomsRes.status === 'success') {
        setAvailableRooms(roomsRes.data || [])
      }
      if (itemsRes.status === 'success') {
        setAvailableItems(itemsRes.data || [])
      }
      if (customersRes.status === 'success') {
        setCustomers(customersRes.data || [])
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchData(true) // Show loading on initial fetch
    const interval = setInterval(fetchData, 15000) // Refresh every 15 seconds
    return () => clearInterval(interval)
  }, [fetchData])

  // Timer effect for real-time countdown
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Use centralized timezone utilities for proper UTC to local conversion
  const parseDateTime = parseServerDateTimeMs
  const formatTimer = formatTimerDisplay

  // Keyboard shortcuts for quick actions
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return
      }

      // Ctrl/Cmd + B for new booking
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        if (availableRooms.length > 0) {
          setBookingDialogOpen(true)
        }
      }

      // Ctrl/Cmd + O for new order
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        setOrderDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [availableRooms.length])

  const handleAddCustomer = async () => {
    if (!newCustomerData.name || !newCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await customerApi.create(newCustomerData)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
        setAddCustomerDialogOpen(false)
        
        // Refresh customers list
        await fetchData()
        
        // Reset form
        setNewCustomerData({ name: '', phone: '' })
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddInlineCustomer = async () => {
    if (!inlineCustomerData.name || !inlineCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsAddingInlineCustomer(true)
      const response = await customerApi.create(inlineCustomerData)

      if (response.status === 'success') {
        // Refresh customers list
        const customersRes = await customerApi.getAll()
        if (customersRes.status === 'success') {
          setCustomers(customersRes.data || [])
          // Auto-select the newly created customer
          const newCustomer = customersRes.data?.find(
            (c: Customer) => c.phone === inlineCustomerData.phone
          )
          if (newCustomer) {
            setSelectedBookingCustomer(newCustomer)
          }
        }
        
        // Reset inline form and hide it
        setInlineCustomerData({ name: '', phone: '' })
        setShowInlineCustomerForm(false)
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsAddingInlineCustomer(false)
    }
  }

  const handleAddOrderInlineCustomer = async () => {
    if (!orderInlineCustomerData.name || !orderInlineCustomerData.phone) {
      setError(dictionary?.customers?.namePhoneRequired || 'Name and phone are required')
      return
    }

    try {
      setIsAddingOrderInlineCustomer(true)
      const response = await customerApi.create(orderInlineCustomerData)

      if (response.status === 'success') {
        // Refresh customers list
        const customersRes = await customerApi.getAll()
        if (customersRes.status === 'success') {
          setCustomers(customersRes.data || [])
          // Auto-select the newly created customer
          const newCustomer = customersRes.data?.find(
            (c: Customer) => c.phone === orderInlineCustomerData.phone
          )
          if (newCustomer) {
            setSelectedOrderCustomer(newCustomer)
          }
        }
        
        // Reset inline form and hide it
        setOrderInlineCustomerData({ name: '', phone: '' })
        setShowOrderInlineCustomerForm(false)
        setSuccessMessage(dictionary?.customers?.customerAdded || 'Customer added successfully')
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsAddingOrderInlineCustomer(false)
    }
  }

  const handleStartBooking = async () => {
    if (!selectedBookingCustomer) {
      setError(dictionary?.customers?.selectCustomer || 'Please select a customer')
      return
    }

    try {
      setIsSubmitting(true)
      
      const durationMinutes = bookingData.duration_minutes
      
      // Calculate started_at and finished_at if duration is set
      let startedAt = null
      let finishedAt = null
      if (durationMinutes > 0) {
        const startTime = new Date()
        const endTime = new Date()
        endTime.setMinutes(endTime.getMinutes() + durationMinutes)
        // Convert to UTC for server (server expects UTC)
        startedAt = toServerDateTime(startTime)
        finishedAt = toServerDateTime(endTime)
      }
      
      const response = await bookingApi.quickStart({
        room_id: bookingData.room_id,
        customer_phone: selectedBookingCustomer.phone,
        customer_name: selectedBookingCustomer.name || undefined,
        ...(startedAt && { started_at: startedAt }),
        ...(finishedAt && { finished_at: finishedAt })
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.bookingStarted || 'Booking started successfully')
        setBookingDialogOpen(false)
        setBookingData({ room_id: 0, customer_phone: '', customer_name: '', duration_minutes: 0 })
        setSelectedBookingCustomer(null)
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

  const handleEndBooking = async () => {
    if (!selectedBooking) return

    try {
      setIsSubmitting(true)
      const response = await bookingApi.end(selectedBooking.id)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.bookingEnded || 'Booking ended successfully')
        setEndBookingDialogOpen(false)
        setSelectedBooking(null)
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

  const handleCreateOrder = async () => {
    if (orderData.items.length === 0) {
      setError(dictionary?.orders?.addItemsFirst || 'Please add items to the order')
      return
    }

    if (!selectedOrderCustomer) {
      setError(dictionary?.customers?.selectCustomer || 'Please select a customer')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await orderApi.quick({
        customer_phone: selectedOrderCustomer.phone,
        customer_name: selectedOrderCustomer.name || undefined,
        items: orderData.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity
        }))
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.orders?.orderCreated || 'Order created successfully')
        setOrderDialogOpen(false)
        setOrderData({ customer_phone: '', customer_name: '', items: [] })
        setSelectedOrderCustomer(null)
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

  if (isLoading && !data) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6}>
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {successMessage && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='success' onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        </Grid>
      )}

      {/* Quick Stats Banner */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='primary' skin='light' size={50}>
                <i className='tabler-door text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.rooms?.available || 0}/{data?.rooms?.total || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.rooms?.available || 'Available Rooms'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='warning' skin='light' size={50}>
                <i className='tabler-calendar-event text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.active_bookings?.length || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.bookings?.activeBookings || 'Active Sessions'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='success' skin='light' size={50}>
                <i className='tabler-currency-pound text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.today?.total_revenue?.toFixed(0) || '0'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.dashboard?.todaysRevenue || "Today's Revenue (EGP)"}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-4 py-4'>
              <CustomAvatar variant='rounded' color='error' skin='light' size={50}>
                <i className='tabler-alert-triangle text-2xl' />
              </CustomAvatar>
              <div>
                <Typography variant='h5' fontWeight={700}>
                  {data?.stock_alerts?.low_stock_count || 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.frontDesk?.stockAlerts || 'Low Stock Items'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Quick Actions */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader 
            title={
              <div className='flex items-center gap-2'>
                <i className='tabler-bolt text-2xl text-primary' />
                <Typography variant='h5' fontWeight={600}>
                  {dictionary?.frontDesk?.quickActions || 'Quick Actions'}
                </Typography>
              </div>
            }
            subheader={dictionary?.frontDesk?.quickActionsDesc || 'Fast access to bookings, orders, and customer management'}
          />
          <CardContent>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
              <Button
                variant='contained'
                color='primary'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setBookingDialogOpen(true)}
                disabled={availableRooms.length === 0}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-player-play text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.frontDesk?.startBooking || 'Start Booking'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {availableRooms.length} {dictionary?.rooms?.available || 'rooms available'}
                    </Typography>
                  </div>
                </div>
              </Button>
              <Button
                variant='contained'
                color='warning'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setOrderDialogOpen(true)}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-shopping-cart text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.frontDesk?.newOrder || 'New Order'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {dictionary?.frontDesk?.quickOrder || 'Create order instantly'}
                    </Typography>
                  </div>
                </div>
              </Button>
              <Button
                variant='contained'
                color='success'
                size='large'
                fullWidth
                className='h-20'
                onClick={() => setAddCustomerDialogOpen(true)}
              >
                <div className='flex items-center gap-3 w-full'>
                  <i className='tabler-user-plus text-2xl' />
                  <div className='flex flex-col items-start'>
                    <Typography variant='body1' fontWeight={600} color='inherit'>
                      {dictionary?.customers?.addCustomer || 'Add Customer'}
                    </Typography>
                    <Typography variant='caption' color='inherit' className='opacity-80'>
                      {dictionary?.frontDesk?.newCustomer || 'Register new customer'}
                    </Typography>
                  </div>
                </div>
              </Button>
            </div>
            <Divider className='my-4' />
            <div className='flex flex-wrap gap-3 justify-center'>
              <Chip
                label={`Ctrl+B: ${dictionary?.bookings?.startBooking || 'New Booking'}`}
                size='small'
                variant='outlined'
                icon={<i className='tabler-keyboard' />}
              />
              <Chip
                label={`Ctrl+O: ${dictionary?.orders?.newOrder || 'New Order'}`}
                size='small'
                variant='outlined'
                icon={<i className='tabler-keyboard' />}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>



      {/* Timers Overview */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary?.frontDesk?.sessionTimers || 'Session Timers'} />
          <CardContent>
            {data?.active_bookings && data.active_bookings.length > 0 ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {data.active_bookings.map((booking: any) => (
                  <Card key={booking.id} variant='outlined' className='p-4'>
                    <div className='flex items-center justify-between mb-3'>
                      <div>
                        <Typography variant='h6' fontWeight={600}>
                          {booking.room_name}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {booking.customer_name}
                        </Typography>
                      </div>
                      <Chip
                        label={`${booking.current_duration_hours?.toFixed(1)}h`}
                        color='warning'
                        size='small'
                      />
                    </div>
                    
                    {booking.finished_at ? (
                      (() => {
                        // Calculate timer for scheduled bookings
                        const startTime = parseDateTime(booking.started_at)
                        const endTime = parseDateTime(booking.finished_at)
                        const totalSeconds = Math.floor((endTime - startTime) / 1000)
                        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
                        
                        // Progress: 0% at start, 100% when time is up
                        const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                        const isCompleted = remainingSeconds === 0
                        const isAlmostDone = progress >= 80 && !isCompleted
                        const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                        
                        return (
                          <div>
                            <div className='flex items-center justify-between mb-2'>
                              <Typography variant='body2' fontWeight={600} style={{ color }}>
                                {isCompleted ? dictionary?.bookings?.completed || 'Completed' : `${formatTimer(remainingSeconds)} ${dictionary?.bookings?.remaining || 'remaining'}`}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {Math.round(progress)}%
                              </Typography>
                            </div>
                            <div 
                              className='w-full h-3 rounded-full overflow-hidden mb-2'
                              style={{ backgroundColor: `${color}20` }}
                            >
                              <div
                                className='h-full rounded-full transition-all duration-1000 ease-linear'
                                style={{ 
                                  width: `${progress}%`,
                                  backgroundColor: color
                                }}
                              />
                            </div>
                            <div className='flex justify-between'>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalTime(booking.started_at)}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalTime(booking.finished_at)}
                              </Typography>
                            </div>
                          </div>
                        )
                      })()
                    ) : (
                      <div>
                        <div className='flex items-center gap-2 mb-2'>
                          <i className='tabler-infinity text-primary' />
                          <Typography variant='body2' color='primary' fontWeight={600}>
                            {dictionary?.bookings?.openSession || 'Open Session'}
                          </Typography>
                        </div>
                        <Typography variant='caption' color='text.secondary'>
                          {dictionary?.bookings?.startedAt || 'Started at'}: {formatLocalTime(booking.started_at)}
                        </Typography>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-clock-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.timers?.noActiveTimers || 'No active timers'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Active Bookings */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardHeader title={dictionary?.frontDesk?.activeSessionsTitle || 'Active Sessions'} />
          <CardContent>
            {data?.active_bookings && data.active_bookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-start p-3'>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.duration || 'Duration'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.timer || 'Timer'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.estimatedPrice || 'Est. Price'}</th>
                      <th className='text-start p-3'>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.active_bookings.map((booking: any) => (
                      <tr key={booking.id} className='border-b last:border-0'>
                        <td className='p-3'>
                          <div className='flex items-center gap-2'>
                            <i className='tabler-door text-lg' />
                            <Typography variant='body2' fontWeight={500}>
                              {booking.room_name}
                            </Typography>
                          </div>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>{booking.customer_name}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {booking.customer_phone}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Chip
                            label={`${booking.current_duration_hours?.toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`}
                            color='warning'
                            variant='tonal'
                            size='small'
                          />
                        </td>
                        <td className='p-3'>
                          {booking.finished_at ? (
                            (() => {
                              // Calculate timer for scheduled bookings
                              const startTime = parseDateTime(booking.started_at)
                              const endTime = parseDateTime(booking.finished_at)
                              const totalSeconds = Math.floor((endTime - startTime) / 1000)
                              const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                              const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
                              
                              // Progress: 0% at start, 100% when time is up
                              const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                              const isCompleted = remainingSeconds === 0
                              const isAlmostDone = progress >= 80 && !isCompleted
                              const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                              
                              if (isCompleted) {
                                return (
                                  <div className='min-w-[120px]'>
                                    <div className='flex items-center justify-between mb-1'>
                                      <Typography variant='caption' fontWeight={600} color='success.main'>
                                        {dictionary?.bookings?.completed || 'Done'}
                                      </Typography>
                                      <i className='tabler-check text-sm' style={{ color: '#4caf50' }} />
                                    </div>
                                    <div className='w-full h-2 rounded-full overflow-hidden bg-success/20'>
                                      <div className='h-full rounded-full bg-success' style={{ width: '100%' }} />
                                    </div>
                                    <Typography variant='caption' color='text.secondary' className='block mt-0.5'>
                                      {dictionary?.bookings?.timesUp || "Time's up!"}
                                    </Typography>
                                  </div>
                                )
                              }
                              
                              return (
                                <div className='min-w-[120px]'>
                                  <div className='flex items-center justify-between mb-1'>
                                    <Typography variant='caption' fontWeight={600} style={{ color }}>
                                      {formatTimer(elapsedSeconds)} / {formatTimer(totalSeconds)}
                                    </Typography>
                                    <i className='tabler-clock text-sm' style={{ color }} />
                                  </div>
                                  <div 
                                    className='w-full h-2 rounded-full overflow-hidden'
                                    style={{ backgroundColor: `${color}20` }}
                                  >
                                    <div
                                      className='h-full rounded-full transition-all duration-1000 ease-linear'
                                      style={{ 
                                        width: `${progress}%`,
                                        backgroundColor: color
                                      }}
                                    />
                                  </div>
                                  <Typography variant='caption' color='text.secondary' className='block mt-0.5'>
                                    {Math.round(progress)}% • {formatTimer(remainingSeconds)} {dictionary?.bookings?.left || 'left'}
                                  </Typography>
                                </div>
                              )
                            })()
                          ) : (
                            <Chip
                              label={dictionary?.bookings?.openEnded || 'Open'}
                              color='primary'
                              variant='outlined'
                              size='small'
                              icon={<i className='tabler-infinity text-sm' />}
                            />
                          )}
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2' color='success.main' fontWeight={500}>
                            ~{booking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Button
                            variant='contained'
                            color='error'
                            size='small'
                            onClick={() => {
                              setSelectedBooking(booking)
                              setEndBookingDialogOpen(true)
                            }}
                          >
                            {dictionary?.bookings?.endBooking || 'End'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-calendar-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.rooms?.noActiveBooking || 'No active bookings'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Stock Alerts */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card className='h-full'>
          <CardHeader
            title={dictionary?.frontDesk?.stockAlerts || 'Stock Alerts'}
            avatar={
              data?.stock_alerts?.low_stock_count ? (
                <Chip
                  label={data.stock_alerts.low_stock_count}
                  color='error'
                  size='small'
                />
              ) : null
            }
          />
          <CardContent>
            {data?.stock_alerts?.low_stock_items && data.stock_alerts.low_stock_items.length > 0 ? (
              <div className='flex flex-col gap-3'>
                {data.stock_alerts.low_stock_items.map(item => (
                  <div
                    key={item.id}
                    className='flex items-center justify-between p-3 rounded-lg bg-errorLight'
                  >
                    <div className='flex items-center gap-3'>
                      <i className='tabler-alert-triangle text-error text-xl' />
                      <Typography variant='body2' fontWeight={500}>
                        {item.name}
                      </Typography>
                    </div>
                    <Chip
                      label={`${item.stock} ${dictionary?.common?.stock || 'left'}`}
                      color={item.stock === 0 ? 'error' : 'warning'}
                      size='small'
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <i className='tabler-check-circle text-5xl text-success mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.cafeteria?.inStock || 'All items stocked'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Start Booking Dialog */}
      <Dialog open={bookingDialogOpen} onClose={() => {
        setBookingDialogOpen(false)
        setShowInlineCustomerForm(false)
        setInlineCustomerData({ name: '', phone: '' })
      }} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.bookings?.startBooking || 'Start Booking'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              select
              label={dictionary?.bookings?.selectDuration || 'Select Duration'}
              value={bookingData.duration_minutes}
              onChange={e => setBookingData({ ...bookingData, duration_minutes: Number(e.target.value) })}
              fullWidth
              helperText={dictionary?.bookings?.durationHelperText || 'Select a timer or leave open-ended'}
            >
              <MenuItem value={0}>
                <div className='flex items-center gap-2'>
                  <i className='tabler-infinity' />
                  {dictionary?.bookings?.openEnded || 'Open-ended (no timer)'}
                </div>
              </MenuItem>
              {/* Generate time options from 10 min to 3 hours in 10 min increments */}
              {Array.from({ length: 18 }, (_, i) => (i + 1) * 10).map(minutes => {
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                let label = ''
                if (hours === 0) {
                  label = `${minutes} ${dictionary?.common?.minutes || 'minutes'}`
                } else if (mins === 0) {
                  label = `${hours} ${hours === 1 ? dictionary?.common?.hour || 'hour' : dictionary?.common?.hours || 'hours'}`
                } else {
                  label = `${hours}:${mins.toString().padStart(2, '0')} ${dictionary?.common?.hours || 'hours'}`
                }
                return (
                  <MenuItem key={minutes} value={minutes}>
                    <div className='flex items-center gap-2'>
                      <i className='tabler-clock' />
                      {label}
                    </div>
                  </MenuItem>
                )
              })}
            </CustomTextField>

            <CustomTextField
              select
              label={dictionary?.bookings?.selectRoom || 'Select Room'}
              value={bookingData.room_id}
              onChange={e => setBookingData({ ...bookingData, room_id: Number(e.target.value) })}
              fullWidth
              required
              helperText={dictionary?.bookings?.onlyAvailableRooms || 'Only currently available rooms'}
            >
              {availableRooms.map(room => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name} - {room.ps} ({room.hour_cost} {dictionary?.common?.currencyPerHour || 'EGP/hr'})
                </MenuItem>
              ))}
            </CustomTextField>
            
            {!showInlineCustomerForm ? (
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => `${option.name} - ${option.phone}`}
                value={selectedBookingCustomer}
                onChange={(_, newValue) => setSelectedBookingCustomer(newValue)}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                    placeholder={dictionary?.customers?.searchByNameOrPhone || 'Search by name or phone'}
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <div className='flex flex-col'>
                      <Typography variant='body2' fontWeight={500}>
                        {option.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {option.phone}
                      </Typography>
                    </div>
                  </li>
                )}
                fullWidth
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            ) : (
              <Card variant='outlined' className='border-success'>
                <CardContent className='p-3'>
                  <div className='flex items-center justify-between mb-3'>
                    <Typography variant='subtitle2' color='success.main' fontWeight={600}>
                      <i className='tabler-user-plus mr-2' />
                      {dictionary?.frontDesk?.quickAddCustomer || 'Quick Add Customer'}
                    </Typography>
                    <IconButton size='small' onClick={() => {
                      setShowInlineCustomerForm(false)
                      setInlineCustomerData({ name: '', phone: '' })
                    }}>
                      <i className='tabler-x text-sm' />
                    </IconButton>
                  </div>
                  <div className='flex flex-col gap-3'>
                    <CustomTextField
                      label={dictionary?.customers?.customerName || 'Customer Name'}
                      value={inlineCustomerData.name}
                      onChange={e => setInlineCustomerData({ ...inlineCustomerData, name: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='John Doe'
                      autoFocus
                    />
                    <CustomTextField
                      label={dictionary?.customers?.phoneNumber || 'Phone Number'}
                      value={inlineCustomerData.phone}
                      onChange={e => setInlineCustomerData({ ...inlineCustomerData, phone: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='+201234567890'
                    />
                    <Button
                      variant='contained'
                      color='success'
                      size='small'
                      onClick={handleAddInlineCustomer}
                      disabled={isAddingInlineCustomer || !inlineCustomerData.name || !inlineCustomerData.phone}
                      startIcon={isAddingInlineCustomer ? <CircularProgress size={16} /> : <i className='tabler-check' />}
                    >
                      {dictionary?.frontDesk?.addAndSelect || 'Add & Select'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          {!showInlineCustomerForm && (
            <Button
              variant='outlined'
              color='success'
              onClick={() => setShowInlineCustomerForm(true)}
              startIcon={<i className='tabler-user-plus' />}
            >
              {dictionary?.frontDesk?.newCustomer || 'New Customer'}
            </Button>
          )}
          <Button
            variant='contained'
            onClick={handleStartBooking}
            disabled={isSubmitting || !bookingData.room_id || !selectedBookingCustomer}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.startBooking || 'Start'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerDialogOpen} onClose={() => setAddCustomerDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.customers?.addCustomer || 'Add New Customer'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.customers?.customerName || 'Customer Name'}
              value={newCustomerData.name}
              onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
              fullWidth
              required
              placeholder='John Doe'
            />
            <CustomTextField
              label={dictionary?.customers?.phoneNumber || 'Phone Number'}
              value={newCustomerData.phone}
              onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
              fullWidth
              required
              placeholder='+201234567890'
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddCustomerDialogOpen(false)
            setNewCustomerData({ name: '', phone: '' })
          }} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleAddCustomer}
            disabled={isSubmitting || !newCustomerData.name || !newCustomerData.phone}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.customers?.addCustomer || 'Add Customer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Booking Dialog */}
      <Dialog open={endBookingDialogOpen} onClose={() => setEndBookingDialogOpen(false)}>
        <DialogTitle>{dictionary?.bookings?.endBooking || 'End Booking'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Typography>{dictionary?.bookings?.confirmEnd}</Typography>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600}>
                    {selectedBooking.room_name}
                  </Typography>
                  <Typography variant='body2'>{selectedBooking.customer_name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {selectedBooking.current_duration_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                  </Typography>
                  <Typography variant='h5' color='success.main' className='mt-2'>
                    ~{selectedBooking.estimated_price?.toFixed(2)} EGP
                  </Typography>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' color='error' onClick={handleEndBooking} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.endBooking || 'End'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={orderDialogOpen} onClose={() => {
        setOrderDialogOpen(false)
        setShowOrderInlineCustomerForm(false)
        setOrderInlineCustomerData({ name: '', phone: '' })
      }} maxWidth='md' fullWidth>
        <DialogTitle>{dictionary?.orders?.newOrder || 'New Order'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            {!showOrderInlineCustomerForm ? (
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => `${option.name} - ${option.phone}`}
                value={selectedOrderCustomer}
                onChange={(_, newValue) => setSelectedOrderCustomer(newValue)}
                renderInput={(params) => (
                  <CustomTextField
                    {...params}
                    label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                    placeholder={dictionary?.customers?.searchByNameOrPhone || 'Search by name or phone'}
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <div className='flex flex-col'>
                      <Typography variant='body2' fontWeight={500}>
                        {option.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {option.phone}
                      </Typography>
                    </div>
                  </li>
                )}
                fullWidth
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            ) : (
              <Card variant='outlined' className='border-success'>
                <CardContent className='p-3'>
                  <div className='flex items-center justify-between mb-3'>
                    <Typography variant='subtitle2' color='success.main' fontWeight={600}>
                      <i className='tabler-user-plus mr-2' />
                      {dictionary?.frontDesk?.quickAddCustomer || 'Quick Add Customer'}
                    </Typography>
                    <IconButton size='small' onClick={() => {
                      setShowOrderInlineCustomerForm(false)
                      setOrderInlineCustomerData({ name: '', phone: '' })
                    }}>
                      <i className='tabler-x text-sm' />
                    </IconButton>
                  </div>
                  <div className='flex flex-col gap-3'>
                    <CustomTextField
                      label={dictionary?.customers?.customerName || 'Customer Name'}
                      value={orderInlineCustomerData.name}
                      onChange={e => setOrderInlineCustomerData({ ...orderInlineCustomerData, name: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='John Doe'
                      autoFocus
                    />
                    <CustomTextField
                      label={dictionary?.customers?.phoneNumber || 'Phone Number'}
                      value={orderInlineCustomerData.phone}
                      onChange={e => setOrderInlineCustomerData({ ...orderInlineCustomerData, phone: e.target.value })}
                      fullWidth
                      size='small'
                      placeholder='+201234567890'
                    />
                    <Button
                      variant='contained'
                      color='success'
                      size='small'
                      onClick={handleAddOrderInlineCustomer}
                      disabled={isAddingOrderInlineCustomer || !orderInlineCustomerData.name || !orderInlineCustomerData.phone}
                      startIcon={isAddingOrderInlineCustomer ? <CircularProgress size={16} /> : <i className='tabler-check' />}
                    >
                      {dictionary?.frontDesk?.addAndSelect || 'Add & Select'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                          <div className='flex justify-between items-center mt-1'>
                            <Typography variant='caption' color='success.main'>
                              {item.price} EGP
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {item.stock} {dictionary?.common?.stock || 'in stock'}
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
                            className='flex items-center justify-between p-3 border rounded-lg'
                          >
                            <div>
                              <Typography variant='body2' fontWeight={500}>
                                {item.name}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {item.price} EGP x {item.quantity} = {(item.price * item.quantity).toFixed(2)} EGP
                              </Typography>
                            </div>
                            <div className='flex items-center gap-2'>
                              <IconButton
                                size='small'
                                onClick={() => updateItemQuantity(item.item_id, item.quantity - 1)}
                              >
                                <i className='tabler-minus text-sm' />
                              </IconButton>
                              <Typography variant='body2' className='w-8 text-center'>
                                {item.quantity}
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
                        <div className='flex justify-between items-center'>
                          <Typography variant='h6'>
                            {dictionary?.orders?.total || 'Total'}
                          </Typography>
                          <Typography variant='h5' color='success.main'>
                            {orderTotal.toFixed(2)} EGP
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
        <DialogActions>
          <Button onClick={() => setOrderDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          {!showOrderInlineCustomerForm && (
            <Button
              variant='outlined'
              color='success'
              onClick={() => setShowOrderInlineCustomerForm(true)}
              startIcon={<i className='tabler-user-plus' />}
            >
              {dictionary?.frontDesk?.newCustomer || 'New Customer'}
            </Button>
          )}
          <Button
            variant='contained'
            onClick={handleCreateOrder}
            disabled={isSubmitting || orderData.items.length === 0 || !selectedOrderCustomer}
          >
            {isSubmitting ? (
              <CircularProgress size={20} />
            ) : (
              `${dictionary?.orders?.addOrder || 'Create Order'} (${orderTotal.toFixed(2)} EGP)`
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default FrontDesk