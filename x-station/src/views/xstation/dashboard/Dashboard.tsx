'use client'

import { useEffect, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

import { analyticsApi, frontDeskApi } from '@/services/api'
import type { FrontDeskDashboard, DashboardAnalytics } from '@/types/xstation'
import { useAuth } from '@/contexts/authContext'
import CustomAvatar from '@core/components/mui/Avatar'

// Components
import DashboardStatsCard from './DashboardStatsCard'
import RoomsOverview from './RoomsOverview'
import ActiveBookingsCard from './ActiveBookingsCard'
import RecentOrdersTable from './RecentOrdersTable'
import LowStockAlert from './LowStockAlert'

interface DashboardProps {
  dictionary: any
}

const Dashboard = ({ dictionary }: DashboardProps) => {
  const { isSuperadmin, admin } = useAuth()
  const [frontDeskData, setFrontDeskData] = useState<FrontDeskDashboard | null>(null)
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Fetch front desk dashboard data
        const frontDeskResponse = await frontDeskApi.getDashboard()
        if (frontDeskResponse.status === 'success') {
          setFrontDeskData(frontDeskResponse.data)
        }
        
        // Fetch analytics if superadmin
        if (isSuperadmin) {
          const analyticsResponse = await analyticsApi.getDashboard()
          if (analyticsResponse.status === 'success') {
            setAnalyticsData(analyticsResponse.data)
          }
        }
      } catch (err) {
        setError(dictionary?.errors?.somethingWentWrong || 'Something went wrong')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isSuperadmin, dictionary])

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  if (error) {
    return (
      <Alert severity='error' className='m-4'>
        {error}
      </Alert>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Welcome Card */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={56}>
              <i className='tabler-device-gamepad-2 text-3xl' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>
                {dictionary?.dashboard?.welcomeMessage || 'Welcome to X-Station'}
                {admin?.name ? `, ${admin.name}` : ''}! 🎮
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Stats Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <DashboardStatsCard
          title={dictionary?.dashboard?.availableRooms || 'Available Rooms'}
          stats={`${frontDeskData?.rooms?.available || 0}/${frontDeskData?.rooms?.total || 0}`}
          avatarIcon='tabler-door'
          avatarColor='success'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <DashboardStatsCard
          title={dictionary?.dashboard?.activeBookings || 'Active Bookings'}
          stats={String(frontDeskData?.active_bookings?.length || 0)}
          avatarIcon='tabler-calendar-event'
          avatarColor='primary'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <DashboardStatsCard
          title={dictionary?.dashboard?.todaysRevenue || "Today's Revenue"}
          stats={`${frontDeskData?.today?.total_revenue?.toFixed(2) || '0.00'} ${dictionary?.common?.currency || 'EGP'}`}
          avatarIcon='tabler-currency-pound'
          avatarColor='warning'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <DashboardStatsCard
          title={dictionary?.dashboard?.lowStockItems || 'Low Stock Items'}
          stats={String(frontDeskData?.stock_alerts?.low_stock_count || 0)}
          avatarIcon='tabler-alert-triangle'
          avatarColor={frontDeskData?.stock_alerts?.low_stock_count ? 'error' : 'secondary'}
        />
      </Grid>

      {/* Superadmin Analytics Cards */}
      {isSuperadmin && analyticsData && (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DashboardStatsCard
              title={dictionary?.dashboard?.totalCustomers || 'Total Customers'}
              stats={String(analyticsData.total_customers || 0)}
              avatarIcon='tabler-users'
              avatarColor='info'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DashboardStatsCard
              title={dictionary?.dashboard?.totalOrders || 'Total Orders'}
              stats={String(analyticsData.total_orders || 0)}
              avatarIcon='tabler-shopping-cart'
              avatarColor='success'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DashboardStatsCard
              title={dictionary?.dashboard?.totalBookings || 'Total Bookings'}
              stats={String(analyticsData.total_bookings || 0)}
              avatarIcon='tabler-calendar'
              avatarColor='primary'
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DashboardStatsCard
              title={dictionary?.dashboard?.totalRevenue || 'Total Revenue'}
              stats={`${((analyticsData.total_order_revenue || 0) + (analyticsData.total_booking_revenue || 0)).toFixed(2)} ${dictionary?.common?.currency || 'EGP'}`}
              avatarIcon='tabler-cash'
              avatarColor='warning'
            />
          </Grid>
        </>
      )}

      {/* Rooms Overview */}
      <Grid size={{ xs: 12, md: 8 }}>
        <RoomsOverview
          rooms={frontDeskData?.rooms?.list || []}
          activeBookings={frontDeskData?.active_bookings || []}
          totalRooms={frontDeskData?.rooms?.total}
          availableCount={frontDeskData?.rooms?.available}
          occupiedCount={frontDeskData?.rooms?.occupied}
          dictionary={dictionary}
        />
      </Grid>

      {/* Low Stock Alert */}
      <Grid size={{ xs: 12, md: 4 }}>
        <LowStockAlert
          items={frontDeskData?.stock_alerts?.items || []}
          dictionary={dictionary}
        />
      </Grid>

      {/* Active Bookings */}
      <Grid size={{ xs: 12, md: 6 }}>
        <ActiveBookingsCard
          bookings={frontDeskData?.active_bookings || []}
          dictionary={dictionary}
        />
      </Grid>

      {/* Today's Summary */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title={dictionary?.frontDesk?.todaySummary || "Today's Summary"} />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-3'>
                  <CustomAvatar variant='rounded' color='primary' skin='light' size={40}>
                    <i className='tabler-calendar-event text-xl' />
                  </CustomAvatar>
                  <div>
                    <Typography variant='body1' fontWeight={500}>
                      {dictionary?.navigation?.bookings || 'Bookings'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.common?.today || 'Today'}
                    </Typography>
                  </div>
                </div>
                <div className='text-end'>
                  <Typography variant='h6'>
                    {frontDeskData?.today?.bookings_count || 0}
                  </Typography>
                  <Typography variant='body2' color='success.main'>
                    {frontDeskData?.today?.bookings_revenue?.toFixed(2) || '0.00'} EGP
                  </Typography>
                </div>
              </div>

              <div className='flex justify-between items-center'>
                <div className='flex items-center gap-3'>
                  <CustomAvatar variant='rounded' color='warning' skin='light' size={40}>
                    <i className='tabler-shopping-cart text-xl' />
                  </CustomAvatar>
                  <div>
                    <Typography variant='body1' fontWeight={500}>
                      {dictionary?.navigation?.orders || 'Orders'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.common?.today || 'Today'}
                    </Typography>
                  </div>
                </div>
                <div className='text-end'>
                  <Typography variant='h6'>
                    {frontDeskData?.today?.orders_count || 0}
                  </Typography>
                  <Typography variant='body2' color='success.main'>
                    {frontDeskData?.today?.orders_revenue?.toFixed(2) || '0.00'} EGP
                  </Typography>
                </div>
              </div>

              <div className='border-t pt-4 mt-2'>
                <div className='flex justify-between items-center'>
                  <Typography variant='h6'>
                    {dictionary?.common?.total || 'Total'} {dictionary?.common?.revenue || 'Revenue'}
                  </Typography>
                  <Chip
                    label={`${frontDeskData?.today?.total_revenue?.toFixed(2) || '0.00'} EGP`}
                    color='success'
                    variant='tonal'
                    size='medium'
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Bookings */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={dictionary?.dashboard?.recentBookings || 'Recent Bookings'} />
          <CardContent>
            {frontDeskData?.recent_bookings && frontDeskData.recent_bookings.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-start p-3'>{dictionary?.bookings?.room || 'Room'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.customer || 'Customer'}</th>
                      <th className='text-start p-3'>{dictionary?.common?.price || 'Price'}</th>
                      <th className='text-start p-3'>{dictionary?.bookings?.endTime || 'End Time'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frontDeskData.recent_bookings.map((booking: any) => (
                      <tr key={booking.id} className='border-b last:border-0'>
                        <td className='p-3'>
                          <Typography variant='body2'>{booking.room_name}</Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>{booking.customer_name}</Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2'>{booking.price} EGP</Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2' color='text.secondary'>
                            {new Date(booking.finished_at).toLocaleTimeString()}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Typography variant='body2' color='text.secondary' className='text-center py-4'>
                {dictionary?.common?.noData || 'No data available'}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default Dashboard
