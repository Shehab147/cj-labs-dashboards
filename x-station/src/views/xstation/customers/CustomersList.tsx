'use client'

import { useEffect, useState, useCallback } from 'react'
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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'

import { customerApi } from '@/services/api'
import type { CustomerWithStats } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { useNotification } from '@/hooks/useNotification'

interface CustomersListProps {
  dictionary: any
}

const CustomersList = ({ dictionary }: CustomersListProps) => {
  const { admin } = useAuth()
  const isSuperadmin = admin?.role === 'superadmin'
  const { successMessage, error, showSuccess, showError, clearSuccess, clearError } = useNotification()

  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  })

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await customerApi.getAll()
      if (response.status === 'success') {
        setCustomers(response.data || [])
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchCustomers()
      return
    }

    try {
      setIsLoading(true)
      const response = await customerApi.search(searchQuery)
      if (response.status === 'success') {
        setCustomers(response.data || [])
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCustomer = async () => {
    try {
      setIsSubmitting(true)
      
      // Check if phone already exists
      const existingCustomer = customers.find(c => c.phone === formData.phone)
      if (existingCustomer) {
        showError(`Phone number already exists for customer: ${existingCustomer.name}`)
        setIsSubmitting(false)
        return
      }
      
      const response = await customerApi.create({
        name: formData.name,
        phone: formData.phone
      })

      if (response.status === 'success') {
        showSuccess(dictionary?.customers?.customerAdded || 'Customer added successfully')
        setAddDialogOpen(false)
        setFormData({ name: '', phone: '' })
        await fetchCustomers()
      } else {
        // Handle duplicate entry error from backend
        if (response.message?.includes('Duplicate entry')) {
          showError(`Phone number ${formData.phone} is already registered to another customer`)
        } else {
          showError(response.message || dictionary?.errors?.somethingWentWrong)
        }
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return

    try {
      setIsSubmitting(true)
      
      // Check if phone is being changed and already exists
      if (formData.phone !== selectedCustomer.phone) {
        const existingCustomer = customers.find(c => c.phone === formData.phone && c.id !== selectedCustomer.id)
        if (existingCustomer) {
          showError(`Phone number already exists for customer: ${existingCustomer.name}`)
          setIsSubmitting(false)
          return
        }
      }
      
      const response = await customerApi.update(selectedCustomer.id, {
        name: formData.name,
        phone: formData.phone
      })

      if (response.status === 'success') {
        showSuccess(dictionary?.customers?.customerUpdated || 'Customer updated successfully')
        setEditDialogOpen(false)
        setSelectedCustomer(null)
        setFormData({ name: '', phone: '' })
        await fetchCustomers()
      } else {
        // Handle duplicate entry error from backend
        if (response.message?.includes('Duplicate entry')) {
          showError(`Phone number ${formData.phone} is already registered to another customer`)
        } else {
          showError(response.message || dictionary?.errors?.somethingWentWrong)
        }
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return

    try {
      setIsSubmitting(true)
      const response = await customerApi.delete(selectedCustomer.id)

      if (response.status === 'success') {
        showSuccess(dictionary?.customers?.customerDeleted || 'Customer deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedCustomer(null)
        await fetchCustomers()
      } else {
        showError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredCustomers = customers

  if (isLoading && customers.length === 0) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6}>
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={clearError}>
            {error}
          </Alert>
        </Grid>
      )}

      {successMessage && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='success' onClose={clearSuccess}>
            {successMessage}
          </Alert>
        </Grid>
      )}

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.customers || 'Customers'}
            subheader={`${customers.length} ${dictionary?.customers?.totalCustomers || 'total customers'}`}
            action={
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setAddDialogOpen(true)}
              >
                {dictionary?.customers?.addCustomer || 'Add Customer'}
              </Button>
            }
          />
          <CardContent>
            <div className='flex flex-wrap gap-4 items-end'>
              <CustomTextField
                label={dictionary?.common?.search || 'Search'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={dictionary?.customers?.searchPlaceholder || 'Name or phone...'}
                size='small'
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i className='tabler-search' />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        onClick={() => {
                          setSearchQuery('')
                          fetchCustomers()
                        }}
                      >
                        <i className='tabler-x' />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Button variant='outlined' onClick={handleSearch} disabled={isLoading}>
                {dictionary?.common?.search || 'Search'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Customers Grid */}
      <Grid size={{ xs: 12 }}>
        {filteredCustomers.length > 0 ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
            {filteredCustomers.map(customer => (
              <Card key={customer.id} className='h-full'>
                <CardContent>
                  <div className='flex items-start justify-between mb-4'>
                    <CustomAvatar
                      color='primary'
                      skin='light'
                      size={48}
                    >
                      <i className='tabler-user text-xl' />
                    </CustomAvatar>
                  </div>

                  <Typography variant='h6' className='mb-1'>
                    {customer.name}
                  </Typography>
                  <Typography variant='body2' color='text.secondary' className='mb-3'>
                    {customer.phone}
                  </Typography>

                  <div className='grid grid-cols-2 gap-2 mb-4'>
                    <div className='p-2 rounded bg-actionHover'>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.customers?.totalSpent || 'Spent'}
                      </Typography>
                      <Typography variant='body2' fontWeight={600}>
                        {customer.total_spent?.toFixed(0)} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                    <div className='p-2 rounded bg-actionHover'>
                      <Typography variant='caption' color='text.secondary'>
                        {dictionary?.customers?.totalBookings || 'Bookings'}
                      </Typography>
                      <Typography variant='body2' fontWeight={600}>
                        {customer.total_bookings}
                      </Typography>
                    </div>
                  </div>

                  <div className='flex gap-2'>
                    <Tooltip title={dictionary?.common?.view || 'View'}>
                      <IconButton
                        size='small'
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setViewDialogOpen(true)
                        }}
                      >
                        <i className='tabler-eye' />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={dictionary?.common?.edit || 'Edit'}>
                      <IconButton
                        size='small'
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setFormData({
                            name: customer.name,
                            phone: customer.phone
                                                    })
                          setEditDialogOpen(true)
                        }}
                      >
                        <i className='tabler-edit' />
                      </IconButton>
                    </Tooltip>
                    {isSuperadmin && (
                      <Tooltip title={dictionary?.common?.delete || 'Delete'}>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <i className='tabler-trash' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent>
              <div className='text-center py-12'>
                <i className='tabler-users-group text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.customers?.noCustomers || 'No customers found'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </Grid>

      {/* Add Customer Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.customers?.addCustomer || 'Add Customer'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.customers?.customerName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              label={dictionary?.customers?.phoneNumber || 'Phone'}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              required
              placeholder='+201234567890'
            />
          
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleAddCustomer}
            disabled={isSubmitting || !formData.name || !formData.phone}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.add || 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.customers?.editCustomer || 'Edit Customer'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.customers?.customerName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              label={dictionary?.customers?.phoneNumber || 'Phone'}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
              required
            />
          
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleEditCustomer}
            disabled={isSubmitting || !formData.name || !formData.phone}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.save || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Customer Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary?.customers?.customerDetails || 'Customer Details'}</DialogTitle>
        <DialogContent>
          {selectedCustomer && (
            <div className='flex flex-col gap-4 pt-2'>
              <div className='flex items-center gap-4'>
                <CustomAvatar
                  color='primary'
                  skin='light'
                  size={64}
                >
                  <i className='tabler-user text-2xl' />
                </CustomAvatar>
                <div>
                  <Typography variant='h5'>{selectedCustomer.name}</Typography>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary?.customers?.phoneNumber || 'Phone'}
                  </Typography>
                  <Typography variant='body1'>{selectedCustomer.phone}</Typography>
                </div>
            
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary?.customers?.totalSpent || 'Total Spent'}
                  </Typography>
                  <Typography variant='body1' color='success.main' fontWeight={600}>
                    {selectedCustomer.total_spent ? selectedCustomer.total_spent.toFixed(2) : '0.00'} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary?.customers?.totalBookings || 'Total Bookings'}
                  </Typography>
                  <Typography variant='body1'>{selectedCustomer.total_bookings || 0}</Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary?.customers?.totalHours || 'Total Hours'}
                  </Typography>
                  <Typography variant='body1'>{selectedCustomer.total_hours ? selectedCustomer.total_hours.toFixed(1) : '0.0'}h</Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary?.common?.createdAt || 'Member Since'}
                  </Typography>
                  <Typography variant='body1'>
                    {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString() : '-'}
                  </Typography>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            {dictionary?.common?.close || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Customer Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{dictionary?.customers?.deleteCustomer || 'Delete Customer'}</DialogTitle>
        <DialogContent>
          <Typography>
            {dictionary?.customers?.confirmDelete || 'Are you sure you want to delete this customer?'}
          </Typography>
          {selectedCustomer && (
            <Typography variant='body2' className='mt-2'>
              <strong>{selectedCustomer.name}</strong> - {selectedCustomer.phone}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDeleteCustomer}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.delete || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default CustomersList
