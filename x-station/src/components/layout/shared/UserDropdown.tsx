'use client'

// React Imports
import { useRef, useState, useEffect } from 'react'
import type { MouseEvent } from 'react'

// Next Imports
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import { styled } from '@mui/material/styles'
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'

// Third-party Imports
import { signOut, useSession } from 'next-auth/react'

// Type Imports
import type { Locale } from '@configs/i18n'

// Config Imports
import { i18n } from '@configs/i18n'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'
import { useClientDictionary } from '@/hooks/useClientDictionary'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Service Imports
import { getStoredAdmin, shiftApi } from '@/services/api'

// Context Imports
import { useAuth } from '@/contexts/authContext'

// Notification hook
import { useNotification } from '@/hooks/useNotification'

// Styled component for badge content
const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

const UserDropdown = () => {
  // States
  const [open, setOpen] = useState(false)
  const [admin, setAdmin] = useState<any>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [hasActiveShift, setHasActiveShift] = useState(true) // Default to true to show End Shift initially
  const [shiftEndModalOpen, setShiftEndModalOpen] = useState(false)
  const [shiftEndExpectedCash, setShiftEndExpectedCash] = useState<number | null>(null)
  const [shiftEndCashDifference, setShiftEndCashDifference] = useState<number | null>(null)

  // Refs
  const anchorRef = useRef<HTMLDivElement>(null)

  // Hooks
  const router = useRouter()
  const { data: session } = useSession()
  const { settings } = useSettings()
  const { lang: locale } = useParams()
  const dictionary = useClientDictionary()
  const { showSuccess, showError } = useNotification()

  // Get admin data from localStorage
  useEffect(() => {
    const adminData = getStoredAdmin()
    setAdmin(adminData)
  }, [])

  // Check for active shift on mount
  useEffect(() => {
    const checkActiveShift = async () => {
      try {
        const response = await shiftApi.getCurrent()
        if (response.status === 'success') {
          setHasActiveShift(response.data?.has_active_shift ?? false)
        }
      } catch (error) {
        console.error('Failed to check active shift:', error)
      }
    }
    checkActiveShift()
  }, [])

  // Use admin data from localStorage or fallback to session
  const userName = admin?.name || session?.user?.name || ''
  const userEmail = admin?.email || session?.user?.email || ''
  const userImage = session?.user?.image || ''
  const isRtl = i18n.langDirection[locale as keyof typeof i18n.langDirection] === 'rtl'

  const toArabicDigits = (value: string | number) => {
    const digits = '٠١٢٣٤٥٦٧٨٩'
    return String(value).replace(/[0-9]/g, d => digits[parseInt(d, 10)])
  }

  const handleDropdownOpen = () => {
    !open ? setOpen(true) : setOpen(false)
  }

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent), url?: string) => {
    if (url) {
      router.push(getLocalizedUrl(url, locale as Locale))
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  // Get logout from auth context
  const { logout } = useAuth()

  const handleShiftToggle = async () => {
    try {
      setShiftLoading(true)
      if (hasActiveShift) {
        // End shift
        const response = await shiftApi.end({})
        if (response.status === 'success') {
          const expectedCash = response.data?.expected_cash ?? response.data?.expectedCash ?? null
          const cashDifference = response.data?.cash_difference ?? response.data?.cashDifference ?? null
          const expectedCashValue = expectedCash !== null ? Number(expectedCash) : null
          const cashDifferenceValue = cashDifference !== null ? Number(cashDifference) : null
          setShiftEndExpectedCash(expectedCashValue)
          setShiftEndCashDifference(cashDifferenceValue)
          setShiftEndModalOpen(true)
          setHasActiveShift(false)
          setOpen(false)
        } else {
          showError(response.message || dictionary.shifts.shiftEndFailed)
        }
      } else {
        // Start shift
        const response = await shiftApi.start({})
        if (response.status === 'success') {
          showSuccess(dictionary.shifts.shiftStarted)
          setHasActiveShift(true)
          setOpen(false)
        } else {
          showError(response.message || dictionary.shifts.shiftStartFailed)
        }
      }
    } catch (error) {
      console.error('Shift toggle error:', error)
      showError(hasActiveShift ? dictionary.shifts.shiftEndFailed : dictionary.shifts.shiftStartFailed)
    } finally {
      setShiftLoading(false)
    }
  }

  const handleUserLogout = async () => {
    try {
      // Use auth context logout which calls backend endpoint to end shift
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <>
      <Dialog
        open={shiftEndModalOpen}
        onClose={() => setShiftEndModalOpen(false)}
        aria-labelledby='shift-end-dialog-title'
      >
        <DialogTitle id='shift-end-dialog-title'>
          {dictionary.shifts.shiftEndSummaryTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dictionary.shifts.shiftEndSummaryMessage}
          </DialogContentText>
          <Box className='mt-4'>
            <Typography variant='body1'>
              {dictionary.shifts.expectedCashAtEndOfShift}
            </Typography>
            <Typography variant='h6' className='font-semibold'>
              {shiftEndExpectedCash !== null
                ? `${isRtl ? toArabicDigits(shiftEndExpectedCash.toFixed(2)) : shiftEndExpectedCash.toFixed(2)} EGP`
                : '-'}
            </Typography>
          </Box>
          {shiftEndCashDifference !== null && (
            <Box className='mt-3'>
              <Typography variant='body1'>
                {dictionary.shifts.cashDifference}
              </Typography>
              <Typography variant='h6' className='font-semibold'>
                {isRtl
                  ? `${toArabicDigits(shiftEndCashDifference.toFixed(2))} EGP`
                  : `${shiftEndCashDifference.toFixed(2)} EGP`}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShiftEndModalOpen(false)} color='primary'>
            {dictionary.common.close}
          </Button>
        </DialogActions>
      </Dialog>
      <Badge
        ref={anchorRef}
        overlap='circular'
        badgeContent={<BadgeContentSpan onClick={handleDropdownOpen} />}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        className='mis-2'
      >
        <Avatar
          ref={anchorRef}
          alt={userName}
          src={userImage}
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        />
      </Badge>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-3 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-6 gap-2' tabIndex={-1}>
                    <Avatar alt={userName} src={userImage} />
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {userName}
                      </Typography>
                      <Typography variant='caption'>{userEmail}</Typography>
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  <MenuItem className='mli-2 gap-3' onClick={e => handleDropdownClose(e, '/pages/user-profile')}>
                    <i className='tabler-user' />
                    <Typography color='text.primary'>{dictionary.navigation.profile}</Typography>
                  </MenuItem>
                  {admin?.role !== 'superadmin' && (
                    <div className='flex items-center plb-2 pli-3'>
                      <Button
                        fullWidth
                        variant='outlined'
                        color={hasActiveShift ? 'warning' : 'success'}
                        size='small'
                        disabled={shiftLoading}
                        endIcon={<i className={hasActiveShift ? 'tabler-clock-stop' : 'tabler-clock-play'} />}
                        onClick={handleShiftToggle}
                        sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                      >
                        {shiftLoading
                          ? dictionary.common.loading
                          : hasActiveShift
                          ? dictionary.shifts.endShift
                          : dictionary.shifts.startShift}
                      </Button>
                    </div>
                  )}
                  <div className='flex items-center plb-2 pli-3'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      endIcon={<i className='tabler-logout' />}
                      onClick={handleUserLogout}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      {dictionary.navigation.logout}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default UserDropdown
