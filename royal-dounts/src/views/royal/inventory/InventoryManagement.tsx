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

import { inventoryApi, productApi, kitchenApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

const InventoryManagement = () => {
  const t = useDictionary()
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [lowStock, setLowStock] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ product_id: '', adjustment_type: 'add', quantity: '', reason: '', notes: '' })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [adjRes, prodRes, stockRes] = await Promise.all([
        inventoryApi.getAdjustments(),
        productApi.getAll(),
        kitchenApi.getLowStockProducts()
      ])
      if (adjRes.status === 'success') setAdjustments(Array.isArray(adjRes.data) ? adjRes.data : adjRes.data?.adjustments || [])
      if (prodRes.status === 'success') setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.products || [])
      if (stockRes.status === 'success') setLowStock(Array.isArray(stockRes.data) ? stockRes.data : stockRes.data?.products || [])
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    try {
      const res = await inventoryApi.adjust({
        product_id: parseInt(formData.product_id),
        adjustment_type: formData.adjustment_type as 'add' | 'subtract',
        quantity: parseInt(formData.quantity),
        reason: formData.reason,
        notes: formData.notes || undefined
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.inventory.inventoryAdjusted, severity: 'success' })
        setDialogOpen(false)
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || t.inventory.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.inventory.failed, severity: 'error' })
    }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  return (
    <>
      <Grid container spacing={6}>
        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity='warning'>
              <Typography variant='subtitle2'>{t.inventory.lowStockAlert}: {lowStock.map(p => `${p.name} (${p.stock})`).join(', ')}</Typography>
            </Alert>
          </Grid>
        )}

        {/* Current Stock */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader
              title={t.inventory.currentStock}
              action={
                <Button variant='contained' size='small' startIcon={<i className='tabler-plus' />} onClick={() => setDialogOpen(true)}>
                  {t.inventory.adjustStock}
                </Button>
              }
            />
            <Divider />
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.inventory.tableProduct}</TableCell>
                    <TableCell align='right'>{t.inventory.tableStock}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell align='right'>
                        <Chip label={p.stock} size='small' color={p.stock <= 5 ? 'error' : p.stock <= 20 ? 'warning' : 'success'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Adjustments History */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title={t.inventory.recentAdjustments} />
            <Divider />
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table stickyHeader size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.inventory.tableProduct}</TableCell>
                    <TableCell>{t.inventory.tableType}</TableCell>
                    <TableCell>{t.inventory.tableQty}</TableCell>
                    <TableCell>{t.inventory.tableReason}</TableCell>
                    <TableCell>{t.inventory.tableDate}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {adjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align='center'>
                        <Typography variant='body2' color='text.secondary'>{t.inventory.noAdjustments}</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    adjustments.map((adj: any) => (
                      <TableRow key={adj.id}>
                        <TableCell>{adj.product_name || `#${adj.product_id}`}</TableCell>
                        <TableCell>
                          <Chip label={adj.adjustment_type} size='small' color={adj.adjustment_type === 'add' ? 'success' : 'error'} />
                        </TableCell>
                        <TableCell>{adj.quantity}</TableCell>
                        <TableCell>{adj.reason}</TableCell>
                        <TableCell>{adj.created_at ? new Date(adj.created_at).toLocaleDateString() : '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t.inventory.adjustInventory}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important', overflow: 'visible' }}>
          <TextField select label={t.inventory.labelProduct} value={formData.product_id} onChange={e => setFormData({ ...formData, product_id: e.target.value })} fullWidth slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}>
            {products.map((p: any) => <MenuItem key={p.id} value={p.id.toString()}>{p.name} ({t.common.stock}: {p.stock})</MenuItem>)}
          </TextField>
          <TextField select label={t.inventory.labelType} value={formData.adjustment_type} onChange={e => setFormData({ ...formData, adjustment_type: e.target.value })} fullWidth slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}>
            <MenuItem value='add'>{t.inventory.typeAddStock}</MenuItem>
            <MenuItem value='subtract'>{t.inventory.typeSubtractStock}</MenuItem>
          </TextField>
          <TextField label={t.inventory.labelQuantity} type='number' value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} fullWidth />
          <TextField label={t.inventory.labelReason} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} fullWidth required />
          <TextField label={t.inventory.labelNotes} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} fullWidth multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleSubmit}>{t.common.confirm}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default InventoryManagement
