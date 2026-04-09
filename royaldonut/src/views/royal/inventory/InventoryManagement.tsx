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
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'

import { stockApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { printHtml } from '@/utils/printHtml'

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

const InventoryManagement = () => {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState(0)
  const [stockItems, setStockItems] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [stockUnits, setStockUnits] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Transaction dialog
  const [txDialogOpen, setTxDialogOpen] = useState(false)
  const [txForm, setTxForm] = useState({ stock_item_id: '', type: 'purchase', qty: '', unit_cost: '', reference_note: '' })

  // New stock item dialog (admin only)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [itemForm, setItemForm] = useState({ name: '', unit_id: '', current_qty: '', min_qty: '', cost_per_unit: '' })

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [stockRes, lowRes, txRes, unitsRes] = await Promise.all([
        isAdmin ? stockApi.getAllStock() : stockApi.getStock(),
        stockApi.getLowStock(),
        stockApi.getTransactions(),
        stockApi.getUnits()
      ])
      if (stockRes.status === 'success') setStockItems(stockRes.data?.items || [])
      if (lowRes.status === 'success') setLowStockItems(lowRes.data?.items || [])
      if (txRes.status === 'success') setTransactions(txRes.data?.transactions || [])
      if (unitsRes.status === 'success') setStockUnits(unitsRes.data?.units || [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAddTransaction = async () => {
    if (!txForm.stock_item_id || !txForm.qty) return
    try {
      const qty = parseFloat(txForm.qty)
      const res = await stockApi.addTransaction({
        stock_item_id: parseInt(txForm.stock_item_id),
        type: txForm.type as any,
        qty: txForm.type === 'waste' ? Math.abs(qty) : qty,
        unit_cost: txForm.unit_cost ? parseFloat(txForm.unit_cost) : undefined,
        reference_note: txForm.reference_note || undefined
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تمت الحركة بنجاح', severity: 'success' })
        setTxDialogOpen(false)
        setTxForm({ stock_item_id: '', type: 'purchase', qty: '', unit_cost: '', reference_note: '' })
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشلت العملية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'حدث خطأ', severity: 'error' })
    }
  }

  const handleSaveItem = async () => {
    try {
      let res
      if (editItem) {
        res = await stockApi.updateItem({
          id: editItem.id,
          name: itemForm.name,
          unit_id: parseInt(itemForm.unit_id),
          min_qty: parseFloat(itemForm.min_qty),
          cost_per_unit: parseFloat(itemForm.cost_per_unit)
        })
      } else {
        res = await stockApi.createItem({
          name: itemForm.name,
          unit_id: parseInt(itemForm.unit_id),
          current_qty: parseFloat(itemForm.current_qty) || 0,
          min_qty: parseFloat(itemForm.min_qty),
          cost_per_unit: parseFloat(itemForm.cost_per_unit)
        })
      }
      if (res.status === 'success') {
        setSnackbar({ open: true, message: editItem ? 'تم التحديث' : 'تمت الإضافة', severity: 'success' })
        setItemDialogOpen(false)
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشلت العملية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'حدث خطأ', severity: 'error' })
    }
  }

  const handleToggleItem = async (id: number) => {
    try {
      const res = await stockApi.toggleItem(id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: 'تم تغيير الحالة', severity: 'success' })
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'فشل', severity: 'error' })
    }
  }

  // Print
  const handlePrint = () => {
    const html = `
      <html dir="rtl"><head><meta charset="utf-8"/><title>تقرير المخزون</title>
      <style>body{font-family:Arial;font-size:13px;max-width:700px;margin:0 auto;padding:16px}
      h3{text-align:center}table{width:100%;border-collapse:collapse}
      td,th{padding:6px 8px;border:1px solid #ddd}th{background:#f5f5f5}
      .low{color:red}@media print{button{display:none}}</style></head>
      <body>
        <h3>🍩 رويال دونتس — تقرير المخزون التفصيلي</h3>
        <p style="text-align:center">${new Date().toLocaleString('ar-SA')}</p>
        <table>
          <tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية الحالية</th><th>الحد الأدنى</th><th>التكلفة / وحدة</th><th>الحالة</th></tr>
          ${stockItems.map((item, i) => `
            <tr class="${parseFloat(item.current_qty) <= parseFloat(item.min_qty) ? 'low' : ''}">
              <td>${i + 1}</td>
              <td>${item.name}</td>
              <td>${item.unit}</td>
              <td>${parseFloat(item.current_qty).toFixed(3)}</td>
              <td>${parseFloat(item.min_qty).toFixed(3)}</td>
              <td>${parseFloat(item.cost_per_unit).toFixed(2)}</td>
              <td>${parseFloat(item.current_qty) <= parseFloat(item.min_qty) ? '⚠️ منخفض' : item.is_active ? '✓ نشط' : '— غير نشط'}</td>
            </tr>`).join('')}
        </table>
        <script>window.print();</script>
      </body></html>`
    printHtml(html)
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  return (
    <>
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Alert severity='warning' className='mb-4' icon={<i className='tabler-alert-triangle' />}>
          <Typography variant='subtitle2'>
            تنبيه مخزون منخفض: {lowStockItems.map((i: any) => `${i.name} (${parseFloat(i.current_qty).toFixed(1)} ${i.unit})`).join(' · ')}
          </Typography>
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} className='mb-4'>
        <Tab label='المخزون الحالي' />
        <Tab label='سجل الحركات' />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardHeader
            title='إدارة المخزون'
            subheader={`${stockItems.length} صنف`}
            action={
              <Box className='flex gap-2'>
                <Button size='small' variant='outlined' onClick={handlePrint} startIcon={<i className='tabler-printer' />}>
                  طباعة
                </Button>
                <Button size='small' variant='outlined' startIcon={<i className='tabler-plus' />}
                  onClick={() => { setTxDialogOpen(true) }}>
                  حركة مخزون
                </Button>
                {isAdmin && (
                  <Button size='small' variant='contained' startIcon={<i className='tabler-plus' />}
                    onClick={() => { setEditItem(null); setItemForm({ name: '', unit_id: '', current_qty: '', min_qty: '', cost_per_unit: '' }); setItemDialogOpen(true) }}>
                    صنف جديد
                  </Button>
                )}
              </Box>
            }
          />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>الصنف</TableCell>
                  <TableCell>الوحدة</TableCell>
                  <TableCell align='right'>الكمية الحالية</TableCell>
                  <TableCell align='right'>الحد الأدنى</TableCell>
                  <TableCell align='right'>التكلفة / وحدة</TableCell>
                  <TableCell align='center'>الحالة</TableCell>
                  {isAdmin && <TableCell align='right'>إجراءات</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {stockItems.length === 0 ? (
                  <TableRow><TableCell colSpan={isAdmin ? 7 : 6} align='center'>
                    <Typography variant='body2' color='text.secondary'>لا توجد أصناف</Typography>
                  </TableCell></TableRow>
                ) : (
                  stockItems.map((item: any) => {
                    const isLow = parseFloat(item.current_qty) <= parseFloat(item.min_qty)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant='body2' component='div' className='flex items-center gap-2' fontWeight={500}
                            color={!item.is_active ? 'text.disabled' : 'inherit'}>
                            {item.name}
                            {!item.is_active && <Chip label='غير نشط' size='small' />}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant='caption' color='text.secondary'>{item.unit}</Typography></TableCell>
                        <TableCell align='right'>
                          <Typography variant='body2' fontWeight={600} color={isLow ? 'error' : 'inherit'}>
                            {parseFloat(item.current_qty).toFixed(3)}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Typography variant='caption' color='text.secondary'>{parseFloat(item.min_qty).toFixed(3)}</Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Typography variant='caption'>{parseFloat(item.cost_per_unit).toFixed(2)}</Typography>
                        </TableCell>
                        <TableCell align='center'>
                          <Chip label={isLow ? 'منخفض' : 'كافٍ'} size='small' color={isLow ? 'error' : 'success'} />
                        </TableCell>
                        {isAdmin && (
                          <TableCell align='right'>
                            <Tooltip title='تعديل'>
                              <IconButton size='small' color='primary' onClick={() => {
                                setEditItem(item)
                                setItemForm({
                                  name: item.name,
                                  unit_id: String(stockUnits.find((u: any) => u.name === item.unit)?.id || ''),
                                  current_qty: item.current_qty,
                                  min_qty: item.min_qty,
                                  cost_per_unit: item.cost_per_unit
                                })
                                setItemDialogOpen(true)
                              }}>
                                <i className='tabler-edit text-lg' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={item.is_active ? 'تعطيل' : 'تفعيل'}>
                              <IconButton size='small' color={item.is_active ? 'warning' : 'success'}
                                onClick={() => handleToggleItem(item.id)}>
                                <i className={`tabler-${item.is_active ? 'eye-off' : 'eye'} text-lg`} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
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
          <CardHeader
            title='سجل حركات المخزون'
            action={
              <Button size='small' variant='outlined' onClick={fetchData} startIcon={<i className='tabler-refresh' />}>
                تحديث
              </Button>
            }
          />
          <Divider />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>الصنف</TableCell>
                  <TableCell>النوع</TableCell>
                  <TableCell align='right'>الكمية</TableCell>
                  <TableCell align='right'>سعر الوحدة</TableCell>
                  <TableCell>المرجع</TableCell>
                  <TableCell>التاريخ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align='center'>
                    <Typography variant='body2' color='text.secondary'>لا توجد حركات</Typography>
                  </TableCell></TableRow>
                ) : (
                  transactions.map((tx: any) => {
                    const typeInfo = TRANSACTION_TYPES.find(t => t.value === tx.type)
                    const qty = getTransactionQty(tx)

                    return (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.stock_name || `#${tx.stock_item_id}`}</TableCell>
                        <TableCell>
                          <Chip label={typeInfo?.label || tx.type} size='small' color={typeInfo?.color || 'default'} />
                        </TableCell>
                        <TableCell align='right'>
                          <Typography variant='body2' fontWeight={600}
                            color={qty < 0 ? 'error' : qty > 0 ? 'success.main' : 'text.primary'}>
                            {qty > 0 ? '+' : ''}
                            {qty.toFixed(3)}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          {tx.unit_cost ? parseFloat(tx.unit_cost).toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>{tx.reference_note || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {tx.created_at ? new Date(tx.created_at).toLocaleString('ar-SA') : '—'}
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
      )}

      {/* Transaction Dialog */}
      <Dialog open={txDialogOpen} onClose={() => setTxDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>إضافة حركة مخزون</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important', overflow: 'visible' }}>
          <TextField select label='الصنف' value={txForm.stock_item_id}
            onChange={e => setTxForm({ ...txForm, stock_item_id: e.target.value })}
            fullWidth slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 250 } } } } }}>
            {stockItems.filter(i => i.is_active).map((item: any) => (
              <MenuItem key={item.id} value={item.id.toString()}>
                {item.name} — {parseFloat(item.current_qty).toFixed(3)} {item.unit}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label='نوع الحركة' value={txForm.type}
            onChange={e => setTxForm({ ...txForm, type: e.target.value })}
            fullWidth slotProps={{ select: { MenuProps: { disablePortal: false } } }}>
            {TRANSACTION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <TextField label='الكمية' type='number' value={txForm.qty}
            onChange={e => setTxForm({ ...txForm, qty: e.target.value })}
            fullWidth inputProps={{ step: '0.001' }} />
          {txForm.type === 'purchase' && (
            <TextField label='سعر الوحدة (ج.م) — اختياري' type='number' value={txForm.unit_cost}
              onChange={e => setTxForm({ ...txForm, unit_cost: e.target.value })}
              fullWidth inputProps={{ step: '0.01', min: '0' }} />
          )}
          <TextField label='ملاحظة / مرجع' value={txForm.reference_note}
            onChange={e => setTxForm({ ...txForm, reference_note: e.target.value })}
            fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTxDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' onClick={handleAddTransaction}>حفظ</Button>
        </DialogActions>
      </Dialog>

      {/* Stock Item Dialog (Admin) */}
      {isAdmin && (
        <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} maxWidth='sm' fullWidth>
          <DialogTitle>{editItem ? 'تعديل صنف مخزون' : 'إضافة صنف جديد'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important', overflow: 'visible' }}>
            <TextField label='اسم الصنف' value={itemForm.name}
              onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
              fullWidth required />
            <TextField select label='الوحدة' value={itemForm.unit_id}
              onChange={e => setItemForm({ ...itemForm, unit_id: e.target.value })}
              fullWidth slotProps={{ select: { MenuProps: { disablePortal: false } } }}>
              {stockUnits.map((u: any) => <MenuItem key={u.id} value={u.id.toString()}>{u.name}</MenuItem>)}
            </TextField>
            {!editItem && (
              <TextField label='الكمية الافتتاحية' type='number' value={itemForm.current_qty}
                onChange={e => setItemForm({ ...itemForm, current_qty: e.target.value })}
                fullWidth inputProps={{ step: '0.001', min: '0' }} />
            )}
            <TextField label='الحد الأدنى للتنبيه' type='number' value={itemForm.min_qty}
              onChange={e => setItemForm({ ...itemForm, min_qty: e.target.value })}
              fullWidth inputProps={{ step: '0.001', min: '0' }} />
            <TextField label='تكلفة الوحدة (ج.م)' type='number' value={itemForm.cost_per_unit}
              onChange={e => setItemForm({ ...itemForm, cost_per_unit: e.target.value })}
              fullWidth inputProps={{ step: '0.01', min: '0' }} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setItemDialogOpen(false)}>إلغاء</Button>
            <Button variant='contained' onClick={handleSaveItem}>{editItem ? 'تحديث' : 'إضافة'}</Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default InventoryManagement
