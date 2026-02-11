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
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import LinearProgress from '@mui/material/LinearProgress'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

import { analyticsApi } from '@/services/api'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@/configs/i18n'
import { formatLocalDate } from '@/utils/timezone'

interface RoomsAnalysisProps {
  dictionary: any
}

interface Booking {
  booking_id: number
  room_id: number
  customer_id: number | null
  booking_date: string
  start_time: string
  end_time: string | null
  started_at: string
  finished_at: string | null
  room_name: string
  room_ps: string
  room_capacity: number
  hour_cost: number
  multi_hour_cost: number
  customer_name: string | null
  customer_phone: string | null
  price: number
  discount: number
  is_multi: number
  duration_minutes: number
  duration_hours: number
  status: 'active' | 'completed' | 'pending'
}

interface RoomPerformance {
  id: string
  name: string
  ps: string
  hour_cost: string
  capacity: string
  booking_count: string
  total_revenue: string
  avg_booking_value: string
  avg_duration_minutes: string
  unique_customers: string
  avg_duration_hours: number
}

interface RoomAnalyticsData {
  date_range: {
    start_date: string
    end_date: string
  }
  summary: {
    total_bookings: number
    total_revenue: number
    avg_booking_value: number
    avg_duration_hours: number
    active_sessions: number
  }
  room_performance: RoomPerformance[]
  daily_breakdown: Array<{
    date: string
    day_name: string
    booking_count: string
    revenue: string
    avg_duration_hours: number
  }>
  hourly_distribution: Array<{
    hour: number
    bookings: number
  }>
  day_of_week_analysis: Array<{
    day_name: string
    day_number: string
    booking_count: string
    revenue: string
  }>
  top_customers: Array<{
    id: string
    name: string
    phone: string
    booking_count: string
    total_spent: string
  }>
  all_bookings: Booking[]
}

const RoomsAnalysis = ({ dictionary }: RoomsAnalysisProps) => {
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

  // Date filter states - default to current month
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])

  // Data states
  const [analyticsData, setAnalyticsData] = useState<RoomAnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI states
  const [activeTab, setActiveTab] = useState(0)
  const [expandedRoom, setExpandedRoom] = useState<number | null>(null)
  const [bookingsPage, setBookingsPage] = useState(0)
  const [bookingsRowsPerPage, setBookingsRowsPerPage] = useState(10)
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await analyticsApi.getFullRooms(startDate, endDate)
      
      if (response.status === 'success') {
        setAnalyticsData(response.data)
      } else {
        setError(response.message || dictionary?.errors?.fetchError || 'Failed to fetch data')
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError || 'Network error')
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, dictionary])

  useEffect(() => {
    if (isSuperadmin) {
      fetchData()
    }
  }, [fetchData, isSuperadmin])

  // Filter bookings by selected room
  const filteredBookings = selectedRoom
    ? analyticsData?.all_bookings?.filter(b => Number(b.room_id) === selectedRoom) || []
    : analyticsData?.all_bookings || []

  // Paginated bookings
  const paginatedBookings = filteredBookings.slice(
    bookingsPage * bookingsRowsPerPage,
    bookingsPage * bookingsRowsPerPage + bookingsRowsPerPage
  )

  const handleDateFilter = () => {
    fetchData()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success'
      case 'completed':
        return 'primary'
      case 'pending':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      active: { en: 'Active', ar: 'نشط' },
      completed: { en: 'Completed', ar: 'مكتمل' },
      pending: { en: 'Pending', ar: 'قيد الانتظار' }
    }
    return labels[status]?.[isRtl ? 'ar' : 'en'] || status
  }

  // Print function
  const handlePrint = () => {
    const currency = dictionary?.common?.currency || 'EGP'
    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`
    
    // Day name translations
    const dayNames: Record<string, { en: string; ar: string }> = {
      'Sunday': { en: 'Sunday', ar: 'الأحد' },
      'Monday': { en: 'Monday', ar: 'الإثنين' },
      'Tuesday': { en: 'Tuesday', ar: 'الثلاثاء' },
      'Wednesday': { en: 'Wednesday', ar: 'الأربعاء' },
      'Thursday': { en: 'Thursday', ar: 'الخميس' },
      'Friday': { en: 'Friday', ar: 'الجمعة' },
      'Saturday': { en: 'Saturday', ar: 'السبت' }
    }

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>${dictionary?.roomsAnalysis?.title || 'Rooms Analysis'} - ${dateRange}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
          h2 { margin: 20px 0 10px; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          h3 { margin: 15px 0 8px; font-size: 14px; color: #555; }
          .date-range { text-align: center; color: #666; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
          .summary-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-box .value { font-size: 20px; font-weight: bold; color: #333; }
          .summary-box .label { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isRtl ? 'right' : 'left'}; }
          th { background: #f5f5f5; font-weight: 600; }
          .section { margin-bottom: 25px; page-break-inside: avoid; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
          .status-active { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; }
          .status-completed { background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 4px; }
          .status-pending { background: #fff3e0; color: #ef6c00; padding: 2px 8px; border-radius: 4px; }
          @media print {
            body { padding: 10px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${dictionary?.roomsAnalysis?.title || 'Rooms Analysis'}</h1>
        <p class="date-range">${dateRange}</p>
        
        <div class="summary-grid">
          <div class="summary-box">
            <div class="value">${analyticsData?.summary?.total_bookings || 0}</div>
            <div class="label">${dictionary?.roomsAnalysis?.totalBookings || 'Total Bookings'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(analyticsData?.summary?.total_revenue || 0).toFixed(2)} ${currency}</div>
            <div class="label">${dictionary?.roomsAnalysis?.totalRevenue || 'Total Revenue'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(analyticsData?.summary?.avg_booking_value || 0).toFixed(2)} ${currency}</div>
            <div class="label">${dictionary?.roomsAnalysis?.avgBookingValue || 'Avg Booking Value'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(analyticsData?.summary?.avg_duration_hours || 0).toFixed(1)} ${dictionary?.common?.hrs || 'h'}</div>
            <div class="label">${dictionary?.roomsAnalysis?.avgDuration || 'Avg Duration'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${analyticsData?.summary?.active_sessions || 0}</div>
            <div class="label">${dictionary?.roomsAnalysis?.activeSessions || 'Active Sessions'}</div>
          </div>
        </div>

        ${analyticsData?.room_performance && analyticsData.room_performance.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.roomsAnalysis?.roomPerformance || 'Room Performance'}</h2>
          <table>
            <tr>
              <th>${dictionary?.rooms?.roomName || 'Room Name'}</th>
              <th>${dictionary?.rooms?.console || 'Console'}</th>
              <th>${dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
              <th>${dictionary?.roomsAnalysis?.avgDuration || 'Avg Duration'}</th>
              <th>${dictionary?.roomsAnalysis?.uniqueCustomers || 'Unique Customers'}</th>
            </tr>
            ${analyticsData.room_performance.map(room => `
              <tr>
                <td>${room.name}</td>
                <td>${room.ps}</td>
                <td>${room.booking_count}</td>
                <td>${Number(room.total_revenue || 0).toFixed(2)} ${currency}</td>
                <td>${Number(room.avg_duration_hours || 0).toFixed(1)} ${dictionary?.common?.hrs || 'h'}</td>
                <td>${room.unique_customers || 0}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${analyticsData?.all_bookings && analyticsData.all_bookings.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.roomsAnalysis?.allBookings || 'All Bookings'} (${analyticsData.all_bookings.length})</h2>
          <table>
            <tr>
              <th>#</th>
              <th>${dictionary?.common?.date || 'Date'}</th>
              <th>${dictionary?.rooms?.roomName || 'Room'}</th>
              <th>${dictionary?.common?.customer || 'Customer'}</th>
              <th>${dictionary?.common?.startTime || 'Start'}</th>
              <th>${dictionary?.common?.endTime || 'End'}</th>
              <th>${dictionary?.common?.hours || 'Duration'}</th>
              <th>${dictionary?.common?.price || 'Price'}</th>
              <th>${dictionary?.common?.discount || 'Discount'}</th>
              <th>${dictionary?.common?.status || 'Status'}</th>
            </tr>
            ${analyticsData.all_bookings.map((booking, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${booking.booking_date}</td>
                <td>${booking.room_name}${booking.is_multi === 1 ? ` (${dictionary?.bookings?.multiPlayer || 'Multi'})` : ''}</td>
                <td>${booking.customer_name || (isRtl ? 'ضيف' : 'Guest')}</td>
                <td>${booking.start_time?.substring(0, 5) || '-'}</td>
                <td>${booking.end_time ? booking.end_time.substring(0, 5) : '-'}</td>
                <td>${Number(booking.duration_hours || 0).toFixed(1)} ${dictionary?.common?.hrs || 'h'}</td>
                <td>${Number(booking.price || 0).toFixed(2)} ${currency}</td>
                <td>${booking.discount > 0 ? `-${booking.discount}` : '-'}</td>
                <td><span class="status-${booking.status}">${getStatusLabel(booking.status)}</span></td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${analyticsData?.daily_breakdown && analyticsData.daily_breakdown.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.roomsAnalysis?.dailyBreakdown || 'Daily Breakdown'}</h2>
          <table>
            <tr>
              <th>${dictionary?.common?.date || 'Date'}</th>
              <th>${dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
              <th>${dictionary?.roomsAnalysis?.avgDuration || 'Avg Duration'}</th>
            </tr>
            ${analyticsData.daily_breakdown.map(day => `
              <tr>
                <td>${day.date}</td>
                <td>${day.booking_count}</td>
                <td>${Number(day.revenue || 0).toFixed(2)} ${currency}</td>
                <td>${Number(day.avg_duration_hours || 0).toFixed(1)} ${dictionary?.common?.hrs || 'h'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${analyticsData?.day_of_week_analysis && analyticsData.day_of_week_analysis.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.roomsAnalysis?.weekdayAnalysis || 'Weekday Analysis'}</h2>
          <table>
            <tr>
              <th>${dictionary?.common?.day || 'Day'}</th>
              <th>${dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
            </tr>
            ${analyticsData.day_of_week_analysis.map(day => `
              <tr>
                <td>${dayNames[day.day_name]?.[isRtl ? 'ar' : 'en'] || day.day_name}</td>
                <td>${day.booking_count}</td>
                <td>${Number(day.revenue || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${analyticsData?.top_customers && analyticsData.top_customers.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.roomsAnalysis?.topCustomers || 'Top Customers'}</h2>
          <table>
            <tr>
              <th>#</th>
              <th>${dictionary?.common?.name || 'Name'}</th>
              <th>${dictionary?.common?.phone || 'Phone'}</th>
              <th>${dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</th>
              <th>${dictionary?.common?.total || 'Total Spent'}</th>
            </tr>
            ${analyticsData.top_customers.map((customer, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${customer.name}</td>
                <td>${customer.phone || '-'}</td>
                <td>${customer.booking_count}</td>
                <td>${Number(customer.total_spent || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        <div class="footer">
          ${dictionary?.common?.printedAt || 'Printed at'}: ${new Date().toLocaleString(lang, { hour12: true })}<br>
          ${dictionary?.common?.generatedBy || 'Generated by'}: ${admin?.name || 'Admin'}
        </div>
      </body>
      </html>
    `

    // Use pywebview direct print API if available (for desktop app)
    const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null
    
    if (pywebview?.api?.print_html_direct) {
      pywebview.api.print_html_direct(printContent)
    } else {
      // Fallback: use hidden iframe for printing (works in webview and browsers)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.srcdoc = printContent
      document.body.appendChild(iframe)
      
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print()
          setTimeout(() => document.body.removeChild(iframe), 1000)
        }, 300)
      }
    }
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

      {/* Header with Date Filter */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={
              <Box className='flex items-center gap-2'>
                <i className='tabler-chart-dots text-2xl text-primary' />
                <span>{dictionary?.roomsAnalysis?.title || 'Rooms Analysis'}</span>
              </Box>
            }
            subheader={dictionary?.roomsAnalysis?.subtitle || 'Detailed analysis of room bookings and performance'}
          />
          <CardContent>
            <Box className='flex flex-wrap items-end gap-4'>
              <CustomTextField
                type='date'
                label={dictionary?.common?.from || 'From'}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size='small'
              />
              <CustomTextField
                type='date'
                label={dictionary?.common?.to || 'To'}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size='small'
              />
              <Button
                variant='contained'
                onClick={handleDateFilter}
                startIcon={<i className='tabler-filter' />}
              >
                {dictionary?.common?.filter || 'Filter'}
              </Button>
              <Button
                variant='outlined'
                onClick={() => {
                  setStartDate(firstDayOfMonth.toISOString().split('T')[0])
                  setEndDate(today.toISOString().split('T')[0])
                }}
                startIcon={<i className='tabler-refresh' />}
              >
                {dictionary?.common?.refresh || 'Reset'}
              </Button>
              <Button
                variant='outlined'
                color='secondary'
                onClick={handlePrint}
                disabled={!analyticsData}
                startIcon={<i className='tabler-printer' />}
              >
                {dictionary?.common?.print || 'Print'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2'>
            <CustomAvatar skin='light' color='primary' size={48}>
              <i className='tabler-calendar-event text-2xl' />
            </CustomAvatar>
            <Typography variant='h4' className='font-bold'>
              {toLocalizedNum(analyticsData?.summary?.total_bookings || 0)}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary?.roomsAnalysis?.totalBookings || 'Total Bookings'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2'>
            <CustomAvatar skin='light' color='success' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4' className='font-bold'>
              {toLocalizedNum((analyticsData?.summary?.total_revenue || 0).toFixed(2))}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary?.roomsAnalysis?.totalRevenue || 'Total Revenue'} ({dictionary?.common?.currency || 'EGP'})
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2'>
            <CustomAvatar skin='light' color='info' size={48}>
              <i className='tabler-clock text-2xl' />
            </CustomAvatar>
            <Typography variant='h4' className='font-bold'>
              {toLocalizedNum((analyticsData?.summary?.avg_booking_value || 0).toFixed(2))}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary?.roomsAnalysis?.avgBookingValue || 'Avg Booking Value'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2'>
            <CustomAvatar skin='light' color='warning' size={48}>
              <i className='tabler-hourglass text-2xl' />
            </CustomAvatar>
            <Typography variant='h4' className='font-bold'>
              {toLocalizedNum((analyticsData?.summary?.avg_duration_hours || 0).toFixed(1))}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary?.roomsAnalysis?.avgDuration || 'Avg Duration (hrs)'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2'>
            <CustomAvatar skin='light' color='secondary' size={48}>
              <i className='tabler-users text-2xl' />
            </CustomAvatar>
            <Typography variant='h4' className='font-bold'>
              {toLocalizedNum(analyticsData?.summary?.active_sessions || 0)}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {dictionary?.roomsAnalysis?.activeSessions || 'Active Sessions'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Tabs for different views */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab
                label={dictionary?.roomsAnalysis?.roomPerformance || 'Room Performance'}
                icon={<i className='tabler-door' />}
                iconPosition='start'
              />
              <Tab
                label={dictionary?.roomsAnalysis?.allBookings || 'All Bookings'}
                icon={<i className='tabler-list' />}
                iconPosition='start'
              />
              <Tab
                label={dictionary?.roomsAnalysis?.dailyBreakdown || 'Daily Breakdown'}
                icon={<i className='tabler-calendar-stats' />}
                iconPosition='start'
              />
            </Tabs>
          </Box>

          {/* Room Performance Tab */}
          {activeTab === 0 && (
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{dictionary?.rooms?.roomName || 'Room Name'}</TableCell>
                      <TableCell>{dictionary?.rooms?.console || 'Console'}</TableCell>
                      <TableCell align='center'>{dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.revenue || 'Revenue'}</TableCell>
                      <TableCell align='center'>{dictionary?.roomsAnalysis?.totalHours || 'Hours'}</TableCell>
                      <TableCell align='center'>{dictionary?.roomsAnalysis?.avgDuration || 'Avg Duration'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.actions || 'Actions'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData?.room_performance?.map((room) => (
                      <TableRow key={room.id} hover>
                        <TableCell>
                          <Box className='flex items-center gap-2'>
                            <CustomAvatar skin='light' color='primary' size={32}>
                              <i className='tabler-door' />
                            </CustomAvatar>
                            <Typography fontWeight={500}>{room.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={room.ps} size='small' color='info' variant='tonal' />
                        </TableCell>
                        <TableCell align='center'>
                          <Typography fontWeight={500}>{toLocalizedNum(room.booking_count)}</Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography fontWeight={500} color='success.main'>
                            {toLocalizedNum(Number(room.total_revenue || 0).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography>{toLocalizedNum(Number(room.avg_duration_hours || 0).toFixed(1))} {dictionary?.common?.hrs || 'h'}</Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography>{toLocalizedNum(Number(room.avg_duration_hours || 0).toFixed(1))} {dictionary?.common?.hrs || 'h'}</Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Button
                            size='small'
                            variant='outlined'
                            onClick={() => {
                              setSelectedRoom(Number(room.id))
                              setActiveTab(1)
                              setBookingsPage(0)
                            }}
                          >
                            {dictionary?.roomsAnalysis?.viewBookings || 'View Bookings'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!analyticsData?.room_performance || analyticsData.room_performance.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} align='center'>
                          <Typography color='text.secondary' py={4}>
                            {dictionary?.common?.noData || 'No data available'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          )}

          {/* All Bookings Tab */}
          {activeTab === 1 && (
            <CardContent>
              {/* Room Filter */}
              <Box className='flex flex-wrap items-center gap-4 mb-4'>
                <Typography variant='body2' fontWeight={500}>
                  {dictionary?.common?.filter || 'Filter'}:
                </Typography>
                <Chip
                  label={dictionary?.common?.all || 'All Rooms'}
                  color={selectedRoom === null ? 'primary' : 'default'}
                  variant={selectedRoom === null ? 'filled' : 'outlined'}
                  onClick={() => {
                    setSelectedRoom(null)
                    setBookingsPage(0)
                  }}
                />
                {analyticsData?.room_performance?.map((room) => (
                  <Chip
                    key={room.id}
                    label={room.name}
                    color={selectedRoom === Number(room.id) ? 'primary' : 'default'}
                    variant={selectedRoom === Number(room.id) ? 'filled' : 'outlined'}
                    onClick={() => {
                      setSelectedRoom(Number(room.id))
                      setBookingsPage(0)
                    }}
                  />
                ))}
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{dictionary?.common?.date || 'Date'}</TableCell>
                      <TableCell>{dictionary?.rooms?.roomName || 'Room'}</TableCell>
                      <TableCell>{dictionary?.common?.customer || 'Customer'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.startTime || 'Start'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.endTime || 'End'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.hours || 'Duration'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.price || 'Price'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.discount || 'Discount'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.status || 'Status'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedBookings.map((booking) => (
                      <TableRow key={booking.booking_id} hover>
                        <TableCell>
                          <Typography variant='body2'>
                            {formatLocalDate(booking.booking_date, lang)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box className='flex items-center gap-2'>
                            <Chip
                              label={booking.room_name}
                              size='small'
                              color='primary'
                              variant='tonal'
                            />
                            {booking.is_multi === 1 && (
                              <Chip label={dictionary?.bookings?.multiPlayer || 'Multi'} size='small' color='warning' variant='outlined' />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {booking.customer_name || (isRtl ? 'ضيف' : 'Guest')}
                          </Typography>
                          {booking.customer_phone && (
                            <Typography variant='caption' color='text.secondary'>
                              {booking.customer_phone}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align='center'>
                          <Typography variant='body2'>{booking.start_time?.substring(0, 5)}</Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography variant='body2'>
                            {booking.end_time ? booking.end_time.substring(0, 5) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography variant='body2'>
                            {toLocalizedNum(Number(booking.duration_hours || 0).toFixed(1))} {dictionary?.common?.hrs || 'h'}
                          </Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Typography variant='body2' fontWeight={500} color='success.main'>
                            {toLocalizedNum(Number(booking.price || 0).toFixed(2))}
                          </Typography>
                        </TableCell>
                        <TableCell align='center'>
                          {booking.discount > 0 ? (
                            <Chip
                              label={`-${toLocalizedNum(booking.discount)}`}
                              size='small'
                              color='error'
                              variant='outlined'
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell align='center'>
                          <Chip
                            label={getStatusLabel(booking.status)}
                            size='small'
                            color={getStatusColor(booking.status) as any}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedBookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} align='center'>
                          <Typography color='text.secondary' py={4}>
                            {dictionary?.common?.noData || 'No bookings found'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component='div'
                count={filteredBookings.length}
                page={bookingsPage}
                onPageChange={(_, page) => setBookingsPage(page)}
                rowsPerPage={bookingsRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setBookingsRowsPerPage(parseInt(e.target.value, 10))
                  setBookingsPage(0)
                }}
                labelRowsPerPage={dictionary?.common?.rowsPerPage || 'Rows per page:'}
              />
            </CardContent>
          )}

          {/* Daily Breakdown Tab */}
          {activeTab === 2 && (
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>{dictionary?.common?.date || 'Date'}</TableCell>
                      <TableCell align='center'>{dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</TableCell>
                      <TableCell align='center'>{dictionary?.common?.revenue || 'Revenue'}</TableCell>
                      <TableCell align='center'>{dictionary?.roomsAnalysis?.totalHours || 'Hours'}</TableCell>
                      <TableCell>{dictionary?.roomsAnalysis?.performance || 'Performance'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData?.daily_breakdown?.map((day, index) => {
                      const maxRevenue = Math.max(...(analyticsData.daily_breakdown?.map(d => Number(d.revenue)) || [1]))
                      const progress = (Number(day.revenue) / maxRevenue) * 100
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography fontWeight={500}>
                              {formatLocalDate(day.date, lang)}
                            </Typography>
                          </TableCell>
                          <TableCell align='center'>
                            <Chip label={toLocalizedNum(day.booking_count)} size='small' color='primary' variant='tonal' />
                          </TableCell>
                          <TableCell align='center'>
                            <Typography fontWeight={500} color='success.main'>
                              {toLocalizedNum(Number(day.revenue || 0).toFixed(2))} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </TableCell>
                          <TableCell align='center'>
                            <Typography>
                              {toLocalizedNum(Number(day.avg_duration_hours || 0).toFixed(1))} {dictionary?.common?.hrs || 'h'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>
                            <LinearProgress
                              variant='determinate'
                              value={progress}
                              color='primary'
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {(!analyticsData?.daily_breakdown || analyticsData.daily_breakdown.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} align='center'>
                          <Typography color='text.secondary' py={4}>
                            {dictionary?.common?.noData || 'No data available'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          )}
        </Card>
      </Grid>

      {/* Top Customers */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader
            title={
              <Box className='flex items-center gap-2'>
                <i className='tabler-users text-xl text-primary' />
                <span>{dictionary?.roomsAnalysis?.topCustomers || 'Top Customers'}</span>
              </Box>
            }
          />
          <CardContent>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>{dictionary?.common?.name || 'Name'}</TableCell>
                    <TableCell align='center'>{dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</TableCell>
                    <TableCell align='center'>{dictionary?.common?.total || 'Total Spent'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsData?.top_customers?.slice(0, 5).map((customer, index) => (
                    <TableRow key={customer.id} hover>
                      <TableCell>
                        <CustomAvatar
                          skin='light'
                          color={index === 0 ? 'warning' : index === 1 ? 'secondary' : 'primary'}
                          size={24}
                        >
                          <Typography variant='caption' fontWeight={600}>
                            {toLocalizedNum(index + 1)}
                          </Typography>
                        </CustomAvatar>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={500}>{customer.name}</Typography>
                      </TableCell>
                      <TableCell align='center'>
                        <Chip label={toLocalizedNum(customer.booking_count)} size='small' color='info' variant='tonal' />
                      </TableCell>
                      <TableCell align='center'>
                        <Typography fontWeight={500} color='success.main'>
                          {toLocalizedNum(Number(customer.total_spent || 0).toFixed(2))}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!analyticsData?.top_customers || analyticsData.top_customers.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} align='center'>
                        <Typography color='text.secondary' py={2}>
                          {dictionary?.common?.noData || 'No data'}
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

      {/* Day of Week Analysis */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader
            title={
              <Box className='flex items-center gap-2'>
                <i className='tabler-calendar-week text-xl text-primary' />
                <span>{dictionary?.roomsAnalysis?.weekdayAnalysis || 'Weekday Analysis'}</span>
              </Box>
            }
          />
          <CardContent>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{dictionary?.common?.date || 'Day'}</TableCell>
                    <TableCell align='center'>{dictionary?.roomsAnalysis?.totalBookings || 'Bookings'}</TableCell>
                    <TableCell align='center'>{dictionary?.common?.revenue || 'Revenue'}</TableCell>
                    <TableCell>{dictionary?.roomsAnalysis?.performance || 'Performance'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsData?.day_of_week_analysis?.map((day, index) => {
                    const maxBookings = Math.max(...(analyticsData.day_of_week_analysis?.map(d => Number(d.booking_count)) || [1]))
                    const progress = (Number(day.booking_count) / maxBookings) * 100
                    
                    // Translate day names
                    const dayNames: Record<string, { en: string; ar: string }> = {
                      'Sunday': { en: 'Sunday', ar: 'الأحد' },
                      'Monday': { en: 'Monday', ar: 'الإثنين' },
                      'Tuesday': { en: 'Tuesday', ar: 'الثلاثاء' },
                      'Wednesday': { en: 'Wednesday', ar: 'الأربعاء' },
                      'Thursday': { en: 'Thursday', ar: 'الخميس' },
                      'Friday': { en: 'Friday', ar: 'الجمعة' },
                      'Saturday': { en: 'Saturday', ar: 'السبت' }
                    }
                    
                    return (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography fontWeight={500}>
                            {dayNames[day.day_name]?.[isRtl ? 'ar' : 'en'] || day.day_name}
                          </Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Chip label={toLocalizedNum(day.booking_count)} size='small' color='primary' variant='tonal' />
                        </TableCell>
                        <TableCell align='center'>
                          <Typography fontWeight={500} color='success.main'>
                            {toLocalizedNum(Number(day.revenue || 0).toFixed(2))}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <LinearProgress
                            variant='determinate'
                            value={progress}
                            color='success'
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {(!analyticsData?.day_of_week_analysis || analyticsData.day_of_week_analysis.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} align='center'>
                        <Typography color='text.secondary' py={2}>
                          {dictionary?.common?.noData || 'No data'}
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
    </Grid>
  )
}

export default RoomsAnalysis
