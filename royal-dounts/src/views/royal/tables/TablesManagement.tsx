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
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'

import { tableApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

interface TableItem {
  id: number
  table_number: number
  status: 'available' | 'occupied'
}

const TablesManagement = () => {
  const t = useDictionary()
  const [tables, setTables] = useState<TableItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTable, setEditTable] = useState<TableItem | null>(null)
  const [tableNumber, setTableNumber] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingTable, setDeletingTable] = useState<TableItem | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchTables = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await tableApi.getAll()
      if (res.status === 'success') {
        setTables(Array.isArray(res.data) ? res.data : res.data?.tables || [])
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchTables() }, [fetchTables])

  const handleSubmit = async () => {
    if (!tableNumber) return
    try {
      let res
      if (editTable) {
        res = await tableApi.update(editTable.id, { table_number: parseInt(tableNumber) })
      } else {
        res = await tableApi.add({ table_number: parseInt(tableNumber) })
      }
      if (res.status === 'success') {
        setSnackbar({ open: true, message: editTable ? t.tables.tableUpdated : t.tables.tableAdded, severity: 'success' })
        setDialogOpen(false)
        fetchTables()
      } else {
        setSnackbar({ open: true, message: res.message || t.tables.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.common.anErrorOccurred, severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deletingTable) return
    try {
      const res = await tableApi.delete(deletingTable.id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.tables.tableDeleted, severity: 'success' })
        fetchTables()
      } else {
        setSnackbar({ open: true, message: res.message || t.tables.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.tables.failedToDelete, severity: 'error' })
    }
    setDeleteConfirmOpen(false)
    setDeletingTable(null)
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  const available = tables.filter(t => t.status === 'available').length
  const occupied = tables.filter(t => t.status === 'occupied').length

  return (
    <>
      <Card>
        <CardHeader
          title={t.tables.title}
          subheader={`${tables.length} ${t.tables.tables} · ${available} ${t.tables.available} · ${occupied} ${t.tables.occupied}`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setEditTable(null); setTableNumber(''); setDialogOpen(true) }}>
              {t.tables.addTable}
            </Button>
          }
        />
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.tables.tableId}</TableCell>
                <TableCell>{t.tables.tableNumber}</TableCell>
                <TableCell>{t.tables.tableStatus}</TableCell>
                <TableCell align='right'>{t.tables.tableActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.tables.noTablesFound}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tables.map(table => (
                  <TableRow key={table.id}>
                    <TableCell>{table.id}</TableCell>
                    <TableCell>{t.tables.tableDisplay} #{table.table_number}</TableCell>
                    <TableCell>
                      <Chip
                        label={table.status}
                        size='small'
                        color={table.status === 'available' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell align='right'>
                      <IconButton size='small' color='primary' onClick={() => { setEditTable(table); setTableNumber(String(table.table_number)); setDialogOpen(true) }}>
                        <i className='tabler-edit text-lg' />
                      </IconButton>
                      <IconButton size='small' color='error' onClick={() => { setDeletingTable(table); setDeleteConfirmOpen(true) }}>
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
        <DialogTitle>{editTable ? t.tables.editTable : t.tables.addTable}</DialogTitle>
        <DialogContent>
          <TextField
            label={t.tables.labelTableNumber}
            type='number'
            value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            fullWidth
            autoFocus
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleSubmit}>{editTable ? t.common.update : t.common.add}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t.tables.deleteTable}</DialogTitle>
        <DialogContent>
          <Typography>{t.tables.confirmDelete} #{deletingTable?.table_number}?</Typography>
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

export default TablesManagement
