'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Autocomplete from '@mui/material/Autocomplete'
import TablePagination from '@mui/material/TablePagination'

import { bookingApi, roomApi, customerApi } from '@/services/api'
import type { Booking, Room, ActiveBooking, Customer } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'
import { parseServerDateTimeMs, formatLocalTime, formatLocalDate, formatTimerDisplay, getLocaleForRtl, toServerDateTime } from '@/utils/timezone'

interface BookingsListProps {
  dictionary: any
}

const BookingsList = ({ dictionary }: BookingsListProps) => {
  const { admin } = useAuth()
  const isSuperadmin = admin?.role === 'superadmin'
  
  // Get locale for RTL support
  const params = useParams()
  const locale = (params?.lang as Locale) || i18n.defaultLocale
  const isRtl = i18n.langDirection[locale] === 'rtl'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([])
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter states
  const [statusFilter, setStatusFilter] = useState('active')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination states
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Dialog states
  const [startBookingDialogOpen, setStartBookingDialogOpen] = useState(false)
  const [endBookingDialogOpen, setEndBookingDialogOpen] = useState(false)
  const [switchRoomDialogOpen, setSwitchRoomDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null)

  // Form states
  const [newBooking, setNewBooking] = useState({
    room_id: 0,
    customer_id: 0,
    duration_minutes: 0 // 0 = open-ended, 30, 60, 90 minutes
  })
  const [newRoomId, setNewRoomId] = useState(0)

  // Timer states for countdown (now based on server finished_at)
  const [timers, setTimers] = useState<{ [bookingId: number]: number }>({}) // remaining seconds
  const [clientTimers, setClientTimers] = useState<{ [bookingId: number]: { endTime: number; totalSeconds: number } }>({}) // Fallback client-side timers
  const processedEndingsRef = useRef<Set<number>>(new Set()) // Track bookings we've already tried to end
  const [isMounted, setIsMounted] = useState(false) // Track if component is fully mounted
  const [currentTime, setCurrentTime] = useState(Date.now()) // For real-time timer updates

  // Load client timers from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xstation_client_timers')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Clean up expired timers
        const now = Date.now()
        const cleaned: { [key: number]: { endTime: number; totalSeconds: number } } = {}
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          if (value.endTime > now) {
            cleaned[Number(key)] = value
          }
        })
        setClientTimers(cleaned)
      }
    } catch (e) {
      console.error('Failed to load client timers:', e)
    }
  }, [])

  // Save client timers to localStorage
  useEffect(() => {
    try {
      if (Object.keys(clientTimers).length > 0) {
        localStorage.setItem('xstation_client_timers', JSON.stringify(clientTimers))
      } else {
        localStorage.removeItem('xstation_client_timers')
      }
    } catch (e) {
      console.error('Failed to save client timers:', e)
    }
  }, [clientTimers])

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true)
      const [bookingsRes, activeRes, availableRoomsRes, allRoomsRes, customersRes] = await Promise.all([
        bookingApi.getTodays(),
        bookingApi.getActive(),
        roomApi.getAvailable(),
        roomApi.list(),
        customerApi.list()
      ])

      if (bookingsRes.status === 'success') {
        // API returns { data: { bookings: [...], summary: {...} } }
        setBookings(bookingsRes.data?.bookings || bookingsRes.data || [])
      }
      if (activeRes.status === 'success') {
        setActiveBookings(activeRes.data as ActiveBooking[] || [])
        // Clear processed endings for bookings that are no longer active
        const activeIds = new Set((activeRes.data as ActiveBooking[] || []).map(b => b.id))
        processedEndingsRef.current.forEach(id => {
          if (!activeIds.has(id)) {
            processedEndingsRef.current.delete(id)
          }
        })
      }
      if (availableRoomsRes.status === 'success') {
        setAvailableRooms(availableRoomsRes.data || [])
      }
      if (allRoomsRes.status === 'success') {
        setAllRooms(allRoomsRes.data || [])
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
    fetchData()
    // Mark as mounted after initial data fetch
    const timer = setTimeout(() => setIsMounted(true), 2000) // Give 2 seconds grace period
    
    // Refresh data every 2 seconds (silent - no loading spinner)
    const refreshInterval = setInterval(() => {
      fetchData(false)
    }, 2000)
    
    return () => {
      clearTimeout(timer)
      clearInterval(refreshInterval)
    }
  }, [fetchData])

  // Initialize timers for active bookings based on server finished_at or client timers
  useEffect(() => {
    const activeBookingIds = activeBookings.map(b => b.id)
    
    // Clean up client timers for bookings that are no longer active
    const clientTimerIds = Object.keys(clientTimers).map(Number)
    const expiredClientTimers = clientTimerIds.filter(id => !activeBookingIds.includes(id))
    if (expiredClientTimers.length > 0) {
      setClientTimers(prev => {
        const updated = { ...prev }
        expiredClientTimers.forEach(id => delete updated[id])
        return updated
      })
    }
    
    setTimers(prev => {
      const updated = { ...prev }
      
      // Remove timers for bookings that are no longer active
      Object.keys(updated).forEach(key => {
        const id = Number(key)
        if (!activeBookingIds.includes(id)) {
          delete updated[id]
        }
      })
      
      // Add timers for active bookings (only if timer doesn't exist yet - don't reset countdown in progress)
      activeBookings.forEach(booking => {
        // Skip if timer already exists (let it continue counting down)
        if (updated[booking.id] !== undefined) {
          return
        }
        
        // Priority 1: Use server finished_at if available
        if (booking.finished_at) {
          const endTime = parseServerDateTimeMs(booking.finished_at)
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
          updated[booking.id] = remaining
        } 
        // Priority 2: Use client-side timer as fallback
        else if (clientTimers[booking.id]) {
          const { endTime } = clientTimers[booking.id]
          const now = Date.now()
          const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
          updated[booking.id] = remaining
        }
      })
      
      return updated
    })
  }, [activeBookings, clientTimers])

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev }
        let hasChanges = false
        Object.keys(updated).forEach(key => {
          const id = Number(key)
          if (updated[id] > 0) {
            updated[id] = updated[id] - 1
            hasChanges = true
          }
        })
        return hasChanges ? updated : prev
      })
      // Update current time for real-time progress calculation
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Auto-end booking when timer reaches 0
  useEffect(() => {
    // Don't auto-end during initial mount/refresh
    if (!isMounted) return
    
    Object.entries(timers).forEach(([bookingId, remaining]) => {
      const id = Number(bookingId)
      
      // Skip if already processed or remaining time > 0
      if (remaining > 0 || processedEndingsRef.current.has(id)) {
        return
      }
      
      const booking = activeBookings.find(b => b.id === id)
      if (!booking) {
        return
      }
      
      // Check if the time has actually passed (either server or client timer)
      let shouldEnd = false
      
      if (booking.finished_at) {
        const endTime = parseServerDateTimeMs(booking.finished_at)
        const now = Date.now()
        shouldEnd = now >= endTime
      } else if (clientTimers[id]) {
        const { endTime } = clientTimers[id]
        const now = Date.now()
        shouldEnd = now >= endTime
      }
      
      if (!shouldEnd) {
        return // Not yet time to end
      }
      
      // Mark as processed to prevent duplicate calls
      processedEndingsRef.current.add(id)
      
      // Remove from timers immediately
      setTimers(prev => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
      setClientTimers(prev => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })

      // Auto-end the booking using timerUpdate
      // Get the finished_at time from either server or client timer
      let finishedAt: string | null = null
      if (booking.finished_at) {
        finishedAt = booking.finished_at
      } else if (clientTimers[id]) {
        const endDate = new Date(clientTimers[id].endTime)
        finishedAt = endDate.toISOString().slice(0, 19).replace('T', ' ')
      }
      
      if (finishedAt) {
        bookingApi.timerUpdate(id, finishedAt).then(response => {
          if (response.status === 'success') {
            setSuccessMessage(dictionary?.bookings?.bookingAutoEnded || 'Booking ended automatically')
            fetchData()
          }
          // Clear from processed after API call completes
          processedEndingsRef.current.delete(id)
        }).catch(() => {
          processedEndingsRef.current.delete(id)
        })
      } else {
        processedEndingsRef.current.delete(id)
      }
    })
  }, [timers, activeBookings, clientTimers, dictionary, fetchData, isMounted])

  const handleStartBooking = async () => {
    try {
      setIsSubmitting(true)
      const selectedCustomer = customers.find(c => c.id === newBooking.customer_id)
      if (!selectedCustomer) return

      const durationMinutes = newBooking.duration_minutes
      
      // Calculate started_at and finished_at if duration is set
      let startedAt = null
      let finishedAt = null
      let clientEndTime = null
      if (durationMinutes > 0) {
        const startTime = new Date()
        const endTime = new Date()
        endTime.setMinutes(endTime.getMinutes() + durationMinutes)
        // Convert to UTC for server (server expects UTC)
        startedAt = toServerDateTime(startTime)
        finishedAt = toServerDateTime(endTime)
        clientEndTime = endTime.getTime()
      }
      
      // Use quickStart with started_at and finished_at if timed booking
      const response = await bookingApi.quickStart({
        room_id: newBooking.room_id,
        customer_phone: selectedCustomer.phone,
        customer_name: selectedCustomer.name || undefined,
        ...(startedAt && { started_at: startedAt }),
        ...(finishedAt && { finished_at: finishedAt })
      })

      if (response.status === 'success') {
        // Store client-side timer as fallback (in case API doesn't return finished_at yet)
        if (durationMinutes > 0 && response.data?.booking_id && clientEndTime) {
          const totalSeconds = durationMinutes * 60
          setClientTimers(prev => ({
            ...prev,
            [response.data.booking_id]: { endTime: clientEndTime, totalSeconds }
          }))
        }
        
        setSuccessMessage(dictionary?.bookings?.bookingStarted || 'Booking started successfully')
        setStartBookingDialogOpen(false)
        setNewBooking({ room_id: 0, customer_id: 0, duration_minutes: 0 })
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
      const bookingId = selectedBooking.id
      const response = await bookingApi.end(bookingId)

      if (response.status === 'success') {
        // Clean up timer state for this booking
        setTimers(prev => {
          const updated = { ...prev }
          delete updated[bookingId]
          return updated
        })
        setClientTimers(prev => {
          const updated = { ...prev }
          delete updated[bookingId]
          return updated
        })
        
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

  const handleSwitchRoom = async () => {
    if (!selectedBooking || !newRoomId) return

    try {
      setIsSubmitting(true)
      const response = await bookingApi.switchRoom(selectedBooking.id, newRoomId)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.roomSwitched || 'Room switched successfully')
        setSwitchRoomDialogOpen(false)
        setSelectedBooking(null)
        setNewRoomId(0)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'warning'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'error'
      default:
        return 'default'
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = parseServerDateTimeMs(startTime)
    const end = endTime ? parseServerDateTimeMs(endTime) : Date.now()
    const diff = (end - start) / (1000 * 60 * 60) // hours
    return diff.toFixed(1)
  }

  const formatTimer = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    // Format numbers based on locale
    const formatNum = (num: number, pad = false) => {
      const str = pad ? num.toString().padStart(2, '0') : num.toString()
      return isRtl ? toArabicDigits(str) : str
    }
    
    if (hrs > 0) {
      return `${formatNum(hrs)}:${formatNum(mins, true)}:${formatNum(secs, true)}`
    }
    return `${formatNum(mins)}:${formatNum(secs, true)}`
  }

  // Use centralized timezone utilities for proper UTC to local conversion
  const parseDateTime = parseServerDateTimeMs

  const displayBookings = statusFilter === 'active' ? activeBookings : bookings

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6} dir={isRtl ? 'rtl' : 'ltr'}>
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

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.bookings || 'Bookings'}
            action={
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setStartBookingDialogOpen(true)}
                disabled={availableRooms.length === 0}
              >
                {dictionary?.bookings?.startBooking || 'Start Booking'}
              </Button>
            }
          />
          <CardContent>
            <div className={`flex flex-wrap gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomTextField
                select
                label={dictionary?.common?.status || 'Status'}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className='min-w-[150px]'
              >
                <MenuItem value='active'>{dictionary?.bookings?.activeBookings || 'Active'}</MenuItem>
                <MenuItem value='today'>{dictionary?.bookings?.todaysBookings || "Today's"}</MenuItem>
              </CustomTextField>
              <CustomTextField
                label={dictionary?.common?.search || 'Search'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={dictionary?.customers?.customerName || 'Customer name'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position={isRtl ? 'end' : 'start'}>
                      <i className='tabler-search' />
                    </InputAdornment>
                  )
                }}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Active Bookings Summary */}
      {statusFilter === 'active' && (
        <Grid size={{ xs: 12 }}>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Card variant='outlined'>
              <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className='rounded-lg p-3 bg-primary'>
                  <i className={`tabler-door-enter text-white text-2xl ${isRtl ? 'scale-x-[-1]' : ''}`} />
                </div>
                <div className={isRtl ? 'text-right' : ''}>
                  <Typography variant='h5'>{isRtl ? toArabicDigits(activeBookings.length.toString()) : activeBookings.length}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.bookings?.activeBookings || 'Active Bookings'}
                  </Typography>
                </div>
              </CardContent>
            </Card>
            <Card variant='outlined'>
              <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                <div className='rounded-lg p-3 bg-success'>
                  <i className='tabler-door text-white text-2xl' />
                </div>
                <div className={isRtl ? 'text-right' : ''}>
                  <Typography variant='h5'>{isRtl ? toArabicDigits(availableRooms.length.toString()) : availableRooms.length}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.rooms?.available || 'Available Rooms'}
                  </Typography>
                </div>
              </CardContent>
            </Card>
          </div>
        </Grid>
      )}

      {/* Bookings Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            {displayBookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full' dir={isRtl ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className='border-b'>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.type || 'Type'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.startTime || 'Start Time'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.duration || 'Duration'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.timer || 'Timer'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.price || 'Price'}</th>
                      <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(displayBookings as any[])
                      .filter(b =>
                        !searchQuery ||
                        b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        b.room_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((booking: any) => {
                        const isActive = statusFilter === 'active' || booking.status === 'active'
                        const isPending = booking.status === 'pending'
                        const isScheduled = booking.booking_type === 'scheduled'
                        const duration = isActive 
                          ? (booking.current_duration_hours || booking.elapsed_hours || 0)
                          : formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
                        
                        return (
                          <tr key={booking.id} className='border-b last:border-0'>
                            <td className='p-3'>
                              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
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
                              <div className='flex flex-col gap-1'>
                                <Chip
                                  label={isScheduled ? (dictionary?.bookings?.scheduled || 'Scheduled') : (dictionary?.bookings?.open || 'Open')}
                                  color={isScheduled ? 'info' : 'primary'}
                                  size='small'
                                  variant='outlined'
                                />
                                {isPending && (
                                  <Chip
                                    label={dictionary?.bookings?.pending || 'Pending'}
                                    color='warning'
                                    size='small'
                                    variant='outlined'
                                  />
                                )}
                              </div>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>
                                {formatLocalTime(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {formatLocalDate(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Chip
                                label={typeof duration === 'number' 
                                  ? (duration < 1 
                                    ? `${isRtl ? toArabicDigits(Math.round(duration * 60).toString()) : Math.round(duration * 60)} ${dictionary?.common?.mins || 'mins'}` 
                                    : `${isRtl ? toArabicDigits(duration.toFixed(1)) : duration.toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`)
                                  : `${isRtl ? toArabicDigits(duration.toString()) : duration} ${dictionary?.common?.hours || 'hrs'}`}
                                color={isActive ? 'warning' : 'default'}
                                variant={isActive ? 'filled' : 'outlined'}
                                size='small'
                              />
                              {isScheduled && booking.remaining_hours && (
                                <Typography variant='caption' color='text.secondary' className='block mt-1'>
                                  {isRtl 
                                    ? `${toArabicDigits(booking.remaining_hours.toFixed(1))} ${dictionary?.common?.hoursRemaining || 'ساعة متبقية'}`
                                    : `${booking.remaining_hours.toFixed(1)}h remaining`}
                                </Typography>
                              )}
                            </td>
                            <td className='p-3'>
                              {isActive && booking.finished_at && booking.started_at ? (
                                (() => {
                                  // Calculate total duration from start to finish
                                  const startTime = parseDateTime(booking.started_at)
                                  const endTime = parseDateTime(booking.finished_at)
                                  const totalSeconds = Math.floor((endTime - startTime) / 1000)
                                  
                                  // Calculate elapsed time dynamically using currentTime for real-time updates
                                  const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
                                  const remainingSeconds = Math.max(0, Math.floor((endTime - currentTime) / 1000))
                                  
                                  // Progress: 0% at start, 100% when time is up
                                  const progress = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
                                  const isCompleted = progress >= 100
                                  const isAlmostDone = progress >= 80 && !isCompleted
                                  const isNearEnd = progress >= 50 && progress < 80
                                  const color = isCompleted ? '#4caf50' : isAlmostDone ? '#ff9800' : '#2196f3'
                                  
                                  if (isCompleted) {
                                    return (
                                      <div className='min-w-[120px]'>
                                        <div className={`flex items-center justify-between mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                          <Typography variant='caption' fontWeight={600} color='success.main'>
                                            {dictionary?.bookings?.completed || 'Done'}
                                          </Typography>
                                          <i className='tabler-check text-sm' style={{ color: '#4caf50' }} />
                                        </div>
                                        <div className='w-full h-2 rounded-full overflow-hidden bg-success/20'>
                                          <div className='h-full rounded-full bg-success' style={{ width: '100%' }} />
                                        </div>
                                        <Typography variant='caption' color='text.secondary' className={`block mt-0.5 ${isRtl ? 'text-right' : ''}`}>
                                          {dictionary?.bookings?.timesUp || "Time's up!"}
                                        </Typography>
                                      </div>
                                    )
                                  }
                                  
                                  return (
                                    <div className='min-w-[120px]'>
                                      <div className={`flex items-center justify-between mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                        <Typography variant='caption' fontWeight={600} style={{ color }}>
                                          {formatTimer(remainingSeconds)} {dictionary?.bookings?.left || 'left'}
                                        </Typography>
                                        <i className={`tabler-clock text-sm ${isAlmostDone ? 'animate-pulse' : ''}`} style={{ color }} />
                                      </div>
                                      <div 
                                        className='w-full h-2 rounded-full overflow-hidden'
                                        style={{ backgroundColor: `${color}20` }}
                                      >
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ease-linear ${isRtl ? 'ml-auto' : ''}`}
                                          style={{ 
                                            width: `${progress}%`,
                                            backgroundColor: color
                                          }}
                                        />
                                      </div>
                                      <Typography variant='caption' color='text.secondary' className={`block mt-0.5 ${isRtl ? 'text-right' : ''}`}>
                                        {isRtl ? Math.round(progress).toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]) : Math.round(progress)}% {dictionary?.bookings?.elapsed || 'elapsed'}
                                      </Typography>
                                    </div>
                                  )
                                })()
                              ) : (
                                <Typography variant='body2' color='text.secondary'>
                                  {dictionary?.bookings?.openEnded || 'Open'}
                                </Typography>
                              )}
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2' fontWeight={500} color='success.main'>
                                {isActive
                                  ? `~${isRtl ? toArabicDigits(booking.estimated_price?.toFixed(2) || '0') : booking.estimated_price?.toFixed(2)}`
                                  : (isRtl ? toArabicDigits((booking.price || booking.total_price || 0).toString()) : (booking.price || booking.total_price || 0))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              {isActive && !isPending && !booking.finished_at && (
                                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                  <Button
                                    variant='contained'
                                    color='error'
                                    size='small'
                                    onClick={() => {
                                      setSelectedBooking(booking as ActiveBooking)
                                      setEndBookingDialogOpen(true)
                                    }}
                                  >
                                    {dictionary?.bookings?.endBooking || 'End'}
                                  </Button>
                                </div>
                              )}
                              {isActive && !isPending && booking.finished_at && (
                                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                  <Button
                                    variant='contained'
                                    color='error'
                                    size='small'
                                    onClick={() => {
                                      setSelectedBooking(booking as ActiveBooking)
                                      setEndBookingDialogOpen(true)
                                    }}
                                  >
                                    {dictionary?.bookings?.endBooking || 'End'}
                                  </Button>
                                 
                                </div>
                              )}
                              {isPending && (
                                <Chip label={dictionary?.bookings?.notStarted || 'Not Started'} size='small' color='default' />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-12'>
                <i className='tabler-calendar-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {statusFilter === 'active'
                    ? dictionary?.rooms?.noActiveBooking || 'No active bookings'
                    : dictionary?.bookings?.noBookingsToday || 'No bookings today'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Last Completed Bookings */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.bookings?.lastCompletedBookings || 'Last Completed Bookings'}
            avatar={<i className='tabler-history text-xl' />}
          />
          <CardContent>
            {(() => {
              const completedBookings = (Array.isArray(bookings) ? bookings : [])
                .filter(b => b.status === 'completed')
                .sort((a, b) => parseServerDateTimeMs(b.finished_at || b.end_time) - parseServerDateTimeMs(a.finished_at || a.end_time))
                .slice(0, 10)
              
              if (completedBookings.length === 0) {
                return (
                  <div className='text-center py-8'>
                    <i className='tabler-calendar-check text-4xl text-textSecondary mb-2' />
                    <Typography color='text.secondary'>
                      {dictionary?.bookings?.noCompletedBookings || 'No completed bookings today'}
                    </Typography>
                  </div>
                )
              }
              
              return (
                <div className='overflow-x-auto'>
                  <table className='w-full' dir={isRtl ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className='border-b'>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.room || 'Room'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.customer || 'Customer'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.startTime || 'Start Time'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.endTime || 'End Time'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.duration || 'Duration'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.bookings?.price || 'Price'}</th>
                        <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.status || 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedBookings.map((booking: any) => {
                        const duration = formatDuration(booking.started_at || booking.start_time, booking.finished_at || booking.end_time)
                        
                        return (
                          <tr key={booking.id} className='border-b last:border-0'>
                            <td className='p-3'>
                              <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                                <i className='tabler-door text-lg text-success' />
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
                              <Typography variant='body2'>
                                {formatLocalTime(booking.started_at || booking.start_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2'>
                                {formatLocalTime(booking.finished_at || booking.end_time, getLocaleForRtl(isRtl))}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Chip
                                label={Number(duration) < 1 
                                  ? `${isRtl ? toArabicDigits(Math.round(Number(duration) * 60).toString()) : Math.round(Number(duration) * 60)} ${dictionary?.common?.mins || 'mins'}` 
                                  : `${isRtl ? toArabicDigits(Number(duration).toFixed(1)) : Number(duration).toFixed(1)} ${dictionary?.common?.hours || 'hrs'}`}
                                color='default'
                                variant='outlined'
                                size='small'
                              />
                            </td>
                            <td className='p-3'>
                              <Typography variant='body2' fontWeight={500} color='success.main'>
                                {isRtl ? toArabicDigits((booking.price || booking.total_price || 0).toString()) : (booking.price || booking.total_price || 0)} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                            <td className='p-3'>
                              <Chip
                                label={dictionary?.bookings?.completed || 'Completed'}
                                color='success'
                                size='small'
                                icon={<i className='tabler-check text-sm' />}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={startBookingDialogOpen} onClose={() => setStartBookingDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.startBooking || 'Start Booking'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              select
              label={dictionary?.bookings?.selectDuration || 'Select Duration'}
              value={newBooking.duration_minutes}
              onChange={e => setNewBooking({ ...newBooking, duration_minutes: Number(e.target.value) })}
              fullWidth
              helperText={dictionary?.bookings?.durationHelperText || 'Select a timer or leave open-ended'}
            >
              <MenuItem value={0}>
                <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
                  label = `${isRtl ? toArabicDigits(minutes.toString()) : minutes} ${dictionary?.common?.minutes || 'minutes'}`
                } else if (mins === 0) {
                  label = `${isRtl ? toArabicDigits(hours.toString()) : hours} ${hours === 1 ? dictionary?.common?.hour || 'hour' : dictionary?.common?.hours || 'hours'}`
                } else {
                  label = `${isRtl ? toArabicDigits(hours.toString()) : hours}:${isRtl ? toArabicDigits(mins.toString().padStart(2, '0')) : mins.toString().padStart(2, '0')} ${dictionary?.common?.hours || 'hours'}`
                }
                return (
                  <MenuItem key={minutes} value={minutes}>
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
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
              value={newBooking.room_id}
              onChange={e => setNewBooking({ ...newBooking, room_id: Number(e.target.value) })}
              fullWidth
              required
              helperText={dictionary?.bookings?.onlyAvailableRooms || 'Only currently available rooms'}
            >
              {availableRooms.map(room => (
                <MenuItem key={room.id} value={room.id}>
                  {room.name} - {room.ps} ({isRtl ? toArabicDigits(room.hour_cost.toString()) : room.hour_cost} {dictionary?.common?.currencyPerHour || 'EGP/hr'})
                </MenuItem>
              ))}
            </CustomTextField>

            <Autocomplete
              options={customers}
              getOptionLabel={(option) => `${option.name} - ${option.phone}`}
              value={customers.find(c => c.id === newBooking.customer_id) || null}
              onChange={(_, newValue) => setNewBooking({ ...newBooking, customer_id: newValue?.id || 0 })}
              renderInput={(params) => (
                <CustomTextField
                  {...params}
                  label={dictionary?.customers?.selectCustomer || 'Select Customer'}
                  placeholder={dictionary?.common?.search || 'Search by name or phone'}
                  required
                />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, { inputValue }) => {
                const searchTerm = inputValue.toLowerCase()
                return options.filter(
                  (option) =>
                    option.name?.toLowerCase().includes(searchTerm) ||
                    option.phone?.toLowerCase().includes(searchTerm)
                )
              }}
            />
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setStartBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleStartBooking}
            disabled={isSubmitting || !newBooking.room_id || !newBooking.customer_id}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.startBooking || 'Start Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* End Booking Dialog */}
      <Dialog open={endBookingDialogOpen} onClose={() => setEndBookingDialogOpen(false)} dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.endBooking || 'End Booking'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Typography>{dictionary?.bookings?.confirmEnd || 'Are you sure you want to end this booking?'}</Typography>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2' fontWeight={600}>
                    {selectedBooking.room_name}
                  </Typography>
                  <Typography variant='body2'>{selectedBooking.customer_name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {(() => {
                      const hrs = selectedBooking.current_duration_hours || selectedBooking.elapsed_hours || 0;
                      const minsVal = Math.round(hrs * 60);
                      const hrsVal = hrs.toFixed(1);
                      return hrs < 1 
                        ? `${isRtl ? toArabicDigits(minsVal.toString()) : minsVal} ${dictionary?.common?.mins || 'mins'}` 
                        : `${isRtl ? toArabicDigits(hrsVal) : hrsVal} ${dictionary?.common?.hours || 'hours'}`;
                    })()}
                  </Typography>
                  <Typography variant='h5' color='success.main' className='mt-2'>
                    ~{isRtl ? toArabicDigits(selectedBooking.estimated_price?.toFixed(2) || '0') : selectedBooking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setEndBookingDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button variant='contained' color='error' onClick={handleEndBooking} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.endBooking || 'End'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Switch Room Dialog */}
      <Dialog open={switchRoomDialogOpen} onClose={() => setSwitchRoomDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.bookings?.switchRoom || 'Switch Room'}</DialogTitle>
        <DialogContent>
          {selectedBooking && (
            <div className='flex flex-col gap-4 pt-2'>
              <Typography>
                {dictionary?.bookings?.switchFromRoom || 'Switching from'}: <strong>{selectedBooking.room_name}</strong>
              </Typography>
              <CustomTextField
                select
                label={dictionary?.bookings?.selectNewRoom || 'Select New Room'}
                value={newRoomId}
                onChange={e => setNewRoomId(Number(e.target.value))}
                fullWidth
                required
              >
                {availableRooms.map(room => (
                  <MenuItem key={room.id} value={room.id}>
                    {room.name} - {room.ps} ({isRtl ? toArabicDigits(room.hour_cost.toString()) : room.hour_cost} {dictionary?.common?.currencyPerHour || 'EGP/hr'})
                  </MenuItem>
                ))}
              </CustomTextField>
            </div>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setSwitchRoomDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleSwitchRoom}
            disabled={isSubmitting || !newRoomId}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.switchRoom || 'Switch'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default BookingsList
