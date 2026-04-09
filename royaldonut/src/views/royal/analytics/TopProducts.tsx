'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
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

const TopProducts = () => {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState(monthStart())
  const [endDate, setEndDate] = useState(today())

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const res = await reportsApi.getTopSelling({ limit: '20', from: startDate, to: endDate })

      if (res.status === 'success') {
        setItems(Array.isArray(res.data?.items) ? res.data.items : [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const totalQty = items.reduce(
    (sum, item) => sum + Number(item.total_qty_sold || item.total_qty || item.qty || item.total_quantity_sold || 0),
    0
  )
  const totalRevenue = items.reduce((sum, item) => sum + parseFloat(item.total_revenue || item.revenue || 0), 0)

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

      <Grid size={{ xs: 12, sm: 6 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-package text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalQty}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الكميات المباعة</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalRevenue.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>إجمالي الإيراد</Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='الأصناف الأعلى مبيعاً' />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>الصنف</TableCell>
                  <TableCell align='center'>الكمية</TableCell>
                  <TableCell align='right'>الإيراد</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align='center'><Typography variant='body2' color='text.secondary'>لا توجد بيانات</Typography></TableCell></TableRow>
                ) : (
                  items.map((item: any, index: number) => (
                    <TableRow key={item.menu_item_id || item.id || index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.item_name || item.name || item.product_name || '-'}</TableCell>
                      <TableCell align='center'>
                        {Number(item.total_qty_sold || item.total_qty || item.qty || item.total_quantity_sold || 0)}
                      </TableCell>
                      <TableCell align='right'>{parseFloat(item.total_revenue || item.revenue || 0).toFixed(2)}</TableCell>
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

export default TopProducts
