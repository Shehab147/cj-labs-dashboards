'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Tooltip from '@mui/material/Tooltip'
import TablePagination from '@mui/material/TablePagination'

import { cafeteriaApi } from '@/services/api'
import type { CafeteriaItem } from '@/types/xstation'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/authContext'
import { i18n } from '@/configs/i18n'

interface CafeteriaListProps {
  dictionary: any
}

const CafeteriaList = ({ dictionary }: CafeteriaListProps) => {
  const { admin } = useAuth()
  const searchParams = useSearchParams()
  const params = useParams()
  const lang = (params?.lang as string) || 'en'
  const isRtl = i18n.langDirection[lang as keyof typeof i18n.langDirection] === 'rtl'
  const isSuperadmin = admin?.role === 'superadmin'

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNum = (num: number | string) => {
    if (!isRtl) return String(num)
    const arabicNumerals = '٠١٢٣٤٥٦٧٨٩'
    return String(num).replace(/[0-9]/g, d => arabicNumerals[parseInt(d)])
  }

  const [items, setItems] = useState<CafeteriaItem[]>([])
  const [lowStockItems, setLowStockItems] = useState<CafeteriaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination state
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CafeteriaItem | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost: '',
    stock: ''
  })
  const [stockUpdate, setStockUpdate] = useState({ quantity: 0, operation: 'add' as 'add' | 'set' })

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [itemsRes, lowStockRes] = await Promise.all([
        cafeteriaApi.getAll(),
        cafeteriaApi.getLowStock()
      ])

      if (itemsRes.status === 'success') {
        setItems(itemsRes.data || [])
      }
      if (lowStockRes.status === 'success') {
        setLowStockItems(lowStockRes.data || [])
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsLoading(false)
    }
  }, [dictionary])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddItem = async () => {
    try {
      setIsSubmitting(true)
      const response = await cafeteriaApi.create({
        name: formData.name,
        price: Number(formData.price),
        cost: Number(formData.cost),
        stock: Number(formData.stock)
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.cafeteria?.itemAdded || 'Item added successfully')
        setAddDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditItem = async () => {
    if (!selectedItem) return

    const itemId = selectedItem.id || (selectedItem as any)._id
    if (!itemId) {
      setError('Item ID is missing')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await cafeteriaApi.update(itemId, {
        name: formData.name,
        price: Number(formData.price),
        cost: Number(formData.cost),
        stock: Number(formData.stock)
      })

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.cafeteria?.itemUpdated || 'Item updated successfully')
        setEditDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!selectedItem) return

    const itemId = selectedItem.id || (selectedItem as any)._id
    if (!itemId) {
      setError('Item ID is missing')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await cafeteriaApi.delete(itemId)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.cafeteria?.itemDeleted || 'Item deleted successfully')
        setDeleteDialogOpen(false)
        setSelectedItem(null)
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateStock = async () => {
    if (!selectedItem) return

    const itemId = selectedItem.id || (selectedItem as any)._id
    if (!itemId) {
      setError('Item ID is missing')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await cafeteriaApi.updateStock(itemId, stockUpdate.quantity, stockUpdate.operation)

      if (response.status === 'success') {
        setSuccessMessage(dictionary?.cafeteria?.stockUpdated || 'Stock updated successfully')
        setStockDialogOpen(false)
        setSelectedItem(null)
        setStockUpdate({ quantity: 0, operation: 'add' })
        fetchData()
      } else {
        setError(response.message || dictionary?.errors?.somethingWentWrong)
      }
    } catch (err) {
      setError(dictionary?.errors?.networkError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      cost: '',
      stock: ''
    })
    setSelectedItem(null)
  }

  const getStockStatus = (item: CafeteriaItem): 'error' | 'warning' | 'success' => {
    if (item.stock === 0) return 'error'
    if (item.stock <= 10) return 'warning'
    return 'success'
  }

  const filteredItems = items.filter(item => {
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const paginatedItems = filteredItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  if (isLoading && items.length === 0) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6} dir={isRtl ? 'rtl' : 'ltr'}>
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {successMessage && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='success' onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        </Grid>
      )}

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={dictionary?.navigation?.cafeteria || 'Cafeteria'}
            subheader={`${toLocalizedNum(items.length)} ${dictionary?.cafeteria?.totalItems || 'items'}`}
            action={
              isSuperadmin && (
                <Button
                  variant='contained'
                  startIcon={<i className={`tabler-plus ${isRtl ? 'ml-2' : 'mr-2'}`} />}
                  onClick={() => setAddDialogOpen(true)}
                >
                  {dictionary?.cafeteria?.addItem || 'Add Item'}
                </Button>
              )
            }
          />
          <CardContent>
            <CustomTextField
              label={dictionary?.common?.search || 'Search'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={dictionary?.cafeteria?.searchPlaceholder || 'Search items...'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='tabler-search' />
                  </InputAdornment>
                )
              }}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='warning'>
            {toLocalizedNum(lowStockItems.length)} {dictionary?.cafeteria?.lowStockWarning || 'items are running low on stock'}
          </Alert>
        </Grid>
      )}

      {/* Items Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            {paginatedItems.length > 0 ? (
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b'>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.cafeteria?.itemName || 'Name'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.price || 'Price'}</th>
                      {isSuperadmin && (
                        <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.cost || 'Cost'}</th>
                      )}
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.stock || 'Stock'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.status || 'Status'}</th>
                      <th className={`${isRtl ? 'text-right' : 'text-start'} p-3`}>{dictionary?.common?.actions || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map(item => (
                      <tr 
                        key={item.id} 
                        className={`border-b last:border-0 ${
                          item.stock === 0 
                            ? 'bg-error-50 dark:bg-error-900/10' 
                            : item.stock <= 10 
                              ? 'bg-warning-50 dark:bg-warning-900/10' 
                              : ''
                        }`}
                      >
                        <td className='p-3'>
                          <Typography variant='body2' fontWeight={500}>
                            {item.name}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Typography variant='body2' color='success.main' fontWeight={500}>
                            {toLocalizedNum(item.price)} {dictionary?.common?.currency || 'EGP'}
                          </Typography>
                        </td>
                        {isSuperadmin && (
                          <td className='p-3'>
                            <Typography variant='body2' color='text.secondary'>
                              {toLocalizedNum(item.cost)} {dictionary?.common?.currency || 'EGP'}
                            </Typography>
                          </td>
                        )}
                        <td className='p-3'>
                          <Typography variant='body2'>
                            {toLocalizedNum(item.stock)}
                          </Typography>
                        </td>
                        <td className='p-3'>
                          <Chip
                            label={
                              item.stock === 0
                                ? dictionary?.cafeteria?.outOfStock || 'Out of Stock'
                                : item.stock <= 10
                                  ? dictionary?.cafeteria?.lowStock || 'Low Stock'
                                  : dictionary?.cafeteria?.inStock || 'In Stock'
                            }
                            color={getStockStatus(item)}
                            size='small'
                          />
                        </td>
                        <td className='p-3'>
                          <div className={`flex gap-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
                            <Tooltip title={dictionary?.cafeteria?.updateStock || 'Update Stock'}>
                              <IconButton
                                size='small'
                                onClick={() => {
                                  setSelectedItem(item)
                                  setStockUpdate({ quantity: 0, operation: 'add' })
                                  setStockDialogOpen(true)
                                }}
                              >
                                <i className='tabler-package' />
                              </IconButton>
                            </Tooltip>
                            {isSuperadmin && (
                              <>
                                <Tooltip title={dictionary?.common?.edit || 'Edit'}>
                                  <IconButton
                                    size='small'
                                    onClick={() => {
                                      setSelectedItem(item)
                                      setFormData({
                                        name: item.name,
                                        price: item.price.toString(),
                                        cost: item.cost.toString(),
                                        stock: item.stock.toString()
                                      })
                                      setEditDialogOpen(true)
                                    }}
                                  >
                                    <i className='tabler-edit' />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={dictionary?.common?.delete || 'Delete'}>
                                  <IconButton
                                    size='small'
                                    color='error'
                                    onClick={() => {
                                      setSelectedItem(item)
                                      setDeleteDialogOpen(true)
                                    }}
                                  >
                                    <i className='tabler-trash' />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className='text-center py-12'>
                <i className='tabler-coffee-off text-5xl text-textSecondary mb-3' />
                <Typography color='text.secondary'>
                  {dictionary?.cafeteria?.noItems || 'No items found'}
                </Typography>
              </div>
            )}
            {filteredItems.length > 0 && (
              <TablePagination
                component='div'
                count={filteredItems.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage={dictionary?.common?.rowsPerPage || 'Rows per page:'}
                labelDisplayedRows={({ from, to, count }) => 
                  `${toLocalizedNum(from)}-${toLocalizedNum(to)} ${dictionary?.common?.of || 'of'} ${toLocalizedNum(count)}`
                }
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Add Item Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>{dictionary?.cafeteria?.addItem || 'Add Item'}</DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.cafeteria?.itemName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <div className='grid grid-cols-2 gap-4'>
              <CustomTextField
                label={`${dictionary?.common?.price || 'Price'} (${dictionary?.common?.currency || 'EGP'})`}
                type='number'
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                fullWidth
                required
              />
              <CustomTextField
                label={`${dictionary?.common?.cost || 'Cost'} (${dictionary?.common?.currency || 'EGP'})`}
                type='number'
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                fullWidth
                required
              />
            </div>
            <CustomTextField
              label={dictionary?.cafeteria?.initialStock || 'Initial Stock'}
              type='number'
              value={formData.stock}
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              fullWidth
              required
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <Button onClick={() => setAddDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleAddItem}
            disabled={isSubmitting || !formData.name || !formData.price || !formData.cost}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.add || 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>{dictionary?.cafeteria?.editItem || 'Edit Item'}</DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <div className='flex flex-col gap-4 pt-2'>
            <CustomTextField
              label={dictionary?.cafeteria?.itemName || 'Name'}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <div className='grid grid-cols-2 gap-4'>
              <CustomTextField
                label={`${dictionary?.common?.price || 'Price'} (${dictionary?.common?.currency || 'EGP'})`}
                type='number'
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                fullWidth
                required
              />
              <CustomTextField
                label={`${dictionary?.common?.cost || 'Cost'} (${dictionary?.common?.currency || 'EGP'})`}
                type='number'
                value={formData.cost}
                onChange={e => setFormData({ ...formData, cost: e.target.value })}
                fullWidth
                required
              />
            </div>
            <CustomTextField
              label={dictionary?.common?.stock || 'Stock'}
              type='number'
              value={formData.stock}
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              fullWidth
              required
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <Button onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleEditItem}
            disabled={isSubmitting || !formData.name || !formData.price || !formData.cost}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.save || 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Stock Dialog */}
      <Dialog open={stockDialogOpen} onClose={() => setStockDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>{dictionary?.cafeteria?.updateStock || 'Update Stock'}</DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          {selectedItem && (
            <div className='flex flex-col gap-4 pt-2'>
              <Typography>
                <strong>{selectedItem.name}</strong> - {dictionary?.cafeteria?.currentStock || 'Current'}: {toLocalizedNum(selectedItem.stock)}
              </Typography>
              <CustomTextField
                select
                label={dictionary?.cafeteria?.operation || 'Operation'}
                value={stockUpdate.operation}
                onChange={e => setStockUpdate({ ...stockUpdate, operation: e.target.value as 'add' | 'set' })}
                fullWidth
              >
                <MenuItem value='add'>{dictionary?.cafeteria?.addStock || 'Add to Stock'}</MenuItem>
                <MenuItem value='set'>{dictionary?.cafeteria?.setStock || 'Set Stock to'}</MenuItem>
              </CustomTextField>
              <CustomTextField
                label={dictionary?.cafeteria?.quantity || 'Quantity'}
                type='number'
                value={stockUpdate.quantity}
                onChange={e => setStockUpdate({ ...stockUpdate, quantity: Number(e.target.value) })}
                fullWidth
                required
              />
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <Button onClick={() => setStockDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            onClick={handleUpdateStock}
            disabled={isSubmitting || stockUpdate.quantity <= 0}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.update || 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle dir={isRtl ? 'rtl' : 'ltr'}>{dictionary?.cafeteria?.deleteItem || 'Delete Item'}</DialogTitle>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <Typography>
            {dictionary?.cafeteria?.confirmDelete || 'Are you sure you want to delete this item?'}
          </Typography>
          {selectedItem && (
            <Typography variant='body2' className='mt-2'>
              <strong>{selectedItem.name}</strong>
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: isRtl ? 'row-reverse' : 'row' }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isSubmitting}>
            {dictionary?.common?.cancel || 'Cancel'}
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDeleteItem}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : dictionary?.common?.delete || 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default CafeteriaList
