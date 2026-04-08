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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'

// Third-party Imports
import { signOut, useSession } from 'next-auth/react'

// Type Imports
import type { Locale } from '@configs/i18n'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Service Imports
import { getStoredAdmin, shiftApi } from '@/services/api'

// Context Imports
import { useAuth } from '@/contexts/authContext'

// Dictionary
import { useDictionary } from '@/contexts/dictionaryContext'

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
  const t = useDictionary()
  // States
  const [open, setOpen] = useState(false)
  const [admin, setAdmin] = useState<any>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [hasActiveShift, setHasActiveShift] = useState(true) // Default to true to show End Shift initially
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [shiftDialogType, setShiftDialogType] = useState<'start' | 'end'>('start')
  const [cashInput, setCashInput] = useState('')

  // Refs
  const anchorRef = useRef<HTMLDivElement>(null)

  // Hooks
  const router = useRouter()
  const { data: session } = useSession()
  const { settings } = useSettings()
  const { lang: locale } = useParams()
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

  const openShiftDialog = (type: 'start' | 'end') => {
    setShiftDialogType(type)
    setCashInput('')
    setShiftDialogOpen(true)
    setOpen(false)
  }

  const handleShiftConfirm = async () => {
    const cashValue = parseFloat(cashInput)
    if (isNaN(cashValue) || cashValue < 0) return

    try {
      setShiftLoading(true)
      if (shiftDialogType === 'end') {
        const response = await shiftApi.end({ closing_cash: cashValue })
        if (response.status === 'success') {
          showSuccess(t.userDropdown.shiftEndedSuccess)
          setHasActiveShift(false)
          setShiftDialogOpen(false)
        } else {
          showError(response.message || t.userDropdown.failedToEndShift)
        }
      } else {
        const response = await shiftApi.start({ opening_cash: cashValue })
        if (response.status === 'success') {
          showSuccess(t.userDropdown.shiftStartedSuccess)
          setHasActiveShift(true)
          setShiftDialogOpen(false)
        } else {
          showError(response.message || t.userDropdown.failedToStartShift)
        }
      }
    } catch (error) {
      console.error('Shift toggle error:', error)
      showError(shiftDialogType === 'end' ? t.userDropdown.failedToEndShift : t.userDropdown.failedToStartShift)
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
                    <Typography color='text.primary'>{t.userDropdown.myProfile}</Typography>
                  </MenuItem>
                  {admin?.role !== 'admin' && (
                    <div className='flex items-center plb-2 pli-3'>
                      <Button
                        fullWidth
                        variant='outlined'
                        color={hasActiveShift ? 'warning' : 'success'}
                        size='small'
                        disabled={shiftLoading}
                        endIcon={<i className={hasActiveShift ? 'tabler-clock-stop' : 'tabler-clock-play'} />}
                        onClick={() => openShiftDialog(hasActiveShift ? 'end' : 'start')}
                        sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                      >
                        {shiftLoading 
                          ? (hasActiveShift ? t.userDropdown.ending : t.userDropdown.starting) 
                          : (hasActiveShift ? t.userDropdown.endShift : t.userDropdown.startShift)}
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
                      {t.userDropdown.logout}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>

      {/* Shift Cash Dialog */}
      <Dialog open={shiftDialogOpen} onClose={() => !shiftLoading && setShiftDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>
          {shiftDialogType === 'start' ? t.userDropdown.dialogStartShift : t.userDropdown.dialogEndShift}
        </DialogTitle>
        <DialogContent>
          <TextField
            label={shiftDialogType === 'start' ? t.userDropdown.labelOpeningCash : t.userDropdown.labelClosingCash}
            type='number'
            value={cashInput}
            onChange={e => setCashInput(e.target.value)}
            fullWidth
            autoFocus
            className='mt-2'
            inputProps={{ step: '0.01', min: '0' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShiftDialogOpen(false)} disabled={shiftLoading}>{t.common.cancel}</Button>
          <Button
            variant='contained'
            onClick={handleShiftConfirm}
            disabled={shiftLoading || !cashInput || parseFloat(cashInput) < 0}
          >
            {shiftLoading
              ? (shiftDialogType === 'end' ? t.userDropdown.ending : t.userDropdown.starting)
              : (shiftDialogType === 'start' ? t.userDropdown.startShift : t.userDropdown.endShift)}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UserDropdown
