'use client'

import { useEffect, useState, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import LinearProgress from '@mui/material/LinearProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import { roomApi, bookingApi } from '@/services/api'
import type { RoomsStatusSummary, RoomStatus } from '@/types/xstation'

interface RoomsStatusProps {
  dictionary: any
}

const RoomsStatus = ({ dictionary }: RoomsStatusProps) => {
  const [data, setData] = useState<RoomsStatusSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [endBookingDialog, setEndBookingDialog] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await roomApi.getStatus()
      if (response.status === 'success') {
        setData(response.data)
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const handleEndBooking = async () => {
    if (!selectedRoom?.current_booking) return
    
    try {
      setIsSubmitting(true)
      const response = await bookingApi.end(selectedRoom.current_booking.id)
      if (response.status === 'success') {
        setSuccessMessage(dictionary?.bookings?.bookingEnded || 'Booking ended successfully')
        setEndBookingDialog(false)
        setSelectedRoom(null)
        fetchStatus()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !data) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  const utilizationRate = data?.summary
    ? (data.summary.occupied / data.summary.total) * 100
    : 0

  return (
    <Grid container spacing={6}>
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

      {/* Summary Card */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <div className='flex flex-wrap items-center justify-between gap-4'>
              <div className='flex items-center gap-6'>
                <div className='flex items-center gap-3'>
                  <div className='w-12 h-12 rounded-lg bg-success flex items-center justify-center'>
                    <i className='tabler-door-enter text-2xl text-white' />
                  </div>
                  <div>
                    <Typography variant='h4'>{data?.summary?.available || 0}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.rooms?.available || 'Available'}
                    </Typography>
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='w-12 h-12 rounded-lg bg-error flex items-center justify-center'>
                    <i className='tabler-door-exit text-2xl text-white' />
                  </div>
                  <div>
                    <Typography variant='h4'>{data?.summary?.occupied || 0}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.rooms?.occupied || 'Occupied'}
                    </Typography>
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-4'>
                <div className='text-end'>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.analytics?.utilizationRate || 'Utilization Rate'}
                  </Typography>
                  <Typography variant='h5'>{utilizationRate.toFixed(0)}%</Typography>
                </div>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-refresh' />}
                  onClick={fetchStatus}
                  disabled={isLoading}
                >
                  {dictionary?.common?.refresh || 'Refresh'}
                </Button>
              </div>
            </div>
            <LinearProgress
              variant='determinate'
              value={utilizationRate}
              color={utilizationRate > 70 ? 'success' : utilizationRate > 40 ? 'warning' : 'error'}
              className='mt-4 h-2'
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Rooms Grid */}
      {data?.rooms?.map(room => (
        <Grid key={room.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Card
            className={`h-full border-2 ${
              Number(room.is_booked) === 1 ? 'border-error' : 'border-success'
            }`}
          >
            <CardHeader
              title={room.name}
              action={
                <Chip
                  label={Number(room.is_booked) === 1 ? dictionary?.rooms?.occupied : dictionary?.rooms?.available}
                  color={Number(room.is_booked) === 1 ? 'error' : 'success'}
                  size='small'
                />
              }
            />
            <CardContent>
              <div className='flex flex-col gap-3'>
                <div className='flex items-center gap-2'>
                  <i className='tabler-device-gamepad text-lg' />
                  <Typography variant='body2'>{room.ps}</Typography>
                </div>
                <div className='flex items-center gap-2'>
                  <i className='tabler-currency-pound text-lg' />
                  <Typography variant='body2'>
                    {room.hour_cost} {dictionary?.common?.currency || 'EGP'} / {dictionary?.common?.hour || 'hour'}
                  </Typography>
                </div>
                <div className='flex items-center gap-2'>
                  <i className='tabler-users text-lg' />
                  <Typography variant='body2'>
                    {dictionary?.rooms?.capacity || 'Capacity'}: {room.capacity}
                  </Typography>
                </div>

                {Number(room.is_booked) === 1 && room.current_booking && (
                  <div className='mt-2 pt-3 border-t'>
                    <Typography variant='subtitle2' fontWeight={600} className='mb-2'>
                      {dictionary?.rooms?.currentBooking || 'Current Booking'}
                    </Typography>
                    <div className='flex flex-col gap-1'>
                      <div className='flex items-center gap-2'>
                        <i className='tabler-user text-sm' />
                        <Typography variant='body2'>
                          {room.current_booking.customer_name}
                        </Typography>
                      </div>
                      <div className='flex items-center gap-2'>
                        <i className='tabler-clock text-sm' />
                        <Typography variant='body2'>
                          {room.current_booking.elapsed_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                        </Typography>
                      </div>
                      <div className='flex items-center gap-2'>
                        <i className='tabler-currency-pound text-sm' />
                        <Typography variant='body2' color='warning.main' fontWeight={500}>
                          ~{room.current_booking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                        </Typography>
                      </div>
                    </div>
                  </div>
                )}

                {Number(room.is_booked) === 0 && (
                  <div className='mt-2 pt-3 border-t'>
                    <div className='flex items-center gap-2 text-success'>
                      <i className='tabler-circle-check text-2xl' />
                      <Typography variant='body2' color='success.main'>
                        {dictionary?.rooms?.available || 'Available'}
                      </Typography>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}

      {/* End Booking Dialog */}
      <Dialog open={endBookingDialog} onClose={() => setEndBookingDialog(false)}>
        <DialogTitle>{dictionary?.bookings?.endBooking || 'End Booking'}</DialogTitle>
        <DialogContent>
          {selectedRoom?.current_booking && (
            <div className='flex flex-col gap-3 pt-2'>
              <Typography>
                {dictionary?.bookings?.confirmEnd || 'Are you sure you want to end this booking?'}
              </Typography>
              <Card variant='outlined'>
                <CardContent>
                  <Typography variant='subtitle2'>
                    {selectedRoom.name} - {selectedRoom.current_booking.customer_name}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {dictionary?.bookings?.duration || 'Duration'}: {selectedRoom.current_booking.elapsed_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                  </Typography>
                  <Typography variant='h6' color='success.main' className='mt-2'>
                    {dictionary?.bookings?.totalPrice || 'Total'}: {selectedRoom.current_booking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndBookingDialog(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleEndBooking}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.bookings?.endBooking || 'End Booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default RoomsStatus
