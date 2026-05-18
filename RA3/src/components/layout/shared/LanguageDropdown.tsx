'use client'

// React Imports
import { useRef, useState } from 'react'

// Next Imports
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'

// Type Imports
import type { Locale } from '@configs/i18n'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

type LanguageDataType = {
  langCode: Locale
  langName: string
}

const COOKIE_NAME = 'NEXT_LOCALE'

const getLocalePath = (pathName: string, locale: string) => {
  if (!pathName) return '/'
  const segments = pathName.split('/')

  segments[1] = locale

  return segments.join('/')
}

const setLanguageCookie = (locale: string) => {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

// Vars
const languageData: LanguageDataType[] = [
  {
    langCode: 'en',
    langName: 'English'
  },
  {
    langCode: 'ar',
    langName: 'العربية'
  }
]

const LanguageDropdown = () => {
  // States
  const [open, setOpen] = useState(false)

  // Refs
  const anchorRef = useRef<HTMLButtonElement>(null)

  // Hooks
  const pathName = usePathname()
  const { settings } = useSettings()
  const { lang } = useParams()

  const handleClose = () => {
    setOpen(false)
  }

  const handleToggle = () => {
    setOpen(prevOpen => !prevOpen)
  }

  const handleLanguageChange = (locale: Locale) => {
    setLanguageCookie(locale)
    handleClose()
  }

  return (
    <>
      <IconButton ref={anchorRef} onClick={handleToggle} className='text-textPrimary'>
        <i className='tabler-language' />
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-start'
        anchorEl={anchorRef.current}
        className='min-is-[160px] !mbs-3 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{ transformOrigin: placement === 'bottom-start' ? 'left top' : 'right top' }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList onKeyDown={handleClose}>
                  {languageData.map(locale => (
                    <MenuItem
                      key={locale.langCode}
                      component={Link}
                      href={getLocalePath(pathName, locale.langCode)}
                      onClick={() => handleLanguageChange(locale.langCode)}
                      selected={lang === locale.langCode}
                    >
                      {locale.langName}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default LanguageDropdown
