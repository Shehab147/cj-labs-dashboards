'use client'

import { useEffect, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { reportsApi } from '@/services/api'
import { formatInCairo } from '@/utils/timezone'
import CustomAvatar from '@core/components/mui/Avatar'

const today = () => formatInCairo(new Date(), 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })

const monthStart = () => {
  const d = new Date()

  d.setDate(1)

  return formatInCairo(d, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const SalesAnalytics = () => {
  const [dailyReport, setDailyReport] = useState<any[]>([])
  const [incomeReport, setIncomeReport] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())

  const fetchData = async () => {
    try {
      setIsLoading(true)

      const [dailyRes, incomeRes] = await Promise.all([
        reportsApi.getDailyReport({ from: startDate, to: endDate }),
        reportsApi.getIncomeReport({ from: startDate, to: endDate })
      ])

      if (dailyRes.status === 'success') {
        setDailyReport(Array.isArray(dailyRes.data?.report) ? dailyRes.data.report : [])
      }

      if (incomeRes.status === 'success') {
        setIncomeReport(Array.isArray(incomeRes.data?.report) ? incomeRes.data.report : [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const totalOrders = incomeReport.reduce((sum, row) => sum + Number(row.total_orders || 0), 0)
  const grossIncome = incomeReport.reduce((sum, row) => sum + parseFloat(row.gross_income || 0), 0)
  const netProfit = dailyReport.reduce((sum, row) => sum + parseFloat(row.net_profit || 0), 0)
  const cancelledOrders = incomeReport.reduce((sum, row) => sum + Number(row.cancelled_orders || 0), 0)

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-4 items-end flex-wrap'>
            <TextField label='من تاريخ' type='date' value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <TextField label='إلى تاريخ' type='date' value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} size='small' />
            <Button variant='contained' onClick={fetchData}>تطبيق</Button>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-receipt text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalOrders}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الطلبات</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{grossIncome.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الدخل</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color={netProfit >= 0 ? 'info' : 'error'} skin='light' size={48}>
              <i className='tabler-trending-up text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{netProfit.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>صافي الربح</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='error' skin='light' size={48}>
              <i className='tabler-x text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{cancelledOrders}</Typography>
            <Typography variant='body2' color='text.secondary'>طلبات ملغية</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='تقرير الدخل اليومي' />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>التاريخ</TableCell>
                  <TableCell align='center'>الطلبات</TableCell>
                  <TableCell align='right'>إجمالي الدخل</TableCell>
                  <TableCell align='right'>الخصومات</TableCell>
                  <TableCell align='right'>دخل نقدي</TableCell>
                  <TableCell align='right'>دخل غير نقدي</TableCell>
                  <TableCell align='center'>الملغي</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incomeReport.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align='center'><Typography variant='body2' color='text.secondary'>لا توجد بيانات</Typography></TableCell></TableRow>
                ) : (
                  incomeReport.map((day: any) => (
                    <TableRow key={day.report_date}>
                      <TableCell>{day.report_date}</TableCell>
                      <TableCell align='center'>{day.total_orders}</TableCell>
                      <TableCell align='right'>{parseFloat(day.gross_income || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(day.total_discounts || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(day.cash_income || 0).toFixed(2)}</TableCell>
                      <TableCell align='right'>{parseFloat(day.non_cash_income || 0).toFixed(2)}</TableCell>
                      <TableCell align='center'>{day.cancelled_orders}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}

export default SalesAnalytics
