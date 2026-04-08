'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputAdornment from '@mui/material/InputAdornment'

import { adminApi } from '@/services/api'
import type { Admin } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@configs/i18n'
import type { Locale } from '@configs/i18n'

interface AdminsListProps {
  dictionary: any
}

const AdminsList = ({ dictionary }: AdminsListProps) => {
  const { admin: currentAdmin } = useAuth()
  const isSuperadmin = currentAdmin?.role === 'superadmin'

  // Get locale for RTL support
  const params = useParams()
  const locale = (params?.lang as Locale) || i18n.defaultLocale
  const isRtl = i18n.langDirection[locale] === 'rtl'

  // Helper function to convert numbers to Arabic numerals
  const toLocalizedNum = (num: number | string) => {
    return isRtl ? num.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]) : num.toString()
  }

  const [admins, setAdmins] = useState<Admin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as 'admin' | 'superadmin',
    is_active: true
  })
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Generate a random secure password
  const generatePassword = (length: number = 12): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*'
    const allChars = uppercase + lowercase + numbers + symbols
    
    let password = ''
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  const handleGeneratePassword = () => {
    const password = generatePassword()
    setFormData({ ...formData, password })
    setShowPassword(true)
  }

  const handleGenerateNewPassword = () => {
    const password = generatePassword()
    setNewPassword(password)
    setShowNewPassword(true)
  }

  const fetchAdmins = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await adminApi.getAll()
      if (response.status === 'success') {
        setAdmins(response.data || [])
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    if (isSuperadmin) {
      fetchAdmins()
    }
  }, [fetchAdmins, isSuperadmin])

  const handleAddAdmin = async () => {
    try {
      setIsSubmitting(true)
      const response = await adminApi.create({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.admins?.adminAdded || 'Admin added successfully')
        setAddDialogOpen(false)
        resetForm()
        fetchAdmins()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditAdmin = async () => {
    if (!selectedAdmin) return

    try {
      setIsSubmitting(true)
      const response = await adminApi.update(selectedAdmin.id, {
        name: formData.name,
        role: formData.role,
        is_active: formData.is_active
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.admins?.adminUpdated || 'Admin updated successfully')
        setEditDialogOpen(false)
        resetForm()
        fetchAdmins()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return

    try {
      setIsSubmitting(true)
      const response = await adminApi.delete(selectedAdmin.id)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.admins?.adminDeleted || 'Admin deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedAdmin(null)
        fetchAdmins()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!selectedAdmin) return

    try {
      setIsSubmitting(true)
      const response = await adminApi.resetPassword(selectedAdmin.id, newPassword)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.admins?.passwordReset || 'Password reset successfully')
        setPasswordDialogOpen(false)
        setSelectedAdmin(null)
        setNewPassword('')
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      is_active: true
    })
    setSelectedAdmin(null)
  }

  const getRoleColor = (role: string) => {
    return role === 'superadmin' ? 'error' : 'primary'
  }

  const getRoleIcon = (role: string) => {
    return role === 'superadmin' ? 'tabler-crown' : 'tabler-user'
  }

  if (!isSuperadmin) {
    return (
      <Card>
        <CardContent>
          <div className='text-center py-12'>
            <i className='tabler-lock text-5xl text-textSecondary mb-3' />
            <Typography color='text.secondary'>
              {dictionary?.errors?.accessDenied || 'Access denied. Superadmin only.'}
            </Typography>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading && admins.length === 0) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6} dir={isRtl ? 'rtl' : 'ltr'}>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='error' onClose={() => setError(null)} variant='filled'>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='success' onClose={() => setSuccessMessage(null)} variant='filled'>
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.admins || 'Admins'}
            subheader={`${toLocalizedNum(admins.length)} ${dictionary?.admins?.totalAdmins || 'administrators'}`}
            action={
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setAddDialogOpen(true)}
              >
                {dictionary?.admins?.addAdmin || 'Add Admin'}
              </Button>
            }
          />
        </Card>
      </Grid>

      {/* Admins Grid */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
          {admins.map(admin => (
            <Card key={admin.id} className='h-full'>
              <CardContent>
                <div className={`flex items-start justify-between mb-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <CustomAvatar
                    color={getRoleColor(admin.role)}
                    skin='light'
                    size={48}
                  >
                    <i className={`${getRoleIcon(admin.role)} text-xl`} />
                  </CustomAvatar>
                  <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Chip
                      label={admin.status === 'active' ? dictionary?.admins?.active || 'Active' : dictionary?.admins?.inactive || 'Inactive'}
                      color={admin.status === 'active' ? 'success' : 'default'}
                      size='small'
                      variant='outlined'
                    />
                  </div>
                </div>

                <Typography variant='h6' className={`mb-1 ${isRtl ? 'text-right' : ''}`}>
                  {admin.name}
                </Typography>
                <Typography variant='body2' color='text.secondary' className={`mb-3 ${isRtl ? 'text-right' : ''}`}>
                  {admin.email}
                </Typography>

                <Chip
                  label={dictionary?.admins?.[admin.role] || admin.role}
                  color={getRoleColor(admin.role)}
                  size='small'
                  className='mb-4'
                />

             
                <div className={`flex gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                  <Tooltip title={dictionary?.common?.edit || 'Edit'}>
                    <IconButton
                      size='small'
                      onClick={() => {
                        setSelectedAdmin(admin)
                        setFormData({
                          name: admin.name,
                          email: admin.email,
                          password: '',
                          role: admin.role,
                          is_active: admin.is_active ?? true
                        })
                        setEditDialogOpen(true)
                      }}
                      disabled={admin.id === currentAdmin?.id}
                    >
                      <i className='tabler-edit' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={dictionary?.admins?.resetPassword || 'Reset Password'}>
                    <IconButton
                      size='small'
                      onClick={() => {
                        setSelectedAdmin(admin)
                        setPasswordDialogOpen(true)
                      }}
                    >
                      <i className='tabler-key' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={dictionary?.common?.delete || 'Delete'}>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => {
                        setSelectedAdmin(admin)
                        setDeleteDialogOpen(true)
                      }}
                      disabled={admin.id === currentAdmin?.id}
                    >
                      <i className='tabler-trash' />
                    </IconButton>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Grid>

      {/* Add Admin Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.admins?.addAdmin || 'Add Admin'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.admins?.adminName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              label={dictionary?.admins?.email || 'Email'}
              type='email'
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              label={dictionary?.admins?.password || 'Password'}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <Tooltip title={showPassword ? (dictionary?.common?.hide || 'Hide') : (dictionary?.common?.show || 'Show')}>
                      <IconButton
                        size='small'
                        onClick={() => setShowPassword(!showPassword)}
                        edge='end'
                      >
                        <i className={showPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={dictionary?.admins?.generatePassword || 'Generate Password'}>
                      <IconButton
                        size='small'
                        onClick={handleGeneratePassword}
                        edge='end'
                        color='primary'
                      >
                        <i className='tabler-key' />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
            <CustomTextField
              select
              label={dictionary?.admins?.role || 'Role'}
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'superadmin' })}
              fullWidth
            >
              <MenuItem value='admin'>{dictionary?.admins?.admin || 'Admin'}</MenuItem>
              <MenuItem value='superadmin'>{dictionary?.admins?.superadmin || 'Superadmin'}</MenuItem>
            </CustomTextField>
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleAddAdmin}
            disabled={isSubmitting || !formData.name || !formData.email || !formData.password}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.add || 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth='sm' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.admins?.editAdmin || 'Edit Admin'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.admins?.adminName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              label={dictionary?.admins?.email || 'Email'}
              type='email'
              value={formData.email}
              fullWidth
              disabled
            />
            <CustomTextField
              select
              label={dictionary?.admins?.role || 'Role'}
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'superadmin' })}
              fullWidth
            >
              <MenuItem value='admin'>{dictionary?.admins?.admin || 'Admin'}</MenuItem>
              <MenuItem value='superadmin'>{dictionary?.admins?.superadmin || 'Superadmin'}</MenuItem>
            </CustomTextField>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label={dictionary?.admins?.active || 'Active'}
            />
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleEditAdmin}
            disabled={isSubmitting || !formData.name}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.save || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth='xs' fullWidth dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.admins?.resetPassword || 'Reset Password'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            {selectedAdmin && (
              <Typography className={isRtl ? 'text-right' : ''}>
                {dictionary?.admins?.resetPasswordFor || 'Reset password for'}: <strong>{selectedAdmin.name}</strong>
              </Typography>
            )}
            <CustomTextField
              label={dictionary?.admins?.newPassword || 'New Password'}
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <Tooltip title={showNewPassword ? (dictionary?.common?.hide || 'Hide') : (dictionary?.common?.show || 'Show')}>
                      <IconButton
                        size='small'
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        edge='end'
                      >
                        <i className={showNewPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={dictionary?.admins?.generatePassword || 'Generate Password'}>
                      <IconButton
                        size='small'
                        onClick={handleGenerateNewPassword}
                        edge='end'
                        color='primary'
                      >
                        <i className='tabler-key' />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
          </div>
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setPasswordDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleResetPassword}
            disabled={isSubmitting || !newPassword}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.admins?.reset || 'Reset'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Admin Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} dir={isRtl ? 'rtl' : 'ltr'}>
        <DialogTitle className={isRtl ? 'text-right' : ''}>{dictionary?.admins?.deleteAdmin || 'Delete Admin'}</DialogTitle>
        <DialogContent>
          <Typography className={isRtl ? 'text-right' : ''}>
            {dictionary?.admins?.confirmDelete || 'Are you sure you want to delete this admin?'}
          </Typography>
          {selectedAdmin && (
            <Typography variant='body2' className={`mt-2 ${isRtl ? 'text-right' : ''}`}>
              <strong>{selectedAdmin.name}</strong> - {selectedAdmin.email}
            </Typography>
          )}
        </DialogContent>
        <DialogActions className={isRtl ? 'flex-row-reverse justify-start' : ''}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDeleteAdmin}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.delete || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default AdminsList
