'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
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
import TablePagination from '@mui/material/TablePagination'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'

import { analyticsApi } from '@/services/api'
import type { AdminPerformanceAnalytics as AdminPerformanceAnalyticsType, AdminPerformanceData, AdminPerformanceShift } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import CustomAvatar from '@core/components/mui/Avatar'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@/configs/i18n'
import { formatLocalDate, getLocaleForRtl } from '@/utils/timezone'

interface AdminPerformanceAnalyticsProps {
  dictionary: any
}

const AdminPerformanceAnalytics = ({ dictionary }: AdminPerformanceAnalyticsProps) => {
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

  // Role translations
  const roleLabels: Record<string, { en: string; ar: string }> = {
    'superadmin': { en: 'Super Admin', ar: 'مدير عام' },
    'admin': { en: 'Admin', ar: 'مشرف' },
    'cashier': { en: 'Cashier', ar: 'كاشير' },
    'manager': { en: 'Manager', ar: 'مدير' }
  }

  // Status translations
  const statusLabels: Record<string, { en: string; ar: string }> = {
    'active': { en: 'Active', ar: 'نشط' },
    'inactive': { en: 'Inactive', ar: 'غير نشط' }
  }

  // Helper functions for translations
  const getLocalizedDayName = (dayName: string) => {
    return dayNames[dayName]?.[isRtl ? 'ar' : 'en'] || dayName
  }

  const getLocalizedRole = (role: string) => {
    return roleLabels[role?.toLowerCase()]?.[isRtl ? 'ar' : 'en'] || role
  }

  const getLocalizedStatus = (status: string) => {
    return statusLabels[status?.toLowerCase()]?.[isRtl ? 'ar' : 'en'] || status
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

  const [data, setData] = useState<AdminPerformanceAnalyticsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Date range filter
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [activePreset, setActivePreset] = useState<string>('today')

  // Expanded admin rows
  const [expandedAdmins, setExpandedAdmins] = useState<number[]>([])

  // Pagination states
  const [adminsPage, setAdminsPage] = useState(0)
  const [shiftsPage, setShiftsPage] = useState(0)
  const [dailyPage, setDailyPage] = useState(0)
  const rowsPerPage = 10

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

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await analyticsApi.getAdminPerformance(startDate, endDate)
      if (response.status === 'success') {
        setData(response.data)
      } else {
        setError(response.message || 'Failed to fetch data')
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError || 'Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [dictionary, startDate, endDate])

  const toggleAdminExpand = (adminId: number) => {
    setExpandedAdmins(prev => 
      prev.includes(adminId) 
        ? prev.filter(id => id !== adminId) 
        : [...prev, adminId]
    )
  }

  // Print function
  const handlePrint = () => {
    const currency = dictionary?.common?.currency || 'EGP'
    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`
    const dir = isRtl ? 'rtl' : 'ltr'
    
    const printContent = `
      <!DOCTYPE html>
      <html dir="${dir}" lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>${dictionary?.adminPerformance?.title || 'Admin Performance Analytics'} - ${dateRange}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; direction: ${dir}; }
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
          .status-active { color: #4caf50; }
          .status-inactive { color: #f44336; }
          @media print {
            body { padding: 10px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${dictionary?.adminPerformance?.title || 'Admin Performance Analytics'}</h1>
        <p class="date-range">${dateRange}</p>
        
        <div class="summary-grid">
          <div class="summary-box">
            <div class="value">${data?.summary?.total_admins || 0}</div>
            <div class="label">${dictionary?.adminPerformance?.totalAdmins || 'Total Admins'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${data?.summary?.total_shifts || 0}</div>
            <div class="label">${dictionary?.adminPerformance?.totalShifts || 'Total Shifts'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(data?.summary?.total_hours || 0).toFixed(1)}</div>
            <div class="label">${dictionary?.adminPerformance?.totalHours || 'Total Hours'}</div>
          </div>
          <div class="summary-box">
            <div class="value">${Number(data?.summary?.total_revenue || 0).toFixed(2)} ${currency}</div>
            <div class="label">${dictionary?.adminPerformance?.totalRevenue || 'Total Revenue'}</div>
          </div>
        </div>

        <div class="section">
          <h2>${dictionary?.adminPerformance?.adminsList || 'Admins Performance'}</h2>
          <table>
            <tr>
              <th>${dictionary?.admins?.name || 'Name'}</th>
              <th>${dictionary?.common?.email || 'Email'}</th>
              <th>${dictionary?.common?.role || 'Role'}</th>
              <th>${dictionary?.common?.status || 'Status'}</th>
              <th>${dictionary?.adminPerformance?.daysPresent || 'Days Present'}</th>
              <th>${dictionary?.shifts?.shifts || 'Shifts'}</th>
              <th>${dictionary?.common?.hours || 'Hours'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
              <th>${dictionary?.adminPerformance?.avgRevenuePerShift || 'Avg/Shift'}</th>
            </tr>
            ${(data?.admins || []).map((adminData: AdminPerformanceData) => `
              <tr>
                <td>${adminData.name || '-'}</td>
                <td>${adminData.email || '-'}</td>
                <td>${roleLabels[adminData.role?.toLowerCase()]?.[isRtl ? 'ar' : 'en'] || adminData.role || '-'}</td>
                <td class="${adminData.status === 'active' ? 'status-active' : 'status-inactive'}">${statusLabels[adminData.status?.toLowerCase()]?.[isRtl ? 'ar' : 'en'] || adminData.status || '-'}</td>
                <td>${adminData.days_present || 0}</td>
                <td>${adminData.total_shifts || 0}</td>
                <td>${Number(adminData.total_hours || 0).toFixed(1)}</td>
                <td>${Number(adminData.total_revenue || 0).toFixed(2)} ${currency}</td>
                <td>${Number(adminData.avg_revenue_per_shift || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>

        ${(data?.daily_performance && data.daily_performance.length > 0) ? `
        <div class="section">
          <h2>${dictionary?.adminPerformance?.dailyPerformance || 'Daily Performance'}</h2>
          <table>
            <tr>
              <th>${dictionary?.common?.date || 'Date'}</th>
              <th>${dictionary?.common?.day || 'Day'}</th>
              <th>${dictionary?.shifts?.shifts || 'Shifts'}</th>
              <th>${dictionary?.common?.hours || 'Hours'}</th>
              <th>${dictionary?.navigation?.orders || 'Orders'}</th>
              <th>${dictionary?.navigation?.bookings || 'Bookings'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
            </tr>
            ${data.daily_performance.map((day: any) => `
              <tr>
                <td>${day.date}</td>
                <td>${dayNames[day.day_name]?.[isRtl ? 'ar' : 'en'] || day.day_name}</td>
                <td>${day.shift_count}</td>
                <td>${Number(day.hours || 0).toFixed(1)}</td>
                <td>${day.orders}</td>
                <td>${day.bookings}</td>
                <td>${Number(day.revenue || 0).toFixed(2)} ${currency}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${(data?.all_shifts && data.all_shifts.length > 0) ? `
        <div class="section">
          <h2>${dictionary?.shifts?.allShifts || 'All Shifts'}</h2>
          <table>
            <tr>
              <th>${dictionary?.admins?.name || 'Admin'}</th>
              <th>${dictionary?.shifts?.startTime || 'Start'}</th>
              <th>${dictionary?.shifts?.endTime || 'End'}</th>
              <th>${dictionary?.common?.hours || 'Hours'}</th>
              <th>${dictionary?.navigation?.orders || 'Orders'}</th>
              <th>${dictionary?.navigation?.bookings || 'Bookings'}</th>
              <th>${dictionary?.common?.revenue || 'Revenue'}</th>
            </tr>
            ${data.all_shifts.map((shift: AdminPerformanceShift) => `
              <tr>
                <td>${shift.admin_name || '-'}</td>
                <td>${shift.started_at ? new Date(shift.started_at).toLocaleString(lang, { hour12: true }) : '-'}</td>
                <td>${shift.ended_at ? new Date(shift.ended_at).toLocaleString(lang, { hour12: true }) : '-'}</td>
                <td>${Number(shift.duration_hours || 0).toFixed(1)}</td>
                <td>${shift.total_orders || 0}</td>
                <td>${shift.total_bookings || 0}</td>
                <td>${Number(shift.total_revenue || 0).toFixed(2)} ${currency}</td>
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

      {/* Header with Date Range Picker */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.adminPerformance?.title || 'Admin Performance Analytics'}
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
                <Button
                  variant='contained'
                  size='small'
                  onClick={fetchData}
                  startIcon={<i className='tabler-refresh' />}
                >
                  {dictionary?.common?.refresh || 'Refresh'}
                </Button>
                <Tooltip title={dictionary?.common?.print || 'Print'}>
                  <Button
                    variant='outlined'
                    size='small'
                    onClick={handlePrint}
                    startIcon={<i className='tabler-printer' />}
                  >
                    {dictionary?.common?.print || 'Print'}
                  </Button>
                </Tooltip>
              </div>
            }
          />
          <CardContent>
            <ButtonGroup variant='outlined' size='small'>
              <Button
                variant={activePreset === 'today' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('today')}
              >
                {dictionary?.common?.today || 'Today'}
              </Button>
              <Button
                variant={activePreset === 'yesterday' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('yesterday')}
              >
                {dictionary?.common?.yesterday || 'Yesterday'}
              </Button>
              <Button
                variant={activePreset === 'last7days' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('last7days')}
              >
                {dictionary?.common?.last7Days || 'Last 7 Days'}
              </Button>
              <Button
                variant={activePreset === 'last30days' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('last30days')}
              >
                {dictionary?.common?.last30Days || 'Last 30 Days'}
              </Button>
              <Button
                variant={activePreset === 'thisMonth' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('thisMonth')}
              >
                {dictionary?.common?.thisMonth || 'This Month'}
              </Button>
              <Button
                variant={activePreset === 'lastMonth' ? 'contained' : 'outlined'}
                onClick={() => handlePresetClick('lastMonth')}
              >
                {dictionary?.common?.lastMonth || 'Last Month'}
              </Button>
            </ButtonGroup>
          </CardContent>
        </Card>
      </Grid>

      {/* Summary Statistics */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                <i className='tabler-users text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(data?.summary?.total_admins || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalAdmins || 'Total Admins'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                <i className='tabler-clock text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(data?.summary?.total_shifts || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalShifts || 'Total Shifts'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
                <i className='tabler-hourglass text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(Number(data?.summary?.total_hours || 0).toFixed(1))} {dictionary?.common?.hrs || 'h'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalHours || 'Total Hours'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
                <i className='tabler-currency-dollar text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(Number(data?.summary?.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalRevenue || 'Total Revenue'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Additional Stats */}
      <Grid size={{ xs: 12 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='secondary' skin='light' size={48}>
                <i className='tabler-shopping-cart text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(data?.summary?.total_orders || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalOrders || 'Total Orders'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='error' skin='light' size={48}>
                <i className='tabler-calendar-check text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(data?.summary?.total_bookings || 0)}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.totalBookings || 'Total Bookings'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
                <i className='tabler-trending-up text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(Number(data?.summary?.avg_revenue_per_shift || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.avgRevenuePerShift || 'Avg Revenue/Shift'}
                </Typography>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
                <i className='tabler-chart-bar text-2xl' />
              </CustomAvatar>
              <div className={isRtl ? 'text-right' : ''}>
                <Typography variant='h5' fontWeight={600}>
                  {toLocalizedNum(Number(data?.summary?.avg_revenue_per_admin || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.adminPerformance?.avgRevenuePerAdmin || 'Avg Revenue/Admin'}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </div>
      </Grid>

      {/* Admins Performance Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader 
            title={dictionary?.adminPerformance?.adminsList || 'Admins Performance'}
            avatar={<i className='tabler-users text-xl' />}
          />
          <CardContent>
            <div className='overflow-x-auto pb-2'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}></th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.admins?.name || 'Name'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.email || 'Email'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.status || 'Status'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.adminPerformance?.daysPresent || 'Days'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.shifts?.shifts || 'Shifts'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.hours || 'Hours'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.navigation?.orders || 'Orders'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    <th className={`p-3 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.adminPerformance?.avgPerShift || 'Avg/Shift'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.admins || [])
                    .slice(adminsPage * rowsPerPage, adminsPage * rowsPerPage + rowsPerPage)
                    .map((adminData: AdminPerformanceData) => (
                      <Fragment key={adminData.id}>
                        <tr className='border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800'>
                          <td className='p-3'>
                            {adminData.total_shifts > 0 && (
                              <IconButton 
                                size='small' 
                                onClick={() => toggleAdminExpand(adminData.id)}
                              >
                                <i className={expandedAdmins.includes(adminData.id) ? 'tabler-chevron-down' : 'tabler-chevron-right'} />
                              </IconButton>
                            )}
                          </td>
                          <td className='p-3'>
                            <div className={`flex items-center gap-2 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                              <CustomAvatar size={32} skin='light' color='primary'>
                                {adminData.name?.charAt(0).toUpperCase() || 'A'}
                              </CustomAvatar>
                              <div>
                                <Typography variant='body2' fontWeight={500}>{adminData.name}</Typography>
                                <Typography variant='caption' color='text.secondary'>{getLocalizedRole(adminData.role)}</Typography>
                              </div>
                            </div>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{adminData.email}</Typography>
                          </td>
                          <td className='p-3'>
                            <Chip
                              label={getLocalizedStatus(adminData.status)}
                              color={adminData.status === 'active' ? 'success' : 'default'}
                              size='small'
                              variant='outlined'
                            />
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{toLocalizedNum(adminData.days_present || 0)}</Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{toLocalizedNum(adminData.total_shifts || 0)}</Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{toLocalizedNum(Number(adminData.total_hours || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{toLocalizedNum(adminData.total_orders || 0)}</Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2'>{toLocalizedNum(adminData.total_bookings || 0)}</Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2' fontWeight={500} color='success.main'>
                              {toLocalizedNum(Number(adminData.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </td>
                          <td className='p-3'>
                            <Typography variant='body2' color='primary.main'>
                              {toLocalizedNum(Number(adminData.avg_revenue_per_shift || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </td>
                        </tr>
                        {/* Expanded shifts for this admin */}
                        <tr>
                          <td colSpan={11} className='p-0'>
                            <Collapse in={expandedAdmins.includes(adminData.id)} timeout='auto' unmountOnExit>
                              <div className='bg-gray-50 dark:bg-gray-900 p-4'>
                                <Typography variant='subtitle2' className='mb-2'>
                                  {dictionary?.shifts?.shifts || 'Shifts'} ({adminData.shifts?.length || 0})
                                </Typography>
                                <div className='overflow-x-auto'>
                                  <table className='w-full'>
                                    <thead>
                                      <tr className='border-b'>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.shifts?.startTime || 'Start'}</th>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.shifts?.endTime || 'End'}</th>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.common?.hours || 'Hours'}</th>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.navigation?.orders || 'Orders'}</th>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.navigation?.bookings || 'Bookings'}</th>
                                        <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'} text-xs`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(adminData.shifts || []).slice(0, 5).map((shift: AdminPerformanceShift) => (
                                        <tr key={shift.id} className='border-b last:border-0'>
                                          <td className='p-2'>
                                            <Typography variant='caption'>{formatDateTime12h(shift.started_at)}</Typography>
                                          </td>
                                          <td className='p-2'>
                                            <Typography variant='caption'>{shift.ended_at ? formatDateTime12h(shift.ended_at) : '-'}</Typography>
                                          </td>
                                          <td className='p-2'>
                                            <Typography variant='caption'>{toLocalizedNum(Number(shift.duration_hours || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                                          </td>
                                          <td className='p-2'>
                                            <Typography variant='caption'>{toLocalizedNum(shift.total_orders || 0)}</Typography>
                                          </td>
                                          <td className='p-2'>
                                            <Typography variant='caption'>{toLocalizedNum(shift.total_bookings || 0)}</Typography>
                                          </td>
                                          <td className='p-2'>
                                            <Typography variant='caption' color='success.main'>
                                              {toLocalizedNum(Number(shift.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                                            </Typography>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </Collapse>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                </tbody>
              </table>
            </div>
            {(data?.admins?.length || 0) > rowsPerPage && (
              <TablePagination
                component='div'
                count={data?.admins?.length || 0}
                page={adminsPage}
                onPageChange={(_, newPage) => setAdminsPage(newPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10]}
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Daily Performance */}
      {data?.daily_performance && data.daily_performance.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader 
              title={dictionary?.adminPerformance?.dailyPerformance || 'Daily Performance'}
              avatar={<i className='tabler-calendar-stats text-xl' />}
            />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.date || 'Date'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.day || 'Day'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.shifts?.shifts || 'Shifts'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.hours || 'Hours'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily_performance.slice(dailyPage * 5, dailyPage * 5 + 5).map((day, index) => (
                      <tr key={index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2'>{formatLocalDate(day.date, getLocaleForRtl(isRtl))}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{getLocalizedDayName(day.day_name)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(day.shift_count)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(Number(day.hours || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main' fontWeight={500}>
                            {toLocalizedNum(Number(day.revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.daily_performance.length > 5 && (
                <TablePagination
                  component='div'
                  count={data.daily_performance.length}
                  page={dailyPage}
                  onPageChange={(_, newPage) => setDailyPage(newPage)}
                  rowsPerPage={5}
                  rowsPerPageOptions={[5]}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* All Shifts */}
      {data?.all_shifts && data.all_shifts.length > 0 && (
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '450px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader 
              title={dictionary?.shifts?.allShifts || 'All Shifts'}
              avatar={<i className='tabler-clock-record text-xl' />}
            />
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className='overflow-x-auto flex-1'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.admins?.name || 'Admin'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.shifts?.startTime || 'Start'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.hours || 'Hours'}</th>
                      <th className={`p-2 ${isRtl ? 'text-right' : 'text-left'}`}>{dictionary?.common?.revenue || 'Revenue'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.all_shifts.slice(shiftsPage * 5, shiftsPage * 5 + 5).map((shift, index) => (
                      <tr key={index} className='border-b last:border-0'>
                        <td className='p-2'>
                          <Typography variant='body2' fontWeight={500}>{shift.admin_name}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='caption'>{formatDateTime12h(shift.started_at)}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2'>{toLocalizedNum(Number(shift.duration_hours || 0).toFixed(1))}{dictionary?.common?.hrs || 'h'}</Typography>
                        </td>
                        <td className='p-2'>
                          <Typography variant='body2' color='success.main'>
                            {toLocalizedNum(Number(shift.total_revenue || 0).toFixed(0))} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.all_shifts.length > 5 && (
                <TablePagination
                  component='div'
                  count={data.all_shifts.length}
                  page={shiftsPage}
                  onPageChange={(_, newPage) => setShiftsPage(newPage)}
                  rowsPerPage={5}
                  rowsPerPageOptions={[5]}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default AdminPerformanceAnalytics
