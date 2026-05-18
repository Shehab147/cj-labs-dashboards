'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// MUI Imports
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'
import type { Locale } from '@/configs/i18n'
import type { getDictionary } from '@/utils/getDictionary'

// Component Imports
import CustomTextField from '@core/components/mui/TextField'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'
import { useAuth } from '@/contexts/authContext'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

type Props = {
  mode: SystemMode
  dictionary: Awaited<ReturnType<typeof getDictionary>>
}

const LoginIllustration = styled('img')(({ theme }) => ({
  zIndex: 2,
  blockSize: 'auto',
  maxBlockSize: 680,
  maxInlineSize: '100%',
  margin: theme.spacing(12),
  [theme.breakpoints.down(1536)]: { maxBlockSize: 550 },
  [theme.breakpoints.down('lg')]: { maxBlockSize: 450 },
}))

const MaskImg = styled('img')({
  blockSize: 'auto',
  maxBlockSize: 355,
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1,
})

type RoleTab = 'admin' | 'engineer'

const Login = ({ mode, dictionary }: Props) => {
  const [roleTab, setRoleTab] = useState<RoleTab>('admin')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const darkImg = '/images/pages/auth-mask-dark.png'
  const lightImg = '/images/pages/auth-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-login-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-login-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-login-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-login-light-border.png'

  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang: locale } = useParams()
  const { settings } = useSettings()
  const { loginAdmin, loginEngineer } = useAuth()
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration,
  )

  const handleTogglePw = () => setIsPasswordShown(s => !s)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage(dictionary.auth.invalidCredentials)

      return
    }

    setErrorMessage(null)
    setIsLoading(true)

    const res =
      roleTab === 'admin'
        ? await loginAdmin(identifier.trim(), password)
        : await loginEngineer(identifier.trim(), password)

    setIsLoading(false)

    if (res.success) {
      const dest =
        searchParams.get('redirectTo') ||
        (roleTab === 'admin' ? '/admin/dashboard' : '/engineer/dashboard')

      router.replace(getLocalizedUrl(dest, locale as Locale))
    } else {
      setErrorMessage(res.message || dictionary.auth.invalidCredentials)
    }
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          { 'border-ie': settings.skin === 'bordered' },
        )}
      >
        <LoginIllustration src={characterIllustration} alt='login-illustration' />
        {!hidden && <MaskImg alt='mask' src={authBackground} />}
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <div className='absolute block-start-5 sm:block-start-[33px] inline-start-6 sm:inline-start-[38px]'>
          <Typography variant='h5' component='span' fontWeight={700}>
            {themeConfig.templateName}
          </Typography>
        </div>
        <div className='flex flex-col gap-6 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-8 sm:mbs-11 md:mbs-0'>
          <div className='flex flex-col gap-1'>
            <Typography variant='h4'>{dictionary.auth.welcomeBack}</Typography>
            <Typography>{dictionary.auth.signInMessage}</Typography>
          </div>

          <Tabs
            value={roleTab}
            onChange={(_, v) => {
              setRoleTab(v)
              setErrorMessage(null)
              setIdentifier('')
              setPassword('')
            }}
            variant='fullWidth'
          >
            <Tab
              value='admin'
              label={dictionary.auth.adminLogin}
              icon={<i className='tabler-shield-lock' />}
              iconPosition='start'
            />
            <Tab
              value='engineer'
              label={dictionary.auth.engineerLogin}
              icon={<i className='tabler-tool' />}
              iconPosition='start'
            />
          </Tabs>

          {errorMessage && (
            <Alert severity='error' onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-6'>
            <CustomTextField
              fullWidth
              autoFocus
              type={roleTab === 'admin' ? 'email' : 'tel'}
              label={roleTab === 'admin' ? dictionary.auth.emailLabel : dictionary.auth.phoneLabel}
              placeholder={
                roleTab === 'admin' ? dictionary.auth.emailPlaceholder : dictionary.auth.phonePlaceholder
              }
              disabled={isLoading}
              value={identifier}
              onChange={e => {
                setIdentifier(e.target.value)
                errorMessage && setErrorMessage(null)
              }}
            />

            <CustomTextField
              fullWidth
              label={dictionary.auth.passwordLabel}
              placeholder={dictionary.auth.passwordPlaceholder}
              id='login-password'
              type={isPasswordShown ? 'text' : 'password'}
              disabled={isLoading}
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                errorMessage && setErrorMessage(null)
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        edge='end'
                        onClick={handleTogglePw}
                        onMouseDown={e => e.preventDefault()}
                        disabled={isLoading}
                      >
                        <i className={isPasswordShown ? 'tabler-eye' : 'tabler-eye-off'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              fullWidth
              variant='contained'
              type='submit'
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} color='inherit' /> : null}
            >
              {isLoading ? dictionary.auth.loggingIn : dictionary.auth.login}
            </Button>
          </form>

          <Typography variant='body2' color='text.secondary' className='text-center mt-4'>
            {dictionary.auth.footerNote}
          </Typography>
        </div>
      </div>
    </div>
  )
}

export default Login
