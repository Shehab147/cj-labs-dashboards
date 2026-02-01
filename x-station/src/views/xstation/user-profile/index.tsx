'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'

// Service Imports
import { authApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'

interface UserProfilePageProps {
  dictionary: any
}

const UserProfilePage = ({ dictionary }: UserProfilePageProps) => {
  const { admin, isLoading: authLoading } = useAuth()
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const handleUpdatePassword = async () => {
    try {
      setUpdating(true)
      setMessage(null)

      if (!formData.currentPassword || !formData.newPassword) {
        setMessage({ type: 'error', text: dictionary?.settings?.fillAllFields || 'Please fill in all password fields' })
        setUpdating(false)
        return
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setMessage({ type: 'error', text: dictionary?.settings?.passwordMismatch || 'New passwords do not match' })
        setUpdating(false)
        return
      }

      if (formData.newPassword.length < 6) {
        setMessage({ type: 'error', text: dictionary?.settings?.passwordMinLength || 'Password must be at least 6 characters' })
        setUpdating(false)
        return
      }

      const response = await authApi.updatePassword(formData.currentPassword, formData.newPassword)

      if (response.status === 'success') {
        setMessage({ type: 'success', text: dictionary?.settings?.passwordUpdated || 'Password updated successfully' })
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        setMessage({ type: 'error', text: response.message || dictionary?.errors?.somethingWentWrong || 'Failed to update password' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: dictionary?.errors?.networkError || 'An error occurred while updating password' })
    } finally {
      setUpdating(false)
    }
  }

  if (authLoading) {
    return (
      <Box className='flex items-center justify-center' sx={{ minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!admin) {
    return (
      <Box className='flex items-center justify-center' sx={{ minHeight: '400px' }}>
        <Alert severity='error'>{dictionary?.errors?.noAdminData || 'No admin data found. Please log in again.'}</Alert>
      </Box>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Profile Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent sx={{ p: 6 }}>
            <Box className='flex flex-col sm:flex-row items-center gap-6'>
              <Avatar sx={{ width: 120, height: 120, fontSize: '3rem', bgcolor: 'primary.main' }}>
                {admin?.name?.charAt(0).toUpperCase() || 'A'}
              </Avatar>
              <Box className='text-center sm:text-left flex-1'>
                <Typography variant='h4' sx={{ mb: 1 }}>
                  {admin?.name || dictionary?.settings?.adminUser || 'Admin User'}
                </Typography>
                <Typography color='text.secondary' sx={{ mb: 2 }}>
                  {admin?.email || dictionary?.settings?.noEmail || 'No email provided'}
                </Typography>
                <Chip 
                  label={admin?.role?.toUpperCase() || 'ADMIN'} 
                  color='primary' 
                  size='medium'
                />
                {admin?.status && (
                  <Chip 
                    label={admin.status === 'active' ? (dictionary?.admins?.active || 'ACTIVE') : (dictionary?.admins?.inactive || 'INACTIVE')} 
                    color={admin.status === 'active' ? 'success' : 'default'} 
                    size='medium'
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {message && (
        <Grid size={{ xs: 12 }}>
          <Alert severity={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </Grid>
      )}

      {/* Profile Information (Read Only) */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ p: 6, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant='h5' sx={{ mb: 1 }}>
              {dictionary?.settings?.profileInformation || 'Profile Information'}
            </Typography>
            <Typography color='text.secondary' sx={{ mb: 3 }}>
              {dictionary?.settings?.accountDetails || 'Your account details'}
            </Typography>
            <Divider sx={{ mb: 4 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.5 }}>
                  {dictionary?.settings?.fullName || 'Full Name'}
                </Typography>
                <Typography variant='body1' sx={{ fontWeight: 500 }}>
                  {admin?.name || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.5 }}>
                  {dictionary?.settings?.emailAddress || 'Email Address'}
                </Typography>
                <Typography variant='body1' sx={{ fontWeight: 500 }}>
                  {admin?.email || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.5 }}>
                  {dictionary?.common?.role || 'Role'}
                </Typography>
                <Typography variant='body1' sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                  {admin?.role || 'N/A'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 0.5 }}>
                  {dictionary?.common?.status || 'Status'}
                </Typography>
                <Chip 
                  label={admin?.status === 'active' ? (dictionary?.admins?.active || 'ACTIVE') : (dictionary?.admins?.inactive || 'INACTIVE')} 
                  color={admin?.status === 'active' ? 'success' : 'default'} 
                  size='small'
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Change Password */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ height: '100%', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ p: 6, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant='h5' sx={{ mb: 1 }}>
              {dictionary?.settings?.changePassword || 'Change Password'}
            </Typography>
            <Typography color='text.secondary' sx={{ mb: 3 }}>
              {dictionary?.settings?.updatePasswordDescription || 'Update your password to keep your account secure'}
            </Typography>
            <Divider sx={{ mb: 4 }} />
            
            <Box component='form' sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <TextField
                fullWidth
                label={dictionary?.settings?.currentPassword || 'Current Password'}
                type='password'
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                disabled={updating}
              />
              <TextField
                fullWidth
                label={dictionary?.settings?.newPassword || 'New Password'}
                type='password'
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                disabled={updating}
              />
              <TextField
                fullWidth
                label={dictionary?.settings?.confirmPassword || 'Confirm New Password'}
                type='password'
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={updating}
              />
              <Box sx={{ mt: 'auto' }}>
                <Button
                  variant='contained'
                  color='primary'
                  onClick={handleUpdatePassword}
                  disabled={updating}
                  size='large'
                >
                  {updating ? (dictionary?.common?.loading || 'Updating...') : (dictionary?.settings?.changePassword || 'Change Password')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default UserProfilePage
