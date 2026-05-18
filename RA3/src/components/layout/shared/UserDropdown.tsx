'use client'

// React Imports
import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

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
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

// Context Imports
import { useAuth } from '@/contexts/authContext'

// Dictionary
import { useDictionary } from '@/contexts/dictionaryContext'

const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)',
})

const UserDropdown = () => {
  const t = useDictionary()

  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const { settings } = useSettings()
  const { admin, engineer, role, logout } = useAuth()

  const userName = admin?.name || engineer?.full_name || ''
  const userSubtitle = admin?.email || engineer?.phone || ''
  const roleLabel =
    role === 'admin'
      ? admin?.role === 'super_admin'
        ? t.admins.roleSuperAdmin
        : t.admins.roleAdmin
      : role === 'engineer'
        ? t.navigation.engineers
        : ''

  const handleDropdownOpen = () => setOpen(prev => !prev)

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent)) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (e) {
      console.error('logout error', e)
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
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        >
          {userName?.charAt(0) || '?'}
        </Avatar>
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
            style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-6 gap-2' tabIndex={-1}>
                    <Avatar alt={userName}>{userName?.charAt(0) || '?'}</Avatar>
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {userName}
                      </Typography>
                      <Typography variant='caption'>{userSubtitle}</Typography>
                      {roleLabel && (
                        <Chip
                          label={roleLabel}
                          size='small'
                          color={role === 'admin' ? 'primary' : 'success'}
                          className='mt-1'
                        />
                      )}
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  <div className='flex items-center plb-2 pli-3'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      endIcon={<i className='tabler-logout' />}
                      onClick={handleLogout}
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
    </>
  )
}

export default UserDropdown
