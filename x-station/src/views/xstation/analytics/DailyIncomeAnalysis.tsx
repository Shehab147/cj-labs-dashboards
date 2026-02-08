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
import LinearProgress from '@mui/material/LinearProgress'
import TablePagination from '@mui/material/TablePagination'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ButtonGroup from '@mui/material/ButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

import { shiftApi } from '@/services/api'
import type { DailyIncomeAnalysis as DailyIncomeAnalysisType, MonthlyShiftSummary, Shift } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@/configs/i18n'
import { formatLocalDate, getLocaleForRtl } from '@/utils/timezone'

interface DailyIncomeAnalysisProps {
  dictionary: any
}

const DailyIncomeAnalysis = ({ dictionary }: DailyIncomeAnalysisProps) => {
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

  // Helper to format datetime to 12-hour format
  const formatDateTime12h = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString(lang, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    })
  }

  const [dailyData, setDailyData] = useState<DailyIncomeAnalysisType | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyShiftSummary | null>(null)
  const [shiftsList, setShiftsList] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Date range filter
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [activePreset, setActivePreset] = useState<string>('today')

  // Date preset helper functions
  const getDatePreset = (preset: string) => {
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    
    switch (preset) {
      case 'today':
        return { start: formatDate(today), end: formatDate(today) }
      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return { start: formatDate(yesterday), end: formatDate(yesterday) }
      }
      case 'last7days': {
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 6)
        return { start: formatDate(last7), end: formatDate(today) }
      }
      case 'last30days': {
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 29)
        return { start: formatDate(last30), end: formatDate(today) }
      }
      case 'thisMonth': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start: formatDate(firstDay), end: formatDate(today) }
      }
      case 'lastMonth': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        return { start: formatDate(firstDayLastMonth), end: formatDate(lastDayLastMonth) }
      }
      default:
        return { start: formatDate(today), end: formatDate(today) }
    }
  }

  const handlePresetClick = (preset: string) => {
    const { start, end } = getDatePreset(preset)
    setStartDate(start)
    setEndDate(end)
    setActivePreset(preset)
  }

  // Check if current dates match a preset
  const getCurrentPreset = () => {
    const presets = ['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth']
    for (const preset of presets) {
      const { start, end } = getDatePreset(preset)
      if (start === startDate && end === endDate) return preset
    }
    return 'custom'
  }

  // Pagination states
  const [ordersPage, setOrdersPage] = useState(0)
  const [bookingsPage, setBookingsPage] = useState(0)
  const [shiftsPage, setShiftsPage] = useState(0)
  const [hourlyPage, setHourlyPage] = useState(0)
  const [staffPage, setStaffPage] = useState(0)
  const rowsPerPage = 5

  const fetchDailyData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [dailyRes, shiftsRes] = await Promise.all([
        shiftApi.getDailyIncomeAnalysis(startDate, endDate),
        shiftApi.list(startDate, endDate)
      ])

      if (dailyRes.status === 'success') setDailyData(dailyRes.data)
      if (shiftsRes.status === 'success') setShiftsList(shiftsRes.data || [])
    } catch (err) {
      setError(dictionary?.errors?.networkError || 'Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [dictionary, startDate, endDate])

  const fetchMonthlyData = useCallback(async () => {
    try {
      const monthlyRes = await shiftApi.getMonthlyShiftSummary(selectedMonth)
      if (monthlyRes.status === 'success') setMonthlyData(monthlyRes.data)
    } catch (err) {
      console.error('Failed to fetch monthly data:', err)
    }
  }, [selectedMonth])

  // Print function
  const handlePrint = () => {
    const currency = dictionary?.common?.currency || 'EGP'
    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRtl ? 'rtl' : 'ltr'}" lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>${dictionary?.shifts?.dailyIncomeAnalysis || 'Daily Income Analysis'} - ${dateRange}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
          h2 { margin: 20px 0 10px; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          h3 { margin: 15px 0 8px; font-size: 14px; color: #555; }
          .date-range { text-align: center; color: #666; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
          .summary-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-box .value { font-size: 20px; font-weight: bold; color: #333; }
          .summary-box .label { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isRtl ? 'right' : 'left'}; }
          th { background: #f5f5f5; font-weight: 600; }
          .section { margin-bottom: 25px; page-break-inside: avoid; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print {
            body { padding: 10px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${dictionary?.shifts?.dailyIncomeAnalysis || 'Daily Income Analysis'}</h1>
        <p class="date-range">${dateRange}</p>
        
        <div class="summary-grid">
          <div class="summary-box">
            <div class="value">${Number(dailyData?.summary?.total_revenue || 0).toFixed(2)} ${currency}</div>
            <div class="label">${dictionary?.shifts?.totalRevenue || 'Total Revenue'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(dailyData?.summary?.total_profit || 0).toFixed(2)} ${currency}</div>
            <div class="label">${dictionary?.shifts?.totalProfit || 'Total Profit'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${dailyData?.summary?.total_orders || 0}</div>
            <div class="label">${dictionary?.shifts?.totalOrders || 'Total Orders'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${dailyData?.summary?.total_bookings || 0}</div>
            <div class="label">${dictionary?.shifts?.totalBookings || 'Total Bookings'}</div>
          </div>
        </div>

        <div class="section">
          <h2>${dictionary?.shifts?.revenueBreakdown || 'Revenue Breakdown'}</h2>
          <table>
            <tr><th>${dictionary?.common?.type || 'Type'}</th><th>${dictionary?.common?.amount || 'Amount'}</th></tr>
            <tr><td>${dictionary?.shifts?.orderRevenue || 'Order Revenue'}</td><td>${Number(dailyData?.summary?.order_revenue || 0).toFixed(2)} ${currency}</td></tr>
            <tr><td>${dictionary?.shifts?.bookingRevenue || 'Booking Revenue'}</td><td>${Number(dailyData?.summary?.booking_revenue || 0).toFixed(2)} ${currency}</td></tr>
            <tr><td>${dictionary?.shifts?.totalCost || 'Total Cost'}</td><td>${Number(dailyData?.summary?.total_cost || 0).toFixed(2)} ${currency}</td></tr>
            <tr><td>${dictionary?.shifts?.totalDiscount || 'Total Discount'}</td><td>${Number(dailyData?.summary?.total_discount || 0).toFixed(2)} ${currency}</td></tr>
            <tr style="font-weight:bold;"><td>${dictionary?.shifts?.netProfit || 'Net Profit'}</td><td>${Number(dailyData?.summary?.total_profit || 0).toFixed(2)} ${currency}</td></tr>
          </table>
        </div>

        ${shiftsList.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.shifts?.shifts || 'Shifts'} (${shiftsList.length})</h2>
          <table>
            <tr>
              <th>${dictionary?.shifts?.admin || 'Admin'}</th>
              <th>${dictionary?.shifts?.startTime || 'Start Time'}</th>
              <th>${dictionary?.shifts?.endTime || 'End Time'}</th>
              <th>${dictionary?.shifts?.totalRevenue || 'Revenue'}</th>
              <th>${dictionary?.common?.status || 'Status'}</th>
            </tr>
            ${shiftsList.map(shift => `
              <tr>
                <td>${shift.admin_name || '-'}</td>
                <td>${shift.started_at ? new Date(shift.started_at).toLocaleString(lang, { hour12: true }) : '-'}</td>
                <td>${shift.ended_at ? new Date(shift.ended_at).toLocaleString(lang, { hour12: true }) : '-'}</td>
                <td>${Number(shift.total_revenue || 0).toFixed(2)} ${currency}</td>
                <td>${shift.ended_at ? (dictionary?.shifts?.ended || 'Ended') : (dictionary?.shifts?.active || 'Active')}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${dailyData?.orders && dailyData.orders.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.navigation?.orders || 'Orders'} (${dailyData.orders.length})</h2>
          <table>
            <tr>
              <th>#</th>
              <th>${dictionary?.common?.customer || 'Customer'}</th>
              <th>${dictionary?.common?.time || 'Time'}</th>
              <th>${dictionary?.common?.price || 'Price'}</th>
              <th>${dictionary?.common?.discount || 'Discount'}</th>
            </tr>
            ${dailyData.orders.map((order: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.created_at ? new Date(order.created_at).toLocaleTimeString(lang, { hour12: true }) : '-'}</td>
                <td>${Number(order.price || 0).toFixed(2)} ${currency}</td>
                <td>${Number(order.discount || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${dailyData?.bookings && dailyData.bookings.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.navigation?.bookings || 'Bookings'} (${dailyData.bookings.length})</h2>
          <table>
            <tr>
              <th>#</th>
              <th>${dictionary?.common?.room || 'Room'}</th>
              <th>${dictionary?.common?.customer || 'Customer'}</th>
              <th>${dictionary?.common?.startTime || 'Start'}</th>
              <th>${dictionary?.common?.endTime || 'End'}</th>
              <th>${dictionary?.common?.price || 'Price'}</th>
            </tr>
            ${dailyData.bookings.map((booking: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${booking.room_name || '-'}</td>
                <td>${booking.customer_name || '-'}</td>
                <td>${booking.started_at ? new Date(booking.started_at).toLocaleTimeString(lang, { hour12: true }) : '-'}</td>
                <td>${booking.finished_at ? new Date(booking.finished_at).toLocaleTimeString(lang, { hour12: true }) : '-'}</td>
                <td>${Number(booking.price || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${dailyData?.top_selling_items && dailyData.top_selling_items.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.shifts?.topSellingItems || 'Top Selling Items'}</h2>
          <table>
            <tr>
              <th>#</th>
              <th>${dictionary?.common?.item || 'Item'}</th>
              <th>${dictionary?.common?.quantity || 'Quantity'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
            </tr>
            ${dailyData.top_selling_items.map((item: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.name || '-'}</td>
                <td>${item.quantity_sold || 0}</td>
                <td>${Number(item.revenue || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${dailyData?.room_utilization && dailyData.room_utilization.length > 0 ? `
        <div class="section">
          <h2>${dictionary?.shifts?.roomUtilization || 'Room Utilization'}</h2>
          <table>
            <tr>
              <th>${dictionary?.common?.room || 'Room'}</th>
              <th>${dictionary?.common?.bookings || 'Bookings'}</th>
              <th>${dictionary?.common?.hours || 'Hours'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
            </tr>
            ${dailyData.room_utilization.map((room: any) => `
              <tr>
                <td>${room.name || '-'}</td>
                <td>${room.booking_count || 0}</td>
                <td>${Number(room.total_hours || 0).toFixed(1)}</td>
                <td>${Number(room.revenue || 0).toFixed(2)} ${currency}</td>
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

  useEffect(() => {
    if (isSuperadmin) {
      fetchDailyData()
      fetchMonthlyData()
    }
  }, [fetchDailyData, fetchMonthlyData, isSuperadmin])

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

      {/* Header with Date Range Picker */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.shifts?.dailyIncomeAnalysis || 'Daily Income Analysis'}
            action={
              <div className='flex items-center gap-3'>
                <CustomTextField
                  type='date'
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  size='small'
                  label={dictionary?.common?.from || 'From'}
                  InputLabelProps={{ shrink: true }}
                />
                <Typography variant='body2' color='text.secondary' className='self-end pb-2'>
                  {isRtl ? 'إلى' : 'to'}
                </Typography>
                <CustomTextField
                  type='date'
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  size='small'
                  label={dictionary?.common?.to || 'To'}
                  InputLabelProps={{ shrink: true }}
                />
                <IconButton onClick={fetchDailyData} color='primary'>
                  <i className='tabler-refresh' />
                </IconButton>
                <IconButton onClick={handlePrint} color='secondary' disabled={!dailyData}>
                  <i className='tabler-printer' />
                </IconButton>
              </div>
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
                  {toLocalizedNum(Number(dailyData?.summary?.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.shifts?.totalRevenue || 'Total Revenue'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                <i className='tabler-chart-line text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(Number(dailyData?.summary?.total_profit || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.shifts?.totalProfit || 'Total Profit'}
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
                  {toLocalizedNum(dailyData?.summary?.total_orders || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.shifts?.totalOrders || 'Total Orders'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card sx={{ height: '100px' }}>
            <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                <i className='tabler-calendar-check text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(dailyData?.summary?.total_bookings || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.shifts?.totalBookings || 'Total Bookings'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Revenue Breakdown */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card className='h-full'>
          <CardHeader title={dictionary?.shifts?.revenueBreakdown || 'Revenue Breakdown'} />
          <CardContent>
            {dailyData?.summary ? (
              <div className='flex flex-col gap-4'>
                <div className={`flex justify-between items-center p-4 rounded-lg bg-primaryLight ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <CustomAvatar variant='rounded' color='primary' size={40}>
                      <i className='tabler-door text-xl' />
                    </CustomAvatar>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='body2' fontWeight={500}>
                        {dictionary?.shifts?.bookingRevenue || 'Booking Revenue'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {toLocalizedNum(dailyData.summary.total_bookings)} {dictionary?.navigation?.bookings || 'Bookings'}
                      </Typography>
                    </div>
                  </div>
                  <Typography variant='h6' color='success.main'>
                    {toLocalizedNum(Number(dailyData.summary.booking_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </div>
                <div className={`flex justify-between items-center p-4 rounded-lg bg-warningLight ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <CustomAvatar variant='rounded' color='warning' size={40}>
                      <i className='tabler-coffee text-xl' />
                    </CustomAvatar>
                    <div className={isRtl ? 'text-right' : ''}>
                      <Typography variant='body2' fontWeight={500}>
                        {dictionary?.shifts?.orderRevenue || 'Order Revenue'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {toLocalizedNum(dailyData.summary.total_orders)} {dictionary?.navigation?.orders || 'Orders'}
                      </Typography>
                    </div>
                  </div>
                  <Typography variant='h6' color='success.main'>
                    {toLocalizedNum(Number(dailyData.summary.order_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                  </Typography>
                </div>
                <div className='border-t pt-4'>
                  <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.shifts?.totalDiscount || 'Total Discount'}
                    </Typography>
                    <Typography variant='body1' color='error.main'>
                      -{toLocalizedNum(Number(dailyData.summary.total_discount || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                  <div className={`flex justify-between items-center mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.shifts?.profitMargin || 'Profit Margin'}
                    </Typography>
                    <Chip
                      label={`${toLocalizedNum(Number(dailyData.summary.profit_margin || 0).toFixed(1))}%`}
                      color={dailyData.summary.profit_margin > 50 ? 'success' : 'warning'}
                      size='small'
                    />
                  </div>
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

      {/* Shifts Summary */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Card className='h-full'>
          <CardHeader title={dictionary?.shifts?.shiftsSummary || 'Shifts Summary'} />
          <CardContent>
            {dailyData?.shifts ? (
              <div className='flex flex-col gap-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className={`p-4 rounded-lg bg-actionHover ${isRtl ? 'text-right' : ''}`}>
                    <Typography variant='caption' color='text.secondary'>
                      {dictionary?.shifts?.totalShifts || 'Total Shifts'}
                    </Typography>
                    <Typography variant='h5' fontWeight={600}>
                      {toLocalizedNum(dailyData.shifts.count)}
                    </Typography>
                  </div>
                  <div className={`p-4 rounded-lg bg-actionHover ${isRtl ? 'text-right' : ''}`}>
                    <Typography variant='caption' color='text.secondary'>
                      {dictionary?.shifts?.shiftRevenue || 'Shift Revenue'}
                    </Typography>
                    <Typography variant='h5' fontWeight={600} color='success.main'>
                      {toLocalizedNum(Number(dailyData.shifts.total_shift_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                  </div>
                </div>

                {dailyData.shifts.details && dailyData.shifts.details.length > 0 && (
                  <div className='border-t pt-4'>
                    <Typography variant='subtitle2' fontWeight={600} className='mb-3'>
                      {dictionary?.shifts?.shiftDetails || 'Shift Details'}
                    </Typography>
                    {dailyData.shifts.details.slice(shiftsPage * rowsPerPage, shiftsPage * rowsPerPage + rowsPerPage).map((shift, index) => (
                      <div key={shift.id || index} className={`flex justify-between items-center p-3 rounded-lg mb-2 bg-actionHover ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <div className={isRtl ? 'text-right' : ''}>
                          <Typography variant='body2' fontWeight={500}>
                            {shift.admin_name}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {formatDateTime12h(shift.started_at)} - {shift.ended_at ? formatDateTime12h(shift.ended_at) : (dictionary?.shifts?.active || 'Active')}
                          </Typography>
                        </div>
                        <Chip
                          label={`${toLocalizedNum(Number(shift.total_revenue || 0).toFixed(0))} ${dictionary?.common?.currency || 'EGP'}`}
                          color='success'
                          size='small'
                        />
                      </div>
                    ))}
                    {dailyData.shifts.details.length > rowsPerPage && (
                      <TablePagination
                        component='div'
                        count={dailyData.shifts.details.length}
                        page={shiftsPage}
                        onPageChange={(_, newPage) => setShiftsPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        rowsPerPageOptions={[5]}
                      />
                    )}
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

      {/* Peak Hour */}
      {dailyData?.peak_hour && (
        <Grid size={{ xs: 12, md: 4 }}>
          <Card className='h-full'>
            <CardHeader title={dictionary?.shifts?.peakHour || 'Peak Hour'} />
            <CardContent className='text-center'>
              <CustomAvatar variant='rounded' color='warning' skin='light' size={64} className='mx-auto mb-4'>
                <i className='tabler-clock-hour-4 text-3xl' />
              </CustomAvatar>
              <Typography variant='h4' fontWeight={700}>
                {dailyData.peak_hour.hour_label}
              </Typography>
              <Typography variant='body1' color='success.main' fontWeight={500}>
                {toLocalizedNum(Number(dailyData.peak_hour.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {dictionary?.shifts?.peakHourDescription || 'Highest revenue hour'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Top Selling Items */}
      {dailyData?.top_selling_items && dailyData.top_selling_items.length > 0 && (
        <Grid size={{ xs: 12, md: dailyData?.peak_hour ? 8 : 12 }}>
          <Card sx={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.shifts?.topSellingItems || 'Top Selling Items'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.cafeteria?.itemName || 'Item'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.shifts?.quantitySold || 'Sold'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.top_selling_items.slice(0, 5).map((item, index) => (
                      <tr key={item.id || index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2' fontWeight={500}>{item.name}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(item.quantity_sold)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(Number(item.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Room Utilization */}
      {dailyData?.room_utilization && dailyData.room_utilization.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.shifts?.roomUtilization || 'Room Utilization'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.rooms?.roomName || 'Room'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.hours || 'Hours'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.room_utilization.map((room, index) => (
                      <tr key={room.id || index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2' fontWeight={500}>{room.name}</Typography>
                          <Typography variant='caption' color='text.secondary'>{room.ps}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(room.booking_count)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(Number(room.total_hours || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(Number(room.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Hourly Breakdown */}
      {dailyData?.hourly_breakdown && dailyData.hourly_breakdown.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader title={dictionary?.shifts?.hourlyBreakdown || 'Hourly Breakdown'} />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.hour || 'Hour'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.orders || 'Orders'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.hourly_breakdown.slice(hourlyPage * rowsPerPage, hourlyPage * rowsPerPage + rowsPerPage).map((hour, index) => (
                      <tr key={index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2'>{hour.hour_label}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(hour.order_count || 0)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(hour.booking_count || 0)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(Number(hour.total_revenue || hour.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={dailyData.hourly_breakdown.length}
                page={hourlyPage}
                onPageChange={(_, newPage) => setHourlyPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[5]}
              />
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Monthly Summary Section */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.shifts?.monthlySummary || 'Monthly Summary'}
            action={
              <CustomTextField
                type='month'
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                size='small'
              />
            }
          />
        </Card>
      </Grid>

      {monthlyData && (
        <>
          {/* Monthly Overview Stats */}
          <Grid size={{ xs: 12 }}>
            <div className='grid grid-cols-3 gap-4'>
              <Card sx={{ height: '100px' }}>
                <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                    <i className='tabler-currency-dollar text-2xl' />
                  </CustomAvatar>
                  <div className={isRtl ? 'text-right' : ''}>
                    <Typography variant='h5' fontWeight={600}>
                      {toLocalizedNum(Number(monthlyData.summary?.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.shifts?.monthlyRevenue || 'Monthly Revenue'}
                    </Typography>
                  </div>
                </CardContent>
              </Card>
              <Card sx={{ height: '100px' }}>
                <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                    <i className='tabler-calendar text-2xl' />
                  </CustomAvatar>
                  <div className={isRtl ? 'text-right' : ''}>
                    <Typography variant='h5' fontWeight={600}>
                      {toLocalizedNum(monthlyData.summary?.total_days || 0)}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.shifts?.activeDays || 'Active Days'}
                    </Typography>
                  </div>
                </CardContent>
              </Card>
              <Card sx={{ height: '100px' }}>
                <CardContent className={`flex items-center gap-4 h-full ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                    <i className='tabler-chart-bar text-2xl' />
                  </CustomAvatar>
                  <div className={isRtl ? 'text-right' : ''}>
                    <Typography variant='h5' fontWeight={600}>
                      {toLocalizedNum(Number(monthlyData.summary?.avg_daily_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {dictionary?.shifts?.avgDailyRevenue || 'Avg Daily Revenue'}
                    </Typography>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Grid>

          {/* Staff Performance */}
          {monthlyData.staff_performance && monthlyData.staff_performance.length > 0 && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                <CardHeader title={dictionary?.shifts?.staffPerformance || 'Staff Performance'} />
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className='overflow-x-auto flex-1'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b'>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.admins?.name || 'Staff'}</th>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.shifts?.shifts || 'Shifts'}</th>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.hours || 'Hours'}</th>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.staff_performance.slice(staffPage * rowsPerPage, staffPage * rowsPerPage + rowsPerPage).map((staff, index) => (
                          <tr key={staff.id || index} className='border-b last:border-0'>
                            <td className='p-2'>
                              <Typography variant='body2' fontWeight={500}>{staff.name}</Typography>
                              <Typography variant='caption' color='text.secondary'>{staff.role}</Typography>
                            </td>
                            <td className='p-2'>
                              <Typography variant='body2'>{toLocalizedNum(staff.shift_count)}</Typography>
                            </td>
                            <td className='p-2'>
                              <Typography variant='body2'>{toLocalizedNum(Number(staff.hours_worked || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                            </td>
                            <td className='p-2'>
                              <Typography variant='body2' color='success.main'>
                                {toLocalizedNum(Number(staff.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {monthlyData.staff_performance.length > rowsPerPage && (
                    <TablePagination
                      component='div'
                      count={monthlyData.staff_performance.length}
                      page={staffPage}
                      onPageChange={(_, newPage) => setStaffPage(newPage)}
                      rowsPerPage={rowsPerPage}
                      rowsPerPageOptions={[5]}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Daily Summary Chart */}
          {monthlyData.daily_summary && monthlyData.daily_summary.length > 0 && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card sx={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                <CardHeader title={dictionary?.shifts?.dailySummary || 'Daily Summary'} />
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className='overflow-x-auto flex-1'>
                    <table className='w-full'>
                      <thead>
                        <tr className='border-b'>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.date || 'Date'}</th>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.shifts?.shifts || 'Shifts'}</th>
                          <th className={`${isRtl ? 'text-right' : 'text-start'} p-2`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.daily_summary.slice(-7).map((day, index) => (
                          <tr key={index} className='border-b last:border-0'>
                            <td className='p-2'>
                              <Typography variant='body2'>{formatLocalDate(day.date, getLocaleForRtl(isRtl))}</Typography>
                            </td>
                            <td className='p-2'>
                              <Typography variant='body2'>{toLocalizedNum(day.shift_count)}</Typography>
                            </td>
                            <td className='p-2'>
                              <Typography variant='body2' color='success.main'>
                                {toLocalizedNum(Number(day.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                              </Typography>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          )}
        </>
      )}

      {/* Report Generated Info */}
      {dailyData?.report_generated_at && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : ''}`}>
              <Typography variant='caption' color='text.secondary'>
                {dictionary?.shifts?.reportGeneratedAt || 'Report generated at'}: {dailyData.report_generated_at}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {dictionary?.shifts?.generatedBy || 'Generated by'}: {dailyData.report_generated_by?.name}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default DailyIncomeAnalysis
