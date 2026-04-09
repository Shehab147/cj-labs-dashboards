'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

import { reportsApi } from '@/services/api'
import CustomAvatar from '@core/components/mui/Avatar'

const today = () => new Date().toISOString().split('T')[0]

const monthStart = () => {
  const d = new Date()

  d.setDate(1)

  return d.toISOString().split('T')[0]
}

const CashierPerformance = () => {
  const [shifts, setShifts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate, setToDate] = useState(today())

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const res = await reportsApi.getCashierShifts({ from: fromDate, to: toDate })

      if (res.status === 'success') {
        setShifts(Array.isArray(res.data?.shifts) ? res.data.shifts : [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const uniqueCashiers = new Set(shifts.map(s => s.cashier_name)).size
  const totalOrders = shifts.reduce((sum, s) => sum + Number(s.orders_count || 0), 0)
  const totalSales = shifts.reduce((sum, s) => sum + parseFloat(s.shift_revenue || 0), 0)

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-4 items-end flex-wrap'>
            <TextField label='من تاريخ' type='date' value={fromDate} onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <TextField label='إلى تاريخ' type='date' value={toDate} onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <Button variant='contained' onClick={fetchData}>تطبيق</Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-users text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{uniqueCashiers}</Typography>
            <Typography variant='body2' color='text.secondary'>عدد الكاشير</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalOrders}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الطلبات</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='warning' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalSales.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي المبيعات</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='أداء الكاشير حسب الورديات' />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>الكاشير</TableCell>
                  <TableCell align='center'>الحالة</TableCell>
                  <TableCell align='center'>عدد الطلبات</TableCell>
                  <TableCell align='right'>إيراد الوردية</TableCell>
                  <TableCell align='right'>فرق النقدية</TableCell>
                  <TableCell>بداية الوردية</TableCell>
                  <TableCell>نهاية الوردية</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد بيانات</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  shifts.map((shift: any) => {
                    const cashDifference = parseFloat(shift.cash_difference || 0)

                    return (
                      <TableRow key={shift.shift_id}>
                        <TableCell>
                          <Box>
                            <Typography variant='subtitle2'>{shift.cashier_name}</Typography>
                            <Typography variant='caption' color='text.secondary'>#{shift.shift_id}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align='center'>
                          <Chip
                            label={shift.status === 'open' ? 'نشطة' : 'مغلقة'}
                            size='small'
                            color={shift.status === 'open' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell align='center'>{shift.orders_count || 0}</TableCell>
                        <TableCell align='right'>{parseFloat(shift.shift_revenue || 0).toFixed(2)}</TableCell>
                        <TableCell align='right'>
                          <Chip
                            label={shift.cash_difference == null ? '—' : cashDifference.toFixed(2)}
                            size='small'
                            color={shift.cash_difference == null ? 'default' : cashDifference === 0 ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell>{shift.started_at ? new Date(shift.started_at).toLocaleString('ar-SA') : '—'}</TableCell>
                        <TableCell>{shift.ended_at ? new Date(shift.ended_at).toLocaleString('ar-SA') : '—'}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}

export default CashierPerformance
