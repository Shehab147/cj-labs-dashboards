'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
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
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'

import { categoryApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

interface Category {
  id: number
  name: string
}

const CategoriesManagement = () => {
  const t = useDictionary()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await categoryApi.getAll()
      if (res.status === 'success') {
        setCategories(Array.isArray(res.data) ? res.data : res.data?.categories || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const handleSubmit = async () => {
    if (!name.trim()) return
    try {
      let res
      if (editCat) {
        res = await categoryApi.update(editCat.id, { name })
      } else {
        res = await categoryApi.add({ name })
      }
      if (res.status === 'success') {
        setSnackbar({ open: true, message: editCat ? t.categories.categoryUpdated : t.categories.categoryAdded, severity: 'success' })
        setDialogOpen(false)
        fetchCategories()
      } else {
        setSnackbar({ open: true, message: res.message || t.common.operationFailed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.common.anErrorOccurred, severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deletingCat) return
    try {
      const res = await categoryApi.delete(deletingCat.id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.categories.categoryDeleted, severity: 'success' })
        fetchCategories()
      } else {
        setSnackbar({ open: true, message: res.message || t.categories.failedToDelete, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.categories.failedToDelete, severity: 'error' })
    }
    setDeleteConfirmOpen(false)
    setDeletingCat(null)
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.categories.title}
          subheader={`${categories.length} ${t.categories.title} (${t.categories.subheader})`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setEditCat(null); setName(''); setDialogOpen(true) }}>
              {t.categories.addCategory}
            </Button>
          }
        />
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.categories.tableId}</TableCell>
                <TableCell>{t.categories.tableName}</TableCell>
                <TableCell align='right'>{t.categories.tableActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.categories.noCategoriesFound}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell>{cat.id}</TableCell>
                    <TableCell><Typography variant='subtitle2'>{cat.name}</Typography></TableCell>
                    <TableCell align='right'>
                      <IconButton size='small' color='primary' onClick={() => { setEditCat(cat); setName(cat.name); setDialogOpen(true) }}>
                        <i className='tabler-edit text-lg' />
                      </IconButton>
                      <IconButton size='small' color='error' onClick={() => { setDeletingCat(cat); setDeleteConfirmOpen(true) }}>
                        <i className='tabler-trash text-lg' />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{editCat ? t.categories.editCategory : t.categories.addCategory}</DialogTitle>
        <DialogContent>
          <TextField
            label={t.categories.labelName}
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            autoFocus
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleSubmit}>{editCat ? t.common.update : t.common.add}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t.categories.deleteCategory}</DialogTitle>
        <DialogContent>
          <Typography>{t.categories.confirmDelete} <strong>{deletingCat?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>{t.common.delete}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default CategoriesManagement
