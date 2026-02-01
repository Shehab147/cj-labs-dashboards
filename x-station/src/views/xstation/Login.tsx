'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { email, object, minLength, string, pipe, nonEmpty } from 'valibot'
import type { SubmitHandler } from 'react-hook-form'
import type { InferInput } from 'valibot'
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'
import type { Locale } from '@/configs/i18n'

// Component Imports
import CustomTextField from '@core/components/mui/TextField'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Auth Imports
import { useAuth } from '@/contexts/authContext'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Styled Components
const LoginIllustration = styled('img')(({ theme }) => ({
  zIndex: 2,
  blockSize: 'auto',
  maxBlockSize: 680,
  maxInlineSize: '100%',
  margin: theme.spacing(12),
  [theme.breakpoints.down(1536)]: {
    maxBlockSize: 550
  },
  [theme.breakpoints.down('lg')]: {
    maxBlockSize: 450
  }
}))

const MaskImg = styled('img')({
  blockSize: 'auto',
  maxBlockSize: 355,
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1
})

type FormData = InferInput<typeof schema>

const schema = object({
  email: pipe(string(), minLength(1, 'This field is required'), email('Email is invalid')),
  password: pipe(
    string(),
    nonEmpty('This field is required'),
    minLength(5, 'Password must be at least 5 characters long')
  )
})

interface LoginProps {
  mode: SystemMode
  dictionary: any
}

const XStationLogin = ({ mode, dictionary }: LoginProps) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-mask-dark.png'
  const lightImg = '/images/pages/auth-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/v2-login-dark.png'
  const lightIllustration = '/images/illustrations/auth/v2-login-light.png'
  const borderedDarkIllustration = '/images/illustrations/auth/v2-login-dark-border.png'
  const borderedLightIllustration = '/images/illustrations/auth/v2-login-light-border.png'

  // Hooks
  const router = useRouter()
  const { lang: locale } = useParams()
  const { settings } = useSettings()
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const { login } = useAuth()

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  const onSubmit: SubmitHandler<FormData> = async (data: FormData) => {
    setIsLoading(true)
    setErrorMessage(null)
    
    const result = await login(data.email, data.password)
    
    if (result.success) {
      router.push(getLocalizedUrl('/dashboard', locale as Locale))
    } else {
      setErrorMessage(result.message || dictionary?.auth?.invalidCredentials || 'Login failed')
      setIsLoading(false)
    }
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          {
            'border-ie': settings.skin === 'bordered'
          }
        )}
      >
        <LoginIllustration src={characterIllustration} alt='character-illustration' />
        {!hidden && <MaskImg alt='mask' src={authBackground} />}
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <Card className='flex flex-col sm:is-[400px] md:is-[unset] mbs-8 sm:mbs-11 md:mbs-0'>
          <CardContent className='p-6 sm:p-8'>
            <div className='flex flex-col gap-1 mbe-6'>
              <div className='flex items-center gap-3 mbe-2'>
                <img 
                  src='/xstation.jpeg' 
                  alt='X-Station Logo' 
                  width={48} 
                  height={48} 
                  className='rounded'
                  style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                />
                <Typography variant='h4' className='font-bold text-primary'>
                  {themeConfig.templateName}
                </Typography>
              </div>
              <Typography variant='h5' className='font-semibold'>
                {dictionary?.auth?.welcomeBack || 'Welcome Back!'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {dictionary?.auth?.signInMessage || 'Sign in to your X-Station account'}
              </Typography>
            </div>

            {errorMessage && (
              <Alert severity='error' className='mbe-4' onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            )}

            <form
              noValidate
              autoComplete='off'
              onSubmit={handleSubmit(onSubmit)}
              className='flex flex-col gap-6'
            >
              <Controller
                name='email'
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <CustomTextField
                    {...field}
                    autoFocus
                    fullWidth
                    type='email'
                    label={dictionary?.common?.email || 'Email'}
                    placeholder={dictionary?.auth?.emailPlaceholder || 'Enter your email'}
                    onChange={e => {
                      field.onChange(e.target.value)
                      errorMessage !== null && setErrorMessage(null)
                    }}
                    {...(errors.email && {
                      error: true,
                      helperText: errors?.email?.message
                    })}
                  />
                )}
              />
              <Controller
                name='password'
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <CustomTextField
                    {...field}
                    fullWidth
                    label={dictionary?.common?.password || 'Password'}
                    placeholder={dictionary?.auth?.passwordPlaceholder || 'Enter your password'}
                    id='login-password'
                    type={isPasswordShown ? 'text' : 'password'}
                    onChange={e => {
                      field.onChange(e.target.value)
                      errorMessage !== null && setErrorMessage(null)
                    }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton
                              edge='end'
                              onClick={handleClickShowPassword}
                              onMouseDown={e => e.preventDefault()}
                            >
                              <i className={isPasswordShown ? 'tabler-eye' : 'tabler-eye-off'} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }
                    }}
                    {...(errors.password && { error: true, helperText: errors.password.message })}
                  />
                )}
              />
              <Button
                fullWidth
                variant='contained'
                type='submit'
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color='inherit' /> : null}
              >
                {isLoading
                  ? dictionary?.auth?.loggingIn || 'Logging in...'
                  : dictionary?.auth?.login || 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default XStationLogin
