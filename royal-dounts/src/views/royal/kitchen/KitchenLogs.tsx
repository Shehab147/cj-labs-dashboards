'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'

import { kitchenApi, productApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'
import { formatLocalDateTime } from '@/utils/timezone'

const KitchenLogs = () => {
  const t = useDictionary()
  const [logs, setLogs] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [dailySummary, setDailySummary] = useState<any>(null)
  const [lowStock, setLowStock] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [logsRes, productsRes, summaryRes, stockRes] = await Promise.all([
        kitchenApi.getLogs(),
        productApi.getAll(),
        kitchenApi.getDailySummary(),
        kitchenApi.getLowStockProducts()
      ])
      if (logsRes.status === 'success') setLogs(Array.isArray(logsRes.data) ? logsRes.data : logsRes.data?.logs || [])
      if (productsRes.status === 'success') setProducts(Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.products || [])
      if (summaryRes.status === 'success') setDailySummary(summaryRes.data)
      if (stockRes.status === 'success') setLowStock(Array.isArray(stockRes.data) ? stockRes.data : stockRes.data?.products || [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAddLog = async () => {
    if (!productId || !quantity) return
    try {
      const res = await kitchenApi.addLog({ product_id: parseInt(productId), quantity: parseInt(quantity) })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.kitchenLogs.logAdded, severity: 'success' })
        setAddLogOpen(false)
        setProductId('')
        setQuantity('')
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || t.kitchenLogs.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.kitchenLogs.failedToAddLog, severity: 'error' })
    }
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Summary Cards */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title={t.kitchenLogs.todaysProduction} />
            <Divider />
            <Box className='p-4'>
              <Typography variant='h3' color='primary' align='center'>
                {dailySummary?.total_produced || dailySummary?.total || 0}
              </Typography>
              <Typography variant='body2' color='text.secondary' align='center'>{t.kitchenLogs.itemsProducedToday}</Typography>
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title={t.kitchenLogs.lowStockItems} />
            <Divider />
            <Box className='p-4'>
              {lowStock.length === 0 ? (
                <Typography variant='body2' color='text.secondary' align='center'>{t.kitchenLogs.allStockLevelsOk}</Typography>
              ) : (
                lowStock.slice(0, 5).map((p: any) => (
                  <Box key={p.id} className='flex justify-between py-1'>
                    <Typography variant='body2'>{p.name}</Typography>
                    <Chip label={`${p.stock} ${t.kitchenLogs.stockLeft}`} size='small' color='error' />
                  </Box>
                ))
              )}
            </Box>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card className='flex flex-col justify-center items-center h-full'>
            <Button
              variant='contained'
              size='large'
              startIcon={<i className='tabler-plus' />}
              onClick={() => setAddLogOpen(true)}
              className='m-6'
            >
              {t.kitchenLogs.addProductionLog}
            </Button>
          </Card>
        </Grid>

        {/* Logs Table */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title={t.kitchenLogs.title} subheader={t.kitchenLogs.subheader} />
            <Divider />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.kitchenLogs.tableId}</TableCell>
                    <TableCell>{t.kitchenLogs.tableProduct}</TableCell>
                    <TableCell>{t.kitchenLogs.tableQuantity}</TableCell>
                    <TableCell>{t.kitchenLogs.tableDate}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align='center'>
                        <Typography variant='body2' color='text.secondary'>{t.kitchenLogs.noLogsFound}</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.id}</TableCell>
                        <TableCell>{log.product_name || `${t.kitchenLogs.productFallback} #${log.product_id}`}</TableCell>
                        <TableCell>
                          <Chip label={`+${log.quantity}`} size='small' color='success' />
                        </TableCell>
                        <TableCell>{log.created_at ? formatLocalDateTime(log.created_at) : '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      {/* Add Log Dialog */}
      <Dialog
        open={addLogOpen}
        onClose={() => setAddLogOpen(false)}
        maxWidth='sm'
        fullWidth
        sx={{ '& .MuiDialog-paper': { minHeight: 380 } }}
      >
        <DialogTitle>{t.kitchenLogs.dialogTitle}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important' }}>
          <TextField
            select
            label={t.kitchenLogs.labelProduct}
            value={productId}
            onChange={e => setProductId(e.target.value)}
            fullWidth
            slotProps={{
              select: {
                MenuProps: {
                  PaperProps: { style: { maxHeight: 400 } },
                  slotProps: { paper: { style: { maxHeight: 400 } } }
                }
              }
            }}
          >
            {products.map((p: any) => (
              <MenuItem key={p.id} value={p.id.toString()} sx={{ minHeight: 48, fontSize: '1rem' }}>{p.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t.kitchenLogs.labelQuantityProduced}
            type='number'
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddLogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleAddLog}>{t.common.add}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default KitchenLogs
