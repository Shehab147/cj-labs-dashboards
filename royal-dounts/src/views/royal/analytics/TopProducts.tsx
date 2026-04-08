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
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'

import { analyticsApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import CustomAvatar from '@core/components/mui/Avatar'

const TopProducts = () => {
  const t = useDictionary()
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [worstProducts, setWorstProducts] = useState<any[]>([])
  const [period, setPeriod] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await analyticsApi.getTopProducts({ limit: 20 })
        if (res.status === 'success') {
          const d = res.data
          setTopProducts(Array.isArray(d) ? d : d?.top_products || d?.products || [])
          setWorstProducts(d?.worst_products || [])
          if (d?.period) setPeriod(d.period)
        }
      } catch {} finally { setIsLoading(false) }
    }
    fetchData()
  }, [])

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  const totalRevenue = topProducts.reduce((s, p) => s + parseFloat(p.revenue || 0), 0)
  const totalProfit = topProducts.reduce((s, p) => s + parseFloat(p.profit || 0), 0)
  const totalSold = topProducts.reduce((s, p) => s + (p.total_quantity_sold || 0), 0)
  const maxQty = Math.max(...topProducts.map(p => p.total_quantity_sold || 0), 1)

  return (
    <Grid container spacing={6}>
      {/* Summary Cards */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='primary' skin='light' size={48}>
              <i className='tabler-package text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalSold}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.topProducts.totalSold}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color='success' skin='light' size={48}>
              <i className='tabler-currency-dollar text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalRevenue.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.topProducts.totalRevenue}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-2 p-6'>
            <CustomAvatar variant='rounded' color={totalProfit >= 0 ? 'info' : 'error'} skin='light' size={48}>
              <i className='tabler-trending-up text-2xl' />
            </CustomAvatar>
            <Typography variant='h4'>{totalProfit.toFixed(2)}</Typography>
            <Typography variant='body2' color='text.secondary'>{t.topProducts.totalProfit}</Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Period */}
      {period && (
        <Grid size={{ xs: 12 }}>
          <Box className='flex items-center gap-2'>
            <Chip label={`${period.start_date} → ${period.end_date}`} size='small' variant='outlined' color='primary' />
          </Box>
        </Grid>
      )}

      {/* Top Products Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title={t.topProducts.title} subheader={t.topProducts.subheader} />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>{t.topProducts.colProduct}</TableCell>
                  <TableCell>{t.topProducts.colCategory}</TableCell>
                  <TableCell align='right'>{t.topProducts.colPrice}</TableCell>
                  <TableCell align='center'>{t.topProducts.colQtySold}</TableCell>
                  <TableCell>{t.topProducts.colSalesBar}</TableCell>
                  <TableCell align='right'>{t.topProducts.colRevenue}</TableCell>
                  <TableCell align='right'>{t.topProducts.colCost}</TableCell>
                  <TableCell align='right'>{t.topProducts.colProfit}</TableCell>
                  <TableCell align='center'>{t.topProducts.colOrders}</TableCell>
                  <TableCell align='center'>{t.topProducts.colStock}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align='center'>
                      <Typography variant='body2' color='text.secondary'>{t.topProducts.noData}</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((p: any) => {
                    const qty = p.total_quantity_sold || 0
                    const profit = parseFloat(p.profit || 0)
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Chip
                            label={p.rank || '-'}
                            size='small'
                            color={p.rank <= 3 ? 'primary' : 'default'}
                            variant={p.rank <= 3 ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='subtitle2'>{p.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.category} size='small' variant='tonal' />
                        </TableCell>
                        <TableCell align='right'>{parseFloat(p.price || 0).toFixed(2)}</TableCell>
                        <TableCell align='center'>
                          <Typography variant='subtitle2'>{qty}</Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <LinearProgress
                            variant='determinate'
                            value={(qty / maxQty) * 100}
                            color={p.rank <= 3 ? 'primary' : 'secondary'}
                          />
                        </TableCell>
                        <TableCell align='right'>{parseFloat(p.revenue || 0).toFixed(2)}</TableCell>
                        <TableCell align='right'>{parseFloat(p.cost || 0).toFixed(2)}</TableCell>
                        <TableCell align='right'>
                          <Chip
                            label={profit.toFixed(2)}
                            size='small'
                            color={profit >= 0 ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell align='center'>{p.orders_count || 0}</TableCell>
                        <TableCell align='center'>
                          <Chip
                            label={p.current_stock}
                            size='small'
                            color={p.current_stock <= 10 ? 'error' : p.current_stock <= 20 ? 'warning' : 'default'}
                            variant='tonal'
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>

      {/* Worst Products */}
      {worstProducts.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title={t.topProducts.worstTitle} subheader={t.topProducts.worstSubheader} />
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.topProducts.colProduct}</TableCell>
                    <TableCell align='center'>{t.topProducts.colQtySold}</TableCell>
                    <TableCell align='center'>{t.topProducts.colStock}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {worstProducts.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Typography variant='subtitle2'>{p.name}</Typography>
                      </TableCell>
                      <TableCell align='center'>
                        <Chip label={p.total_quantity_sold || 0} size='small' color='warning' />
                      </TableCell>
                      <TableCell align='center'>
                        <Chip
                          label={p.stock}
                          size='small'
                          color={p.stock <= 10 ? 'error' : p.stock <= 20 ? 'warning' : 'default'}
                          variant='tonal'
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default TopProducts
