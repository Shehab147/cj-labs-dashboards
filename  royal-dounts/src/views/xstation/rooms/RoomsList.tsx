'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

import { roomApi } from '@/services/api'
import type { Room } from '@/types/xstation'
import { useAuth } from '@/contexts/authContext'
import CustomTextField from '@core/components/mui/TextField'
import { useNotification } from '@/hooks/useNotification'

interface RoomsListProps {
  dictionary: any
}

const RoomsList = ({ dictionary }: RoomsListProps) => {
  const { isSuperadmin } = useAuth()
  const { successMessage, error, showSuccess, showError, clearSuccess, clearError } = useNotification()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    ps: 'PS5',
    hour_cost: '',
    multi_hour_cost: '',
    capacity: ''
  })

  const consoleOptions = ['PS4', 'PS5', 'Xbox', 'PC']

  const fetchRooms = async () => {
    try {
      setIsLoading(true)
      const response = await roomApi.list()
      if (response.status === 'success') {
        // Convert is_booked string to boolean
        const roomsData = (response.data || []).map((room: Room) => ({
          ...room,
          is_booked: room.is_booked === '1' || room.is_booked === 1 || room.is_booked === true
        }))
        setRooms(roomsData)
      } else {
        showError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  const handleOpenDialog = (room?: Room) => {
    if (room) {
      setSelectedRoom(room)
      setFormData({
        name: room.name,
        ps: room.ps,
        hour_cost: String(room.hour_cost),
        multi_hour_cost: String(room.multi_hour_cost || ''),
        capacity: String(room.capacity)
      })
    } else {
      setSelectedRoom(null)
      setFormData({
        name: '',
        ps: 'PS5',
        hour_cost: '',
        multi_hour_cost: '',
        capacity: ''
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedRoom(null)
    setFormData({
      name: '',
      ps: 'PS5',
      hour_cost: '',
      multi_hour_cost: '',
      capacity: ''
    })
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)

      const data = {
        name: formData.name,
        ps: formData.ps,
        hour_cost: parseFloat(formData.hour_cost),
        multi_hour_cost: parseFloat(formData.multi_hour_cost || '0'),
        capacity: parseInt(formData.capacity)
      }

      let response
      if (selectedRoom) {
        response = await roomApi.update({ id: selectedRoom.id, ...data })
      } else {
        response = await roomApi.add(data)
      }

      if (response.status === 'success') {
        showSuccess(
          selectedRoom
            ? dictionary?.rooms?.roomUpdated || 'Room updated successfully'
            : dictionary?.rooms?.roomAdded || 'Room added successfully'
        )
        handleCloseDialog()
        // Silent refresh data
        await fetchRooms()
      } else {
        showError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedRoom) return
    
    try {
      setIsSubmitting(true)
      const response = await roomApi.delete(selectedRoom.id)
      if (response.status === 'success') {
        showSuccess(dictionary?.rooms?.roomDeleted || 'Room deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedRoom(null)
        // Silent refresh data
        await fetchRooms()
      } else {
        showError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      showError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6}>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={clearError}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='error' onClose={clearError} variant='filled'>
          {error}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={clearSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity='success' onClose={clearSuccess} variant='filled'>
          {successMessage}
        </Alert>
      </Snackbar>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.rooms?.title || 'Rooms'}
            action={
              isSuperadmin && (
                <Button
                  variant='contained'
                  startIcon={<i className='tabler-plus' />}
                  onClick={() => handleOpenDialog()}
                >
                  {dictionary?.rooms?.addRoom || 'Add Room'}
                </Button>
              )
            }
          />
          <CardContent>
            <TableContainer component={Paper} variant='outlined'>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{dictionary?.rooms?.roomName || 'Room Name'}</TableCell>
                    <TableCell>{dictionary?.rooms?.console || 'Console'}</TableCell>
                    <TableCell>{dictionary?.rooms?.hourlyRate || 'Hourly Rate'}</TableCell>
                    <TableCell>{dictionary?.rooms?.multiHourRate || 'Multi-Hour Rate'}</TableCell>
                    <TableCell>{dictionary?.rooms?.capacity || 'Capacity'}</TableCell>
                    <TableCell>{dictionary?.rooms?.status || 'Status'}</TableCell>
                    {isSuperadmin && <TableCell>{dictionary?.common?.actions || 'Actions'}</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rooms.length > 0 ? (
                    rooms.map(room => (
                      <TableRow key={room.id}>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <i className='tabler-door text-lg' />
                            <Typography variant='body2' fontWeight={500}>
                              {room.name}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip label={room.ps} variant='outlined' size='small' />
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{room.hour_cost} {dictionary?.common?.currency || 'EGP'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{room.multi_hour_cost || 0} {dictionary?.common?.currency || 'EGP'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{room.capacity}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={!room.is_booked ? dictionary?.rooms?.available : dictionary?.rooms?.occupied}
                            color={!room.is_booked ? 'success' : 'error'}
                            variant='tonal'
                            size='small'
                          />
                        </TableCell>
                        {isSuperadmin && (
                          <TableCell>
                            <div className='flex items-center gap-1'>
                              <IconButton
                                size='small'
                                onClick={() => handleOpenDialog(room)}
                                title={dictionary?.common?.edit}
                              >
                                <i className='tabler-edit text-lg' />
                              </IconButton>
                              <IconButton
                                size='small'
                                color='error'
                                onClick={() => {
                                  setSelectedRoom(room)
                                  setDeleteDialogOpen(true)
                                }}
                                title={dictionary?.common?.delete}
                              >
                                <i className='tabler-trash text-lg' />
                              </IconButton>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className='text-center py-8'>
                        <Typography color='text.secondary'>
                          {dictionary?.common?.noData || 'No data available'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth='sm' fullWidth>
        <DialogTitle>
          {selectedRoom ? dictionary?.rooms?.editRoom : dictionary?.rooms?.addRoom}
        </DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.rooms?.roomName || 'Room Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <CustomTextField
              select
              label={dictionary?.rooms?.console || 'Console'}
              value={formData.ps}
              onChange={e => setFormData({ ...formData, ps: e.target.value })}
              fullWidth
            >
              {consoleOptions.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </CustomTextField>
            <CustomTextField
              label={`${dictionary?.rooms?.hourlyRate || 'Hourly Rate'} (${dictionary?.common?.currency || 'EGP'})`}
              value={formData.hour_cost}
              onChange={e => setFormData({ ...formData, hour_cost: e.target.value })}
              type='number'
              fullWidth
              required
            />
            <CustomTextField
              label={`${dictionary?.rooms?.multiHourRate || 'Multi-Hour Rate'} (${dictionary?.common?.currency || 'EGP'})`}
              value={formData.multi_hour_cost}
              onChange={e => setFormData({ ...formData, multi_hour_cost: e.target.value })}
              type='number'
              fullWidth
              placeholder='0'
            />
            <CustomTextField
              label={dictionary?.rooms?.capacity || 'Capacity'}
              value={formData.capacity}
              onChange={e => setFormData({ ...formData, capacity: e.target.value })}
              type='number'
              fullWidth
              required
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name || !formData.hour_cost || !formData.capacity}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.save || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{dictionary?.rooms?.deleteRoom || 'Delete Room'}</DialogTitle>
        <DialogContent>
          <Typography>
            {dictionary?.rooms?.confirmDelete || 'Are you sure you want to delete this room?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.delete || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default RoomsList
