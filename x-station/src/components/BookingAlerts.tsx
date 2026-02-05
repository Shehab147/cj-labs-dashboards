'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'

// API Import
import { bookingApi } from '@/services/api'

// Auth Context
import { useAuth } from '@/contexts/authContext'

// Notification Queue Context
import { useNotificationQueue } from '@/contexts/notificationQueueContext'

// Dictionary Hook
import { useClientDictionary } from '@/hooks/useClientDictionary'

interface BookingAlert {
  id: number
  room_id: number
  room_name: string
  customer_name: string | null
  customer_phone: string | null
  started_at: string
  finished_at: string
  price: number
  orders_total: number
  remaining_minutes: number
  remaining_seconds: number
  total_remaining_seconds: number
  alert_type: string
  alert_message: string
}

interface BookingAlertsResponse {
  count: number
  alerts: BookingAlert[]
}

// Poll interval in milliseconds (30 seconds)
const POLL_INTERVAL = 30000

// Sound notification (optional - can be enabled)
const playAlertSound = () => {
  if (typeof window !== 'undefined' && 'Audio' in window) {
    try {
      // Create a simple beep sound using AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (e) {
      console.log('Audio notification not supported')
    }
  }
}

const BookingAlerts = () => {
  const { isAuthenticated } = useAuth()
  const { addNotification } = useNotificationQueue()
  const dictionary = useClientDictionary()
  const notifications = dictionary?.notifications || {}
  const common = dictionary?.common || {}
  
  const [alerts, setAlerts] = useState<BookingAlert[]>([])
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const previousAlertIds = useRef<Set<number>>(new Set())
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNumber = useCallback((num: number): string => {
    const isArabic = dictionary?.navigation?.main === 'الرئيسية'
    if (isArabic) {
      return num.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
    }
    return num.toString()
  }, [dictionary])

  const showBookingNotification = useCallback((alert: BookingAlert) => {
    const mins = Math.floor(alert.total_remaining_seconds / 60)
    const secs = alert.total_remaining_seconds % 60
    const minsLabel = common?.mins || 'm'
    const secsLabel = common?.secs || 's'
    
    addNotification({
      title: notifications.bookingEndingSoon || 'Booking Ending Soon!',
      message: (
        <>
          <strong>{alert.room_name}</strong> - {alert.customer_name || (notifications.guest || 'Guest')}
          <br />
          {notifications.endsIn || 'Ends in'} <strong>{toLocalizedNumber(mins)}{minsLabel} {toLocalizedNumber(secs)}{secsLabel}</strong>
        </>
      ),
      severity: 'warning',
      duration: 10000,
      countdown: alert.total_remaining_seconds
    })
  }, [addNotification, notifications, common, toLocalizedNumber])

  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await bookingApi.getEndingAlerts()
      
      if (response.status === 'success' && response.data) {
        const data = response.data as BookingAlertsResponse
        const newAlerts = data.alerts || []
        
        // Check for new alerts that weren't in the previous fetch
        const currentIds = new Set(newAlerts.map(a => a.id))
        const newAlertItems = newAlerts.filter(a => !previousAlertIds.current.has(a.id))
        
        // If there are new alerts, show notifications (queue each one)
        if (newAlertItems.length > 0 && previousAlertIds.current.size > 0) {
          newAlertItems.forEach(alert => {
            showBookingNotification(alert)
          })
          if (soundEnabled) {
            playAlertSound()
          }
        }
        
        // Also show notification on first load if there are alerts
        if (previousAlertIds.current.size === 0 && newAlerts.length > 0) {
          // Show only first alert on initial load to avoid spam
          showBookingNotification(newAlerts[0])
          if (soundEnabled) {
            playAlertSound()
          }
        }
        
        previousAlertIds.current = currentIds
        setAlerts(newAlerts)
      }
    } catch (error) {
      console.error('Failed to fetch booking alerts:', error)
    }
  }, [isAuthenticated, soundEnabled, showBookingNotification])

  // Initial fetch and polling
  useEffect(() => {
    if (!isAuthenticated) return

    // Initial fetch
    fetchAlerts()

    // Set up polling interval
    const intervalId = setInterval(fetchAlerts, POLL_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAuthenticated, fetchAlerts])

  // Countdown timer for alerts (updates every second)
  useEffect(() => {
    if (alerts.length === 0) return

    const countdownInterval = setInterval(() => {
      // Update all alerts countdown
      setAlerts(prevAlerts => 
        prevAlerts.map(alert => {
          const newTotalSeconds = Math.max(0, alert.total_remaining_seconds - 1)
          return {
            ...alert,
            total_remaining_seconds: newTotalSeconds,
            remaining_minutes: Math.floor(newTotalSeconds / 60),
            remaining_seconds: newTotalSeconds % 60
          }
        }).filter(alert => alert.total_remaining_seconds > 0) // Remove alerts that have ended
      )
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [alerts.length])

  const handlePopoverOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handlePopoverClose = () => {
    setAnchorEl(null)
  }

  const formatTime = (minutes: number, seconds: number) => {
    const minsLabel = common?.mins || 'm'
    const secsLabel = common?.secs || 's'
    return `${toLocalizedNumber(minutes)}${minsLabel} ${toLocalizedNumber(seconds)}${secsLabel}`
  }

  const popoverOpen = Boolean(anchorEl)

  // Don't render if not authenticated
  if (!isAuthenticated) return null

  return (
    <>
      {/* Alert Bell Icon with Badge */}
      <Tooltip title={alerts.length > 0 ? `${toLocalizedNumber(alerts.length)} ${notifications.bookingsEndingSoon || 'booking(s) ending soon'}` : (notifications.noAlerts || 'No booking alerts')}>
        <IconButton 
          onClick={handlePopoverOpen}
          sx={{ 
            position: 'fixed', 
            bottom: 80, 
            right: 24, 
            zIndex: 1200,
            bgcolor: alerts.length > 0 ? 'warning.main' : 'background.paper',
            color: alerts.length > 0 ? 'warning.contrastText' : 'text.primary',
            boxShadow: 3,
            '&:hover': {
              bgcolor: alerts.length > 0 ? 'warning.dark' : 'action.hover',
            },
            animation: alerts.length > 0 ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.1)' },
              '100%': { transform: 'scale(1)' },
            }
          }}
        >
          <Badge badgeContent={toLocalizedNumber(alerts.length)} color="error">
            <i className="tabler-bell" style={{ fontSize: 24 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Alerts Popover */}
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Box sx={{ width: 350, maxHeight: 400, overflow: 'auto' }}>
          <Box sx={{ p: 2, bgcolor: 'primary.main' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              <i className="tabler-clock-exclamation" style={{ marginInlineEnd: 8 }} />
              {notifications.title || 'Booking Alerts'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              {notifications.subtitle || 'Bookings ending in the next 5 minutes'}
            </Typography>
          </Box>
          
          {alerts.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <i className="tabler-check-circle" style={{ fontSize: 48, color: '#4caf50' }} />
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {notifications.noBookingsEndingSoon || 'No bookings ending soon'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {alerts.map((alert, index) => (
                <Box key={alert.id}>
                  <ListItem 
                    sx={{ 
                      bgcolor: alert.total_remaining_seconds < 120 ? 'error.lighter' : 'warning.lighter',
                      py: 2 
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {alert.room_name}
                          </Typography>
                          <Chip 
                            label={formatTime(alert.remaining_minutes, alert.remaining_seconds)}
                            color={alert.total_remaining_seconds < 120 ? 'error' : 'warning'}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }} component="span">
                          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                            <i className="tabler-user" style={{ marginRight: 4, fontSize: 14 }} />
                            {alert.customer_name || (notifications.guest || 'Guest')}
                          </Typography>
                          {alert.customer_phone && (
                            <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                              <i className="tabler-phone" style={{ marginRight: 4, fontSize: 14 }} />
                              {alert.customer_phone}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                            <i className="tabler-clock" style={{ marginRight: 4, fontSize: 14 }} />
                            {notifications.endsAt || 'Ends at'}: {new Date(alert.finished_at).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < alerts.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
          
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {notifications.autoRefresh || 'Auto-refreshes every 30 seconds'}
            </Typography>
            <Tooltip title={soundEnabled ? (notifications.muteAlerts || 'Mute alerts') : (notifications.enableSound || 'Enable sound alerts')}>
              <IconButton size="small" onClick={() => setSoundEnabled(!soundEnabled)}>
                <i className={soundEnabled ? 'tabler-volume' : 'tabler-volume-off'} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

export default BookingAlerts
