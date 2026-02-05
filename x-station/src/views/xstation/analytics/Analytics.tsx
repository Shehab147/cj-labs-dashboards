'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import MenuItem from '@mui/material/MenuItem'
import LinearProgress from '@mui/material/LinearProgress'
import TablePagination from '@mui/material/TablePagination'

import { analyticsApi } from '@/services/api'
import type { AnalyticsDashboard, RevenueAnalytics, RoomAnalytics, CafeteriaAnalytics, CustomerAnalytics, StaffAnalytics } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@/configs/i18n'
import { formatLocalDate, getLocaleForRtl, dateFormats } from '@/utils/timezone'

interface AnalyticsProps {
  dictionary: any
}

const Analytics = ({ dictionary }: AnalyticsProps) => {
  const { admin } = useAuth()
  const isSuperadmin = admin?.role === 'superadmin'
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const isRtl = i18n.langDirection[lang as keyof typeof i18n.langDirection] === 'rtl'

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNum = (num: number | string) => {
    if (!isRtl) return String(num)
    const arabicNumerals = '٠١٢٣٤٥٦٧٨٩'
    return String(num).replace(/[0-9]/g, d => arabicNumerals[parseInt(d)])
  }

  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null)
  const [roomData, setRoomData] = useState<RoomAnalytics | null>(null)
  const [cafeteriaData, setCafeteriaData] = useState<CafeteriaAnalytics | null>(null)
  const [customerData, setCustomerData] = useState<CustomerAnalytics | null>(null)
  const [staffData, setStaffData] = useState<StaffAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Period filter
  const [period, setPeriod] = useState('month')

  // Pagination states
  const [cafeteriaPage, setCafeteriaPage] = useState(0)
  const [dailyPage, setDailyPage] = useState(0)
  const [hourlyPage, setHourlyPage] = useState(0)
  const [dayOfWeekPage, setDayOfWeekPage] = useState(0)
  const rowsPerPage = 5

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [dashboardRes, revenueRes, roomRes, cafeteriaRes, customerRes, staffRes] = await Promise.all([
        analyticsApi.getDashboard(),
        analyticsApi.getRevenue(period),
        analyticsApi.getRooms(period),
        analyticsApi.getCafeteria(period),
        analyticsApi.getCustomers(period),
        analyticsApi.getStaff(period)
      ])

      if (dashboardRes.status === 'success') setDashboard(dashboardRes.data)
      if (revenueRes.status === 'success') setRevenueData(revenueRes.data)
      if (roomRes.status === 'success') {
        // The API already wraps data in {status: 'success', data: {...}}
        // So roomRes.data contains the actual analytics data
        setRoomData(roomRes.data)
      }
      if (cafeteriaRes.status === 'success') setCafeteriaData(cafeteriaRes.data)
      if (customerRes.status === 'success') setCustomerData(customerRes.data)
      if (staffRes.status === 'success') setStaffData(staffRes.data)
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary, period])

  useEffect(() => {
    if (isSuperadmin) {
      fetchData()
    }
  }, [fetchData, isSuperadmin])

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

  if (isLoading) {
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

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.analytics || 'Analytics'}
            action={
              <CustomTextField
                select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                size='small'
                className='min-w-[150px]'
              >
                <MenuItem value='today'>{dictionary?.common?.today || 'Today'}</MenuItem>
                <MenuItem value='week'>{dictionary?.common?.thisWeek || 'This Week'}</MenuItem>
                <MenuItem value='month'>{dictionary?.common?.thisMonth || 'This Month'}</MenuItem>
                <MenuItem value='year'>{dictionary?.common?.thisYear || 'This Year'}</MenuItem>
              </CustomTextField>
            }
          />
        </Card>
      </Grid>

      {/* Overview Stats */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                <i className='tabler-currency-dollar text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum((revenueData?.summary?.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.analytics?.totalRevenue || 'Total Revenue'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                <i className='tabler-calendar-check text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(roomData?.summary?.total_bookings || dashboard?.total_bookings || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.analytics?.totalBookings || 'Total Bookings'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
                <i className='tabler-shopping-cart text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(dashboard?.total_orders || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.analytics?.totalOrders || 'Total Orders'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                <i className='tabler-users text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(customerData?.summary?.total_customers || dashboard?.total_customers || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.analytics?.totalCustomers || 'Total Customers'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Revenue Breakdown */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card className='h-full'>
          <CardHeader title={dictionary?.analytics?.revenueBreakdown || 'Revenue Breakdown'} />
          <CardContent>
            {revenueData ? (
              <div className='flex flex-col gap-4'>
                <div className={`flex justify-between items-center p-4 rounded-lg bg-primaryLight ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <CustomAvatar variant='rounded' color='primary' size={40}>
                      <i className='tabler-door text-xl' />
                    </CustomAvatar>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='body2' fontWeight={500}>
                        {dictionary?.analytics?.bookingsRevenue || 'Bookings'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {toLocalizedNum(revenueData.summary?.booking_count || 0)} {dictionary?.navigation?.bookings}
                      </Typography>
                    </div>
                  </div>
                  <Typography variant='h6' color='success.main'>
                    {toLocalizedNum((revenueData.summary?.booking_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </div>
                <div className={`flex justify-between items-center p-4 rounded-lg bg-warningLight ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <CustomAvatar variant='rounded' color='warning' size={40}>
                      <i className='tabler-coffee text-xl' />
                    </CustomAvatar>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='body2' fontWeight={500}>
                        {dictionary?.analytics?.cafeteriaRevenue || 'Cafeteria'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {toLocalizedNum(revenueData.summary?.order_count || 0)} {dictionary?.navigation?.orders}
                      </Typography>
                    </div>
                  </div>
                  <Typography variant='h6' color='success.main'>
                    {toLocalizedNum((revenueData.summary?.order_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </div>
                <div className='border-t pt-4'>
                  <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Typography variant='h6'>{dictionary?.common?.total || 'Total'}</Typography>
                    <Typography variant='h5' color='success.main'>
                      {toLocalizedNum((revenueData.summary?.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                  {revenueData.summary?.gross_profit !== undefined && (
                    <div className={`flex justify-between items-center mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.analytics?.grossProfit || 'Gross Profit'}
                      </Typography>
                      <Typography variant='body1' color='success.main' fontWeight={500}>
                        {toLocalizedNum((revenueData.summary?.gross_profit || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </div>
                  )}
                  {revenueData.summary?.profit_margin !== undefined && (
                    <div className={`flex justify-between items-center mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.analytics?.profitMargin || 'Profit Margin'}
                      </Typography>
                      <Typography variant='body1' fontWeight={500}>
                        {toLocalizedNum((revenueData.summary?.profit_margin || 0).toFixed(1))}%
                      </Typography>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Typography color='text.secondary' className='text-center py-8'>
                {dictionary?.common?.noData || 'No data available'}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Room Performance */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card className='h-full'>
          <CardHeader title={dictionary?.analytics?.roomPerformance || 'Room Performance'} />
          <CardContent>
            {roomData?.room_performance && roomData.room_performance.length > 0 ? (
              <div className='flex flex-col gap-4'>
                {roomData.room_performance.slice(0, 5).map((room, index) => (
                  <div key={room.id || index}>
                    <div className={`flex justify-between items-center mb-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' fontWeight={500}>
                        {room.name} ({room.ps})
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {toLocalizedNum(room.booking_count)} {dictionary?.navigation?.bookings} • {toLocalizedNum(room.avg_duration_hours)}{dictionary?.common?.hrs || 'h'}
                      </Typography>
                    </div>
                    <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <LinearProgress
                        variant='determinate'
                        value={Math.min(100, (parseFloat(room.booking_count) / 100) * 100)}
                        className='flex-1'
                        sx={{ direction: 'ltr' }}
                        color={parseFloat(room.booking_count) > 10 ? 'success' : parseFloat(room.booking_count) > 5 ? 'warning' : 'error'}
                      />
                      <Typography variant='caption' fontWeight={500} className='w-12'>
                        {toLocalizedNum(room.booking_count)}
                      </Typography>
                    </div>
                    <Typography variant='caption' color='success.main' className={isRtl ? 'text-right block' : ''}>
                      {toLocalizedNum(parseFloat(room.total_revenue).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                ))}
                {roomData.summary && (
                  <div className='border-t pt-4'>
                    <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.analytics?.totalRevenue || 'Total Revenue'}
                      </Typography>
                      <Chip
                        label={`${toLocalizedNum(roomData.summary.total_revenue?.toFixed(0))} ${dictionary?.common?.currency || 'EGP'}`}
                        color='success'
                        size='small'
                      />
                    </div>
                    <div className={`flex justify-between items-center mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <Typography variant='body2' color='text.secondary'>
                        {dictionary?.analytics?.totalBookings || 'Total Bookings'}
                      </Typography>
                      <Chip
                        label={`${toLocalizedNum(roomData.summary.total_bookings)}`}
                        color='primary'
                        size='small'
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Typography color='text.secondary' className='text-center py-8'>
                {dictionary?.common?.noData || 'No data available'}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Cafeteria Analytics */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader title={dictionary?.analytics?.topSellingItems || 'Top Selling Items'} />
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {cafeteriaData?.top_performers && cafeteriaData.top_performers.length > 0 ? (
              <>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.cafeteria?.itemName || 'Item'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.analytics?.sold || 'Sold'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cafeteriaData.top_performers.slice(cafeteriaPage * rowsPerPage, cafeteriaPage * rowsPerPage + rowsPerPage).map((item: any, index: number) => (
                      <tr key={item.id || index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2' fontWeight={500}>
                            {item.name}
                          </Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(item.total_sold)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(parseFloat(item.total_revenue).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={cafeteriaData.top_performers.length}
                page={cafeteriaPage}
                onPageChange={(_, newPage) => setCafeteriaPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[5]}
              />
              </>
            ) : (
              <div className='flex-1 flex items-center justify-center'>
                <Typography color='text.secondary'>
                  {dictionary?.common?.noData || 'No data available'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Customer Analytics */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <CardHeader title={dictionary?.analytics?.customerInsights || 'Customer Insights'} />
          <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {customerData ? (
              <div className='flex flex-col gap-4 flex-1'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className={`p-3 rounded-lg bg-actionHover ${isRtl ? 'text-right' : ''}`}>
                    <Typography variant='caption' color='text.secondary'>
                      {dictionary?.analytics?.newCustomers || 'New Customers'}
                    </Typography>
                    <Typography variant='h6'>{toLocalizedNum(customerData.new_customers || customerData.summary?.new_customers || 0)}</Typography>
                  </div>
                  <div className={`p-3 rounded-lg bg-actionHover ${isRtl ? 'text-right' : ''}`}>
                    <Typography variant='caption' color='text.secondary'>
                      {dictionary?.analytics?.returningCustomers || 'Returning'}
                    </Typography>
                    <Typography variant='h6'>{toLocalizedNum(customerData.returning_customers || customerData.summary?.active_customers || 0)}</Typography>
                  </div>
                </div>

                <Typography variant='subtitle2' fontWeight={600} className={`mt-2 ${isRtl ? 'text-right' : ''}`}>
                  {dictionary?.analytics?.topCustomers || 'Top Customers'}
                </Typography>

                {customerData.top_customers?.slice(0, 3).map((customer, index) => (
                  <div key={customer.customer_id || customer.id || index} className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <CustomAvatar size={32} skin='light'>
                        {(customer.customer_name || customer.name)?.charAt(0) || '?'}
                      </CustomAvatar>
                      <div className={isRtl ? 'text-right' : ''}>
                        <Typography variant='body2' fontWeight={500}>
                          {customer.customer_name || customer.name}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {toLocalizedNum(customer.bookings || customer.booking_count || 0)} {dictionary?.navigation?.bookings}
                        </Typography>
                      </div>
                    </div>
                    <Typography variant='body2' color='success.main'>
                      {toLocalizedNum(customer.total_spent?.toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                ))}
              </div>
            ) : (
              <div className='flex-1 flex items-center justify-center'>
                <Typography color='text.secondary'>
                  {dictionary?.common?.noData || 'No data available'}
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Daily Breakdown & Hourly Distribution */}
      {roomData?.daily_breakdown && roomData.daily_breakdown.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.analytics?.dailyBreakdown || 'Daily Breakdown'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.date || 'Date'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.analytics?.day || 'Day'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomData.daily_breakdown.slice(dailyPage * rowsPerPage, dailyPage * rowsPerPage + rowsPerPage).map((day, index) => (
                      <tr key={index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2'>{formatLocalDate(day.date, getLocaleForRtl(isRtl))}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{formatLocalDate(day.date, getLocaleForRtl(isRtl), { weekday: 'long' })}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(day.booking_count)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(parseFloat(day.revenue).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={roomData.daily_breakdown.length}
                page={dailyPage}
                onPageChange={(_, newPage) => setDailyPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[5]}
              />
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Hourly Distribution */}
      {roomData?.hourly_distribution && roomData.hourly_distribution.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.analytics?.peakHours || 'Peak Hours'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.hour || 'Hour'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomData.hourly_distribution.slice(hourlyPage * rowsPerPage, hourlyPage * rowsPerPage + rowsPerPage).map((hour, index) => (
                      <tr key={index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(hour.hour)}:00</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(hour.booking_count)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(parseFloat(hour.revenue).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={roomData.hourly_distribution.length}
                page={hourlyPage}
                onPageChange={(_, newPage) => setHourlyPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[5]}
              />
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Day of Week Analysis */}
      {roomData?.day_of_week_analysis && roomData.day_of_week_analysis.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.analytics?.dayOfWeekPerformance || 'Day of Week Performance'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.analytics?.day || 'Day'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomData.day_of_week_analysis.slice(dayOfWeekPage * rowsPerPage, dayOfWeekPage * rowsPerPage + rowsPerPage).map((day, index) => {
                      const dayNames: { [key: string]: string } = {
                        'Sunday': dictionary?.days?.sunday || 'Sunday',
                        'Monday': dictionary?.days?.monday || 'Monday',
                        'Tuesday': dictionary?.days?.tuesday || 'Tuesday',
                        'Wednesday': dictionary?.days?.wednesday || 'Wednesday',
                        'Thursday': dictionary?.days?.thursday || 'Thursday',
                        'Friday': dictionary?.days?.friday || 'Friday',
                        'Saturday': dictionary?.days?.saturday || 'Saturday'
                      }
                      return (
                        <tr key={index} className='border-b last:border-0'>
                          <td className='p-2'>
                            <Typography variant='body2' fontWeight={500}>{dayNames[day.day_name] || day.day_name}</Typography>
                          </td>
                          <td className='p-2'>
                            <Typography variant='body2'>{toLocalizedNum(day.booking_count)}</Typography>
                          </td>
                          <td className='p-2'>
                            <Typography variant='body2' color='success.main'>
                              {toLocalizedNum(parseFloat(day.revenue).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={roomData.day_of_week_analysis.length}
                page={dayOfWeekPage}
                onPageChange={(_, newPage) => setDayOfWeekPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[5]}
              />
            </CardContent>
          </Card>
        </Grid>
      )}

    </Grid>
  )
}

export default Analytics
