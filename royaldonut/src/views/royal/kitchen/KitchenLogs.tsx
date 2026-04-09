'use client'

import { useEffect, useState, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
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
import Tooltip from '@mui/material/Tooltip'

import { stockApi } from '@/services/api'

const TRANSACTION_TYPES = [
  { value: 'purchase', label: 'شراء / توريد', color: 'success' as const },
  { value: 'waste', label: 'هدر', color: 'error' as const },
  { value: 'usage', label: 'استهلاك', color: 'default' as const },
  { value: 'adjustment', label: 'تعديل', color: 'warning' as const },
]

const getTransactionQty = (tx: any) => {
  const rawQty = tx?.qty_change ?? tx?.qty ?? tx?.quantity ?? tx?.delta_qty ?? tx?.change_qty ?? tx?.used_qty ?? tx?.amount ?? 0
  const parsed = parseFloat(String(rawQty))

  return Number.isNaN(parsed) ? 0 : parsed
}

// This page serves as stock management / transactions log for kitchen staff
const KitchenLogs = () => {
  const [stockItems, setStockItems] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add transaction dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    stock_item_id: '',
    type: 'purchase',
    qty: '',
    unit_cost: '',
    reference_note: ''
  })

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockRes, lowRes, txRes] = await Promise.all([
        stockApi.getStock(),
        stockApi.getLowStock(),
        stockApi.getTransactions()
      ])
      if (stockRes.status === 'success') setStockItems(stockRes.data?.items || [])
      if (lowRes.status === 'success') setLowStockItems(lowRes.data?.items || [])
      if (txRes.status === 'success') setTransactions(txRes.data?.transactions || [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!formData.stock_item_id || !formData.qty) return
    try {
      const qty = parseFloat(formData.qty)
      const res = await stockApi.addTransaction({
        stock_item_id: parseInt(formData.stock_item_id),
        type: formData.type as 'purchase' | 'waste' | 'adjustment',
        qty: formData.type === 'waste' ? Math.abs(qty) : qty,
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
        reference_note: formData.reference_note || undefined
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تمت العملية بنجاح', severity: 'success' })
        setDialogOpen(false)
        setFormData({ stock_item_id: '', type: 'purchase', qty: '', unit_cost: '', reference_note: '' })
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشلت العملية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'حدث خطأ', severity: 'error' })
    }
  }

  // Print stock report
  const handlePrintStock = () => {
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"/><title>تقرير المخزون</title>
      <style>body{font-family:Arial;font-size:13px;max-width:600px;margin:0 auto;padding:16px}
      h3{text-align:center}table{width:100%;border-collapse:collapse}
      td,th{padding:6px 8px;border:1px solid #ddd}th{background:#f5f5f5}
      .low{color:red;font-weight:bold}
      @media print{button{display:none}}</style></head>
      <body>
        <h3>🍩 رويال دونتس — تقرير المخزون</h3>
        <p style="text-align:center">${new Date().toLocaleString('ar-SA')}</p>
        <table>
          <tr><th>الصنف</th><th>الوحدة</th><th>الكمية الحالية</th><th>الحد الأدنى</th><th>الحالة</th></tr>
          ${stockItems.map(item => `
            <tr class="${parseFloat(item.current_qty) <= parseFloat(item.min_qty) ? 'low' : ''}">
              <td>${item.name}</td>
              <td>${item.unit}</td>
              <td>${parseFloat(item.current_qty).toFixed(3)}</td>
              <td>${parseFloat(item.min_qty).toFixed(3)}</td>
              <td>${parseFloat(item.current_qty) <= parseFloat(item.min_qty) ? '⚠️ منخفض' : '✓ كافٍ'}</td>
            </tr>`).join('')}
        </table>
        <script>window.print();</script>
      </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  return (
    <>
      <Grid container spacing={6}>
        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
              <Typography variant='subtitle2' gutterBottom>
                تنبيه: {lowStockItems.length} صنف تحت الحد الأدنى
              </Typography>
              <Typography variant='body2'>
                {lowStockItems.map((i: any) => `${i.name} (${parseFloat(i.current_qty).toFixed(1)} ${i.unit} متبقي)`).join(' · ')}
              </Typography>
            </Alert>
          </Grid>
        )}

        {/* Current Stock */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title='المخزون الحالي'
              action={
                <Box className='flex gap-2'>
                  <Tooltip title='طباعة التقرير'>
                    <Button size='small' variant='outlined' onClick={handlePrintStock} startIcon={<i className='tabler-printer' />}>
                      طباعة
                    </Button>
                  </Tooltip>
                  <Button
                    variant='contained' size='small'
                    startIcon={<i className='tabler-plus' />}
                    onClick={() => setDialogOpen(true)}
                  >
                    إضافة حركة
                  </Button>
                </Box>
              }
            />
            <Divider />
            <TableContainer sx={{ maxHeight: 450 }}>
              <Table stickyHeader size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>الصنف</TableCell>
                    <TableCell>الوحدة</TableCell>
                    <TableCell align='right'>الكمية الحالية</TableCell>
                    <TableCell align='right'>الحد الأدنى</TableCell>
                    <TableCell align='center'>الحالة</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stockItems.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد أصناف</Typography>
                    </TableCell></TableRow>
                  ) : (
                    stockItems.map((item: any) => {
                      const isLow = parseFloat(item.current_qty) <= parseFloat(item.min_qty)
                      return (
                        <TableRow key={item.id}>
                          <TableCell><Typography variant='body2'>{item.name}</Typography></TableCell>
                          <TableCell><Typography variant='caption' color='text.secondary'>{item.unit}</Typography></TableCell>
                          <TableCell align='right'>
                            <Typography variant='body2' fontWeight={600} color={isLow ? 'error' : 'inherit'}>
                              {parseFloat(item.current_qty).toFixed(3)}
                            </Typography>
                          </TableCell>
                          <TableCell align='right'>
                            <Typography variant='caption' color='text.secondary'>
                              {parseFloat(item.min_qty).toFixed(3)}
                            </Typography>
                          </TableCell>
                          <TableCell align='center'>
                            <Chip
                              label={isLow ? 'منخفض' : 'كافٍ'}
                              size='small'
                              color={isLow ? 'error' : 'success'}
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

        {/* Transactions Log */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title='سجل حركات المخزون'
              subheader='آخر العمليات'
              action={
                <Button size='small' variant='outlined' onClick={fetchData} startIcon={<i className='tabler-refresh' />}>
                  تحديث
                </Button>
              }
            />
            <Divider />
            <TableContainer sx={{ maxHeight: 450 }}>
              <Table stickyHeader size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>الصنف</TableCell>
                    <TableCell>النوع</TableCell>
                    <TableCell align='right'>الكمية</TableCell>
                    <TableCell>ملاحظة</TableCell>
                    <TableCell>التاريخ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align='center'>
                      <Typography variant='body2' color='text.secondary'>لا توجد حركات</Typography>
                    </TableCell></TableRow>
                  ) : (
                    transactions.slice(0, 50).map((tx: any) => {
                      const typeInfo = TRANSACTION_TYPES.find(t => t.value === tx.type)
                      const qty = getTransactionQty(tx)

                      return (
                        <TableRow key={tx.id}>
                          <TableCell>{tx.stock_name || `#${tx.stock_item_id}`}</TableCell>
                          <TableCell>
                            <Chip label={typeInfo?.label || tx.type} size='small' color={typeInfo?.color || 'default'} />
                          </TableCell>
                          <TableCell align='right'>
                            <Typography
                              variant='body2'
                              color={qty < 0 ? 'error' : qty > 0 ? 'success.main' : 'text.primary'}
                              fontWeight={600}
                            >
                              {qty > 0 ? '+' : ''}
                              {qty.toFixed(3)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='caption' color='text.secondary'>
                              {tx.reference_note || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='caption' color='text.secondary'>
                              {tx.created_at ? new Date(tx.created_at).toLocaleDateString('ar-SA') : '—'}
                            </Typography>
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
      </Grid>

      {/* Add Transaction Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>إضافة حركة مخزون</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important', overflow: 'visible' }}>
          <TextField
            select label='الصنف'
            value={formData.stock_item_id}
            onChange={e => setFormData({ ...formData, stock_item_id: e.target.value })}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 250 } } } } }}
          >
            {stockItems.map((item: any) => (
              <MenuItem key={item.id} value={item.id.toString()}>
                {item.name} — الحالي: {parseFloat(item.current_qty).toFixed(3)} {item.unit}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select label='نوع الحركة'
            value={formData.type}
            onChange={e => setFormData({ ...formData, type: e.target.value })}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false } } }}
          >
            {TRANSACTION_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={`الكمية${formData.type === 'adjustment' ? ' (موجبة للزيادة، سالبة للنقص)' : ''}`}
            type='number'
            value={formData.qty}
            onChange={e => setFormData({ ...formData, qty: e.target.value })}
            fullWidth
            inputProps={{ step: '0.001' }}
          />

          {formData.type === 'purchase' && (
            <TextField
              label='سعر الوحدة (ج.م) — اختياري'
              type='number'
              value={formData.unit_cost}
              onChange={e => setFormData({ ...formData, unit_cost: e.target.value })}
              fullWidth
              inputProps={{ step: '0.01', min: '0' }}
            />
          )}

          <TextField
            label='ملاحظة / مرجع'
            value={formData.reference_note}
            onChange={e => setFormData({ ...formData, reference_note: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' onClick={handleSubmit} disabled={!formData.stock_item_id || !formData.qty}>
            حفظ
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default KitchenLogs
