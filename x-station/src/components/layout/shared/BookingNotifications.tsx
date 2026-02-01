'use client'

// React Imports
import { useRef, useState, useEffect, useCallback } from 'react'
import type { MouseEvent, ReactNode } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import useMediaQuery from '@mui/material/useMediaQuery'
import Button from '@mui/material/Button'
import type { Theme } from '@mui/material/styles'

// Third Party Components
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Service Imports
import { bookingApi } from '@/services/api'

// Type Imports
import type { ActiveBooking } from '@/types/xstation'
import type { Locale } from '@configs/i18n'

// Data Imports
import enDict from '@/data/dictionaries/en.json'
import arDict from '@/data/dictionaries/ar.json'

const dictionaries = { en: enDict, ar: arDict }

interface BookingNotification {
  id: number
  roomName: string
  customerName: string
  minutesRemaining: number
  bookingId: number
  read: boolean
}

const ScrollWrapper = ({ children, hidden }: { children: ReactNode; hidden: boolean }) => {
  if (hidden) {
    return <div className='overflow-x-hidden bs-full'>{children}</div>
  } else {
    return (
      <PerfectScrollbar className='bs-full' options={{ wheelPropagation: false, suppressScrollX: true }}>
        {children}
      </PerfectScrollbar>
    )
  }
}

const BookingNotifications = () => {
  // States
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<BookingNotification[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())

  // Vars
  const notificationCount = notifications.filter(n => !n.read).length

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  // Hooks
  const hidden = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))
  const { settings } = useSettings()
  const { lang } = useParams()
  const currentLocale = (lang as Locale) || 'en'
  const dict = dictionaries[currentLocale] || dictionaries.en
  const t = dict.notifications

  // Fetch active bookings and check for ending soon
  const checkEndingBookings = useCallback(async () => {
    try {
      const response = await bookingApi.getActive()
      
      if (response.status === 'success' && response.data) {
        const activeBookings: ActiveBooking[] = response.data
        const now = new Date()
        
        // Filter bookings ending within 5 minutes
        const endingSoon = activeBookings.filter(booking => {
          if (!booking.started_at) return false
          
          const startedAt = new Date(booking.started_at)
          const elapsedMs = now.getTime() - startedAt.getTime()
          const elapsedMinutes = elapsedMs / (1000 * 60)
          
          // Assuming bookings are typically 1 hour, check if within last 5 minutes
          // We'll calculate based on elapsed time approaching a full hour
          const elapsedHours = Math.floor(elapsedMinutes / 60)
          const minutesIntoCurrentHour = elapsedMinutes % 60
          const minutesUntilNextHour = 60 - minutesIntoCurrentHour
          
          // Notify if within 5 minutes of completing the current hour
          return minutesUntilNextHour <= 5 && minutesUntilNextHour > 0
        })

        // Convert to notifications
        const newNotifications: BookingNotification[] = endingSoon
          .filter(booking => !dismissedIds.has(booking.id))
          .map(booking => {
            const startedAt = new Date(booking.started_at)
            const elapsedMs = now.getTime() - startedAt.getTime()
            const elapsedMinutes = elapsedMs / (1000 * 60)
            const minutesIntoCurrentHour = elapsedMinutes % 60
            const minutesUntilNextHour = Math.ceil(60 - minutesIntoCurrentHour)

            return {
              id: booking.id,
              roomName: booking.room_name,
              customerName: booking.customer_name,
              minutesRemaining: minutesUntilNextHour,
              bookingId: booking.id,
              read: false
            }
          })

        setNotifications(newNotifications)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }, [dismissedIds])

  // Poll for ending bookings every 30 seconds
  useEffect(() => {
    checkEndingBookings()
    const interval = setInterval(checkEndingBookings, 30000)
    return () => clearInterval(interval)
  }, [checkEndingBookings])

  const handleClose = () => {
    setOpen(false)
  }

  const handleToggle = () => {
    setOpen(prevOpen => !prevOpen)
  }

  const handleReadNotification = (event: MouseEvent<HTMLElement>, index: number) => {
    event.stopPropagation()
    const newNotifications = [...notifications]
    newNotifications[index].read = true
    setNotifications(newNotifications)
  }

  const handleDismissNotification = (event: MouseEvent<HTMLElement>, index: number) => {
    event.stopPropagation()
    const notification = notifications[index]
    setDismissedIds(prev => new Set([...prev, notification.id]))
    const newNotifications = [...notifications]
    newNotifications.splice(index, 1)
    setNotifications(newNotifications)
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  useEffect(() => {
    const adjustPopoverHeight = () => {
      if (ref.current) {
        const availableHeight = window.innerHeight - 100
        ref.current.style.height = `${Math.min(availableHeight, 450)}px`
      }
    }

    window.addEventListener('resize', adjustPopoverHeight)
    return () => window.removeEventListener('resize', adjustPopoverHeight)
  }, [])

  return (
    <>
      <IconButton ref={anchorRef} onClick={handleToggle} className='text-textPrimary'>
        <Badge
          color='error'
          className='cursor-pointer'
          variant='dot'
          overlap='circular'
          invisible={notificationCount === 0}
          sx={{
            '& .MuiBadge-dot': { top: 6, right: 5, boxShadow: 'var(--mui-palette-background-paper) 0px 0px 0px 2px' }
          }}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <i className='tabler-bell' />
        </Badge>
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        ref={ref}
        anchorEl={anchorRef.current}
        {...(isSmallScreen
          ? {
              className: 'is-full !mbs-3 z-[1] max-bs-[450px] bs-[450px]',
              modifiers: [
                {
                  name: 'preventOverflow',
                  options: {
                    padding: themeConfig.layoutPadding
                  }
                }
              ]
            }
          : { className: 'is-96 !mbs-3 z-[1] max-bs-[450px] bs-[450px]' })}
      >
        {({ TransitionProps, placement }) => (
          <Fade {...TransitionProps} style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}>
            <Paper className={classnames('bs-full', settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg')}>
              <ClickAwayListener onClickAway={handleClose}>
                <div className='bs-full flex flex-col'>
                  <div className='flex items-center justify-between plb-3.5 pli-4 is-full gap-2'>
                    <Typography variant='h6' className='flex-auto'>
                      {t.title}
                    </Typography>
                    {notificationCount > 0 && (
                      <Chip size='small' variant='tonal' color='warning' label={`${notificationCount} ${t.endingSoon}`} />
                    )}
                    {notifications.length > 0 && notificationCount > 0 && (
                      <IconButton size='small' onClick={markAllAsRead} className='text-textPrimary'>
                        <i className='tabler-checks' />
                      </IconButton>
                    )}
                  </div>
                  <Divider />
                  <ScrollWrapper hidden={hidden}>
                    {notifications.length === 0 ? (
                      <div className='flex flex-col items-center justify-center p-8 text-center'>
                        <CustomAvatar color='success' skin='light' size={64} className='mbe-4'>
                          <i className='tabler-check text-3xl' />
                        </CustomAvatar>
                        <Typography variant='body1' color='text.secondary'>
                          {t.noBookingsEndingSoon}
                        </Typography>
                        <Typography variant='caption' color='text.disabled' className='mbs-1'>
                          {t.allRoomsRunning}
                        </Typography>
                      </div>
                    ) : (
                      notifications.map((notification, index) => (
                        <div
                          key={notification.id}
                          className={classnames('flex plb-3 pli-4 gap-3 cursor-pointer hover:bg-actionHover group', {
                            'border-be': index !== notifications.length - 1,
                            'bg-actionHover': !notification.read
                          })}
                          onClick={e => handleReadNotification(e, index)}
                        >
                          <CustomAvatar color='warning' skin='light'>
                            <i className='tabler-clock-exclamation' />
                          </CustomAvatar>
                          <div className='flex flex-col flex-auto'>
                            <Typography variant='body2' className='font-medium mbe-1' color='text.primary'>
                              {notification.roomName} - {t.roomEndingSoon}
                            </Typography>
                            <Typography variant='caption' color='text.secondary' className='mbe-1'>
                              {t.customer}: {notification.customerName}
                            </Typography>
                            <Typography variant='caption' color='warning.main' className='font-medium'>
                              ⏱️ {notification.minutesRemaining} {t.minUntilHourEnds}
                            </Typography>
                          </div>
                          <div className='flex flex-col items-end gap-2'>
                            <Badge
                              variant='dot'
                              color={notification.read ? 'secondary' : 'warning'}
                              className={classnames('mbs-1 mie-1', {
                                'invisible group-hover:visible': notification.read
                              })}
                            />
                            <i
                              className='tabler-x text-xl invisible group-hover:visible'
                              onClick={e => handleDismissNotification(e, index)}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollWrapper>
                  <Divider />
                  <div className='p-4'>
                    <Button fullWidth variant='contained' size='small' href='/bookings'>
                      {t.viewAllBookings}
                    </Button>
                  </div>
                </div>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default BookingNotifications
