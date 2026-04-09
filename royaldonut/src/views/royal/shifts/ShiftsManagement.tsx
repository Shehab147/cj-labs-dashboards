'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'

import { reportsApi } from '@/services/api'
import { printHtml } from '@/utils/printHtml'
import CustomAvatar from '@core/components/mui/Avatar'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

const ShiftsManagement = () => {
  const [tab, setTab] = useState(0) // 0=cashier, 1=kitchen
  const [cashierShifts, setCashierShifts] = useState<any[]>([])
  const [kitchenShifts, setKitchenShifts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())

  const fetchShifts = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = { from: fromDate, to: toDate }
      const [cashierRes, kitchenRes] = await Promise.all([
        reportsApi.getCashierShifts(params),
        reportsApi.getKitchenShifts(params)
      ])
      if (cashierRes.status === 'success') setCashierShifts(cashierRes.data?.shifts || [])
      if (kitchenRes.status === 'success') setKitchenShifts(kitchenRes.data?.shifts || [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  // Print cashier shift summary
  const handlePrintShift = (shift: any) => {
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"/><title>تقرير الوردية ${shift.shift_id}</title>
      <style>body{font-family:Arial;font-size:13px;max-width:400px;margin:0 auto;padding:16px}
      h3{text-align:center}table{width:100%;border-collapse:collapse}
      td,th{padding:6px 8px;border-bottom:1px solid #eee}
      .value{font-weight:bold;text-align:left}
      @media print{button{display:none}}</style></head>
      <body>
        <h3>🍩 رويال دونتس — تقرير الوردية</h3>
        <table>
          <tr><td>الكاشير</td><td class="value">${shift.cashier_name}</td></tr>
          <tr><td>الحالة</td><td class="value">${shift.status === 'open' ? 'نشطة' : 'منتهية'}</td></tr>
          <tr><td>البداية</td><td class="value">${shift.started_at ? new Date(shift.started_at).toLocaleString('ar-SA') : '—'}</td></tr>
          <tr><td>النهاية</td><td class="value">${shift.ended_at ? new Date(shift.ended_at).toLocaleString('ar-SA') : '—'}</td></tr>
          <tr><td>النقدية الافتتاحية</td><td class="value">${parseFloat(shift.opening_cash || 0).toFixed(2)} ج.م</td></tr>
          <tr><td>النقدية الختامية</td><td class="value">${shift.closing_cash ? parseFloat(shift.closing_cash).toFixed(2) + ' ج.م' : '—'}</td></tr>
          <tr><td>النقدية المتوقعة</td><td class="value">${shift.expected_cash ? parseFloat(shift.expected_cash).toFixed(2) + ' ج.م' : '—'}</td></tr>
          <tr><td>الفرق</td><td class="value">${shift.cash_difference ? parseFloat(shift.cash_difference).toFixed(2) : '—'}</td></tr>
          <tr><td>إجمالي المبيعات</td><td class="value">${parseFloat(shift.shift_revenue || 0).toFixed(2)} ج.م</td></tr>
          <tr><td>عدد الطلبات</td><td class="value">${shift.orders_count || 0}</td></tr>
        </table>
        <script>window.print();</script>
      </body></html>`
    printHtml(html)
  }

  // Compute totals for cashier shifts
  const cashierTotals = cashierShifts.reduce((acc: any, s: any) => {
    acc.revenue += parseFloat(s.shift_revenue || 0)
    acc.orders += s.orders_count || 0
    acc.diff += parseFloat(s.cash_difference || 0)
    return acc
  }, { revenue: 0, orders: 0, diff: 0 })

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  return (
    <Grid container spacing={6}>
      {/* Filters */}
      <Grid size={{ xs: 12 }}>
        <Box className='flex gap-4 flex-wrap items-end'>
          <TextField label='من' type='date' value={fromDate} onChange={e => setFromDate(e.target.value)}
            size='small' slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label='إلى' type='date' value={toDate} onChange={e => setToDate(e.target.value)}
            size='small' slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant='outlined' onClick={fetchShifts} startIcon={<i className='tabler-refresh' />}>
            تحديث
          </Button>
        </Box>
      </Grid>

      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{cashierTotals.revenue.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي إيرادات الورديات</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{cashierTotals.orders}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الطلبات</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='info' skin='light' size={48}>
              <i className='tabler-user text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{cashierShifts.length}</Typography>
            <Typography variant='body2' color='text.secondary'>ورديات كاشير</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
              <i className='tabler-chef-hat text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{kitchenShifts.length}</Typography>
            <Typography variant='body2' color='text.secondary'>ورديات مطبخ</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Shifts Tables */}
      <Grid size={{ xs: 12 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} className='mb-4'>
          <Tab label={`ورديات الكاشير (${cashierShifts.length})`} />
          <Tab label={`ورديات المطبخ (${kitchenShifts.length})`} />
        </Tabs>

        {tab === 0 && (
          <Card>
            <CardHeader title='ورديات الكاشير' subheader={`${cashierShifts.length} وردية في هذه الفترة`} />
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>الكاشير</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell align='right'>افتتاح</TableCell>
                    <TableCell align='right'>ختام</TableCell>
                    <TableCell align='right'>متوقع</TableCell>
                    <TableCell align='right'>فرق</TableCell>
                    <TableCell align='right'>المبيعات</TableCell>
                    <TableCell align='center'>الطلبات</TableCell>
                    <TableCell>البداية</TableCell>
                    <TableCell>النهاية</TableCell>
                    <TableCell align='right'>طباعة</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashierShifts.length === 0 ? (
                    <TableRow><TableCell colSpan={12} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد ورديات</Typography>
                    </TableCell></TableRow>
                  ) : (
                    cashierShifts.map((shift: any) => {
                      const diff = parseFloat(shift.cash_difference || 0)
                      return (
                        <TableRow key={shift.shift_id}>
                          <TableCell>{shift.shift_id}</TableCell>
                          <TableCell>
                            <Typography variant='subtitle2'>{shift.cashier_name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={shift.status === 'open' ? 'نشطة' : 'منتهية'}
                              size='small'
                              color={shift.status === 'open' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell align='right'>{parseFloat(shift.opening_cash || 0).toFixed(2)}</TableCell>
                          <TableCell align='right'>{shift.closing_cash ? parseFloat(shift.closing_cash).toFixed(2) : '—'}</TableCell>
                          <TableCell align='right'>{shift.expected_cash ? parseFloat(shift.expected_cash).toFixed(2) : '—'}</TableCell>
                          <TableCell align='right'>
                            {shift.cash_difference != null ? (
                              <Chip
                                label={diff.toFixed(2)}
                                size='small'
                                color={diff === 0 ? 'success' : Math.abs(diff) < 50 ? 'warning' : 'error'}
                              />
                            ) : '—'}
                          </TableCell>
                          <TableCell align='right'>
                            <Typography fontWeight={600}>{parseFloat(shift.shift_revenue || 0).toFixed(2)}</Typography>
                          </TableCell>
                          <TableCell align='center'>{shift.orders_count || 0}</TableCell>
                          <TableCell>
                            <Typography variant='caption' color='text.secondary'>
                              {shift.started_at ? new Date(shift.started_at).toLocaleString('ar-SA') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='caption' color='text.secondary'>
                              {shift.ended_at ? new Date(shift.ended_at).toLocaleString('ar-SA') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align='right'>
                            <Tooltip title='طباعة'>
                              <Button size='small' onClick={() => handlePrintShift(shift)} startIcon={<i className='tabler-printer' />}>
                                طباعة
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}

        {tab === 1 && (
          <Card>
            <CardHeader title='ورديات المطبخ' subheader={`${kitchenShifts.length} وردية في هذه الفترة`} />
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>الموظف</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>البداية</TableCell>
                    <TableCell>النهاية</TableCell>
                    <TableCell>ملاحظات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {kitchenShifts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد ورديات</Typography>
                    </TableCell></TableRow>
                  ) : (
                    kitchenShifts.map((shift: any) => (
                      <TableRow key={shift.id}>
                        <TableCell>{shift.id}</TableCell>
                        <TableCell>
                          <Typography variant='subtitle2'>{shift.full_name || shift.user_name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={shift.status === 'open' ? 'نشطة' : 'منتهية'}
                            size='small'
                            color={shift.status === 'open' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {shift.started_at ? new Date(shift.started_at).toLocaleString('ar-SA') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {shift.ended_at ? new Date(shift.ended_at).toLocaleString('ar-SA') : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {shift.notes || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
      </Grid>
    </Grid>
  )
}

export default ShiftsManagement
