'use client'

import { useRouter, useParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import type { ActiveBooking } from '@/types/xstation'
import type { Locale } from '@/configs/i18n'
import { getLocalizedUrl } from '@/utils/i18n'

interface ActiveBookingsCardProps {
  bookings: ActiveBooking[]
  dictionary: any
}

const ActiveBookingsCard = ({ bookings, dictionary }: ActiveBookingsCardProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'en'

  return (
    <Card className='bs-full'>
      <CardHeader
        title={dictionary?.dashboard?.activeBookings || 'Active Bookings'}
        action={
          <Button
            variant='outlined'
            size='small'
            onClick={() => router.push(getLocalizedUrl('/bookings', locale))}
          >
            {dictionary?.common?.view || 'View'} {dictionary?.common?.all || 'All'}
          </Button>
        }
      />
      <CardContent>
        <div className='flex flex-col gap-4'>
          {bookings.length > 0 ? (
            bookings.slice(0, 5).map(booking => (
              <div
                key={booking.id}
                className='flex items-center justify-between p-3 rounded-lg border hover:bg-actionHover transition-colors'
              >
                <div className='flex items-center gap-3'>
                  <div className='flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white'>
                    <i className='tabler-door text-xl' />
                  </div>
                  <div>
                    <Typography variant='subtitle2' fontWeight={600}>
                      {booking.room_name}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {booking.customer_name}
                    </Typography>
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='text-end'>
                    <Typography variant='body2' fontWeight={500}>
                      {(booking.current_duration_hours ?? booking.elapsed_hours)?.toFixed(1)} {dictionary?.common?.hours || 'hrs'}
                    </Typography>
                    <Typography variant='caption' color='success.main'>
                      ~{booking.estimated_price?.toFixed(2)} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                  <Chip
                    label={dictionary?.bookings?.inProgress || 'In Progress'}
                    color='warning'
                    variant='tonal'
                    size='small'
                  />
                </div>
              </div>
            ))
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <i className='tabler-calendar-off text-5xl text-textSecondary mb-3' />
              <Typography variant='body1' color='text.secondary'>
                {dictionary?.bookings?.noActiveBooking || 'No active bookings'}
              </Typography>
              <Button
                variant='contained'
                size='small'
                className='mt-4'
                onClick={() => router.push(getLocalizedUrl('/front-desk', locale))}
              >
                {dictionary?.bookings?.startBooking || 'Start Booking'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ActiveBookingsCard
