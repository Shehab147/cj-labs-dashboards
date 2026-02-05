'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'

// Dictionary Hook
import { useClientDictionary } from '@/hooks/useClientDictionary'

interface Notification {
  id: string
  title: string
  message: React.ReactNode
  severity: 'success' | 'info' | 'warning' | 'error'
  duration?: number // Auto-hide duration in ms
  countdown?: number // Optional countdown in seconds
}

interface NotificationQueueContextType {
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationQueueContext = createContext<NotificationQueueContextType | null>(null)

export const useNotificationQueue = () => {
  const context = useContext(NotificationQueueContext)
  if (!context) {
    throw new Error('useNotificationQueue must be used within NotificationQueueProvider')
  }
  return context
}

// Separate component for the notification display that uses dictionary
const NotificationSnackbar: React.FC<{
  isOpen: boolean
  currentNotification: Notification | null
  countdown: number | null
  queueLength: number
  onClose: (event?: React.SyntheticEvent | Event, reason?: string) => void
  onExited: () => void
}> = ({ isOpen, currentNotification, countdown, queueLength, onClose, onExited }) => {
  const dictionary = useClientDictionary()
  const notifications = dictionary?.notifications || {}
  const common = dictionary?.common || {}

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNumber = (num: number): string => {
    const isArabic = dictionary?.navigation?.main === 'الرئيسية' // Check if Arabic
    if (isArabic) {
      return num.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
    }
    return num.toString()
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const minsLabel = common?.mins || 'm'
    const secsLabel = common?.secs || 's'
    return `${toLocalizedNumber(mins)}${minsLabel} ${toLocalizedNumber(secs)}${secsLabel}`
  }

  return (
    <Snackbar
      open={isOpen}
      autoHideDuration={currentNotification?.duration || 8000}
      onClose={onClose}
      TransitionProps={{ onExited }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: 2 }}
    >
      <Alert
        severity={currentNotification?.severity || 'info'}
        variant="filled"
        onClose={onClose}
        sx={{
          minWidth: 320,
          maxWidth: 400,
          '& .MuiAlert-message': { overflow: 'hidden' }
        }}
      >
        <AlertTitle sx={{ mb: 0.5, fontWeight: 600 }}>
          {currentNotification?.title}
        </AlertTitle>
        <Box sx={{ lineHeight: 1.5 }}>
          {currentNotification?.message}
          {countdown !== null && countdown > 0 && (
            <Box sx={{ mt: 0.5, fontWeight: 500 }}>
              ⏱️ {formatCountdown(countdown)}
            </Box>
          )}
        </Box>
        {queueLength > 0 && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: '0.75rem', opacity: 0.9 }}>
            +{toLocalizedNumber(queueLength)} {notifications.moreNotificationsInQueue || 'more notification(s) in queue'}
          </Box>
        )}
      </Alert>
    </Snackbar>
  )
}

export const NotificationQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Notification[]>([])
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const notificationIdRef = useRef(0)

  // Process queue - show next notification when current one closes
  useEffect(() => {
    if (!isOpen && queue.length > 0) {
      const [next, ...rest] = queue
      setCurrentNotification(next)
      setCountdown(next.countdown || null)
      setQueue(rest)
      setIsOpen(true)
    }
  }, [isOpen, queue])

  // Handle countdown
  useEffect(() => {
    if (isOpen && countdown !== null && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return null
          }
          return prev - 1
        })
      }, 1000)
      
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    }
  }, [isOpen, currentNotification?.id])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${++notificationIdRef.current}-${Date.now()}`
    const newNotification: Notification = { ...notification, id }
    
    setQueue(prev => [...prev, newNotification])
  }, [])

  const removeNotification = useCallback((id: string) => {
    setQueue(prev => prev.filter(n => n.id !== id))
    if (currentNotification?.id === id) {
      setIsOpen(false)
    }
  }, [currentNotification])

  const clearAll = useCallback(() => {
    setQueue([])
    setIsOpen(false)
    setCurrentNotification(null)
  }, [])

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return
    setIsOpen(false)
    setCurrentNotification(null)
    setCountdown(null)
  }

  const handleExited = () => {
    // Notification has fully exited, allowing next one to show
  }

  return (
    <NotificationQueueContext.Provider value={{ addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationSnackbar
        isOpen={isOpen}
        currentNotification={currentNotification}
        countdown={countdown}
        queueLength={queue.length}
        onClose={handleClose}
        onExited={handleExited}
      />
    </NotificationQueueContext.Provider>
  )
}
