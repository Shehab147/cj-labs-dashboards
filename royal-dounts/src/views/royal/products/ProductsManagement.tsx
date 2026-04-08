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
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'

import { productApi, categoryApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

interface Product {
  id: number
  name: string
  price: number
  cost: number
  category_id: number
  category_name?: string
  stock: number
  description?: string
  created_at?: string
}

interface Category {
  id: number
  name: string
}

const ProductsManagement = () => {
  const t = useDictionary()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const [formData, setFormData] = useState({ name: '', price: '', cost: '', category_id: '', stock: '', description: '' })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [prodRes, catRes] = await Promise.all([productApi.getAll(), categoryApi.getAll()])
      if (prodRes.status === 'success') {
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.products || [])
      }
      if (catRes.status === 'success') {
        setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data?.categories || [])
      }
    } catch {
      setError(t.products.failedToLoad)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleOpenAdd = () => {
    setEditProduct(null)
    setFormData({ name: '', price: '', cost: '', category_id: categories[0]?.id?.toString() || '', stock: '0', description: '' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (product: Product) => {
    setEditProduct(product)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      cost: product.cost?.toString() || '',
      category_id: product.category_id.toString(),
      stock: product.stock.toString(),
      description: product.description || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const data = {
        name: formData.name,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost) || 0,
        category_id: parseInt(formData.category_id),
        stock: parseInt(formData.stock),
        description: formData.description
      }

      let res
      if (editProduct) {
        res = await productApi.update(editProduct.id, data)
      } else {
        res = await productApi.add(data)
      }

      if (res.status === 'success') {
        setSnackbar({ open: true, message: editProduct ? t.products.productUpdated : t.products.productAdded, severity: 'success' })
        setDialogOpen(false)
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || t.common.operationFailed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.common.anErrorOccurred, severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return
    try {
      const res = await productApi.delete(deletingProduct.id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.products.productDeleted, severity: 'success' })
        fetchData()
      } else {
        setSnackbar({ open: true, message: res.message || t.products.failedToDelete, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.products.failedToDelete, severity: 'error' })
    }
    setDeleteConfirmOpen(false)
    setDeletingProduct(null)
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.products.title}
          subheader={`${products.length} ${t.products.title} · ${t.products.subheader}`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={handleOpenAdd}>
              {t.products.addProduct}
            </Button>
          }
        />
        <Divider />
        {error && <Alert severity='error' className='m-4'>{error}</Alert>}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.products.tableId}</TableCell>
                <TableCell>{t.products.tableName}</TableCell>
                <TableCell>{t.products.tableCategory}</TableCell>
                <TableCell>{t.products.tablePrice}</TableCell>
                <TableCell>{t.products.tableCost}</TableCell>
                <TableCell>{t.products.tableStock}</TableCell>
                <TableCell>{t.products.tableDescription}</TableCell>
                <TableCell align='right'>{t.products.tableActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.products.noProductsFound}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                products.map(product => {
                  const cat = categories.find(c => c.id === product.category_id)
                  return (
                    <TableRow key={product.id}>
                      <TableCell>{product.id}</TableCell>
                      <TableCell>
                        <Typography variant='subtitle2'>{product.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={cat?.name || product.category_name || t.products.unknownCategory} size='small' variant='outlined' />
                      </TableCell>
                      <TableCell>{parseFloat(String(product.price)).toFixed(2)}</TableCell>
                      <TableCell>{parseFloat(String(product.cost || 0)).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          label={product.stock}
                          size='small'
                          color={product.stock <= 5 ? 'error' : product.stock <= 20 ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' className='max-w-[200px] truncate'>
                          {product.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => handleOpenEdit(product)} color='primary'>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                        <IconButton
                          size='small'
                          onClick={() => { setDeletingProduct(product); setDeleteConfirmOpen(true) }}
                          color='error'
                        >
                          <i className='tabler-trash text-lg' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editProduct ? t.products.editProduct : t.products.addNewProduct}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important', overflow: 'visible' }}>
          <TextField
            label={t.products.labelName}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={t.products.labelPrice}
            type='number'
            value={formData.price}
            onChange={e => setFormData({ ...formData, price: e.target.value })}
            fullWidth
            required
            inputProps={{ step: '0.01' }}
          />
          <TextField
            label={t.products.labelCost}
            type='number'
            value={formData.cost}
            onChange={e => setFormData({ ...formData, cost: e.target.value })}
            fullWidth
            required
            inputProps={{ step: '0.01' }}
          />
          <TextField
            select
            label={t.products.labelCategory}
            value={formData.category_id}
            onChange={e => setFormData({ ...formData, category_id: e.target.value })}
            fullWidth
            required
            slotProps={{
              select: {
                MenuProps: {
                  disablePortal: false,
                  PaperProps: {
                    style: { maxHeight: 200 }
                  }
                }
              }
            }}
          >
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id.toString()}>{cat.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t.products.labelStock}
            type='number'
            value={formData.stock}
            onChange={e => setFormData({ ...formData, stock: e.target.value })}
            fullWidth
          />
          <TextField
            label={t.products.labelDescription}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleSubmit}>
            {editProduct ? t.common.update : t.products.addProduct}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t.products.deleteProduct}</DialogTitle>
        <DialogContent>
          <Typography>{t.products.confirmDelete} <strong>{deletingProduct?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>{t.common.delete}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default ProductsManagement
