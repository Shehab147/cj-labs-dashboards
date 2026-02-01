'use client'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'

import type { RoomStatus, ActiveBooking } from '@/types/xstation'

interface RoomsOverviewProps {
  rooms: RoomStatus[]
  activeBookings?: ActiveBooking[]
  totalRooms?: number
  availableCount?: number
  occupiedCount?: number
  dictionary: any
}

const RoomsOverview = ({ rooms, activeBookings = [], totalRooms, availableCount: propAvailableCount, occupiedCount: propOccupiedCount, dictionary }: RoomsOverviewProps) => {
  // Create a map of room_id to active booking for quick lookup
  const bookingsByRoomId = new Map<number | string, ActiveBooking>()
  activeBookings.forEach(booking => {
    const roomId = typeof booking.room_id === 'string' ? parseInt(booking.room_id) : booking.room_id
    bookingsByRoomId.set(roomId, booking)
    bookingsByRoomId.set(String(roomId), booking) // Also store string version for flexible lookup
  })

  // Build complete rooms list by merging rooms with their active bookings
  const completeRooms: RoomStatus[] = rooms.length > 0 
    ? rooms.map(room => {
        const activeBooking = bookingsByRoomId.get(room.id) || bookingsByRoomId.get(String(room.id))
        if (activeBooking) {
          return {
            ...room,
            is_booked: 1,
            current_booking: {
              id: typeof activeBooking.id === 'string' ? parseInt(activeBooking.id) : activeBooking.id,
              customer_name: activeBooking.customer_name,
              started_at: activeBooking.started_at || '',
              elapsed_hours: activeBooking.current_duration_hours || activeBooking.elapsed_hours || 0,
              estimated_price: activeBooking.estimated_price || 0
            }
          }
        }
        // Respect the is_booked value from API (can be string "1"/"0" or number)
        const isBooked = room.is_booked === 1 || room.is_booked === '1' || room.is_booked === true
        return {
          ...room,
          is_booked: isBooked ? 1 : 0
        }
      })
    : // If no rooms list, create room entries from active bookings
      activeBookings.map(booking => ({
        id: typeof booking.room_id === 'string' ? parseInt(booking.room_id) : booking.room_id,
        name: booking.room_name,
        ps: 'PS5',
        hour_cost: booking.hour_cost || '0',
        capacity: 1,
        is_booked: 1,
        current_booking: {
          id: typeof booking.id === 'string' ? parseInt(booking.id) : booking.id,
          customer_name: booking.customer_name,
          started_at: booking.started_at || '',
          elapsed_hours: booking.current_duration_hours || booking.elapsed_hours || 0,
          estimated_price: booking.estimated_price || 0
        }
      }))

  // Use provided counts if available, otherwise calculate from completeRooms
  const availableCount = propAvailableCount ?? completeRooms.filter(room => !room.is_booked).length
  const occupiedCount = propOccupiedCount ?? activeBookings.length
  const total = totalRooms ?? completeRooms.length
  const utilizationRate = total > 0 ? (occupiedCount / total) * 100 : 0

  return (
    <Card className='bs-full'>
      <CardHeader
        title={dictionary?.frontDesk?.roomsOverview || 'Rooms Overview'}
        action={
          <Chip
            label={`${utilizationRate.toFixed(0)}% ${dictionary?.analytics?.utilizationRate || 'Utilization'}`}
            color={utilizationRate > 70 ? 'success' : utilizationRate > 40 ? 'warning' : 'error'}
            variant='tonal'
            size='small'
          />
        }
      />
      <CardContent>
        <div className='flex flex-wrap gap-4'>
          {completeRooms.map(room => (
            <div
              key={room.id}
              className={`flex-1 min-w-[200px] p-4 rounded-lg border ${
                room.is_booked
                  ? 'border-error bg-errorLight'
                  : 'border-success bg-successLight'
              }`}
            >
              <div className='flex items-center justify-between mb-2'>
                <Typography variant='subtitle1' fontWeight={600}>
                  {room.name}
                </Typography>
                <Chip
                  label={room.is_booked ? dictionary?.rooms?.occupied || 'Occupied' : dictionary?.rooms?.available || 'Available'}
                  color={room.is_booked ? 'error' : 'success'}
                  size='small'
                  variant='filled'
                />
              </div>
              <div className='flex items-center gap-2 mb-2'>
                <i className='tabler-device-gamepad text-lg' />
                <Typography variant='body2'>{room.ps}</Typography>
              </div>
              <Typography variant='body2' color='text.secondary'>
                {room.hour_cost} {dictionary?.common?.currency || 'EGP'} / {dictionary?.common?.hour || 'hour'}
              </Typography>
              
              {room.is_booked && room.current_booking && (
                <div className='mt-3 pt-3 border-t border-error'>
                  <Typography variant='body2' fontWeight={500}>
                    {room.current_booking.customer_name}
                  </Typography>
                  <div className='flex justify-between items-center mt-1'>
                    <Typography variant='caption' color='text.secondary'>
                      {room.current_booking.elapsed_hours?.toFixed(1)} {dictionary?.common?.hours || 'hours'}
                    </Typography>
                    <Typography variant='body2' color='error.main' fontWeight={500}>
                      ~{room.current_booking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {completeRooms.length === 0 && (
          <Typography variant='body2' color='text.secondary' className='text-center py-8'>
            {dictionary?.common?.noData || 'No rooms available'}
          </Typography>
        )}

        <div className='mt-6'>
          <div className='flex justify-between mb-2'>
            <Typography variant='body2'>
              {dictionary?.rooms?.available || 'Available'}: {availableCount}
            </Typography>
            <Typography variant='body2'>
              {dictionary?.rooms?.occupied || 'Occupied'}: {occupiedCount}
            </Typography>
          </div>
          <LinearProgress
            variant='determinate'
            value={utilizationRate}
            color={utilizationRate > 70 ? 'success' : utilizationRate > 40 ? 'warning' : 'error'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default RoomsOverview
