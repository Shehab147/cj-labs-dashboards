'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import { refundApi } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

const RefundsManagement = () => {
  const t = useDictionary()
  const [refunds, setRefunds] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ order_id: '', amount: '', reason: '' })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchRefunds = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await refundApi.getAll()
      if (res.status === 'success') {
        setRefunds(Array.isArray(res.data) ? res.data : res.data?.refunds || res.data?.returns || [])
      }
    } catch {} finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchRefunds() }, [fetchRefunds])

  const handleSubmit = async () => {
    try {
      const res = await refundApi.add({
        order_id: parseInt(formData.order_id),
        amount: parseFloat(formData.amount),
        reason: formData.reason
      })
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.refunds.refundProcessed, severity: 'success' })
        setDialogOpen(false)
        fetchRefunds()
      } else {
        setSnackbar({ open: true, message: res.message || t.refunds.failed, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.refunds.failed, severity: 'error' })
    }
  }

  if (isLoading) return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>

  return (
    <>
      <Card>
        <CardHeader
          title={t.refunds.title}
          subheader={`${refunds.length} ${t.refunds.refundCount}`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setFormData({ order_id: '', amount: '', reason: '' }); setDialogOpen(true) }}>
              {t.refunds.processRefund}
            </Button>
          }
        />
        <Divider />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.refunds.tableId}</TableCell>
                <TableCell>{t.refunds.tableOrderId}</TableCell>
                <TableCell>{t.refunds.tableAmount}</TableCell>
                <TableCell>{t.refunds.tableReason}</TableCell>
                <TableCell>{t.refunds.tableDate}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refunds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.refunds.noRefunds}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                refunds.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>#{r.order_id}</TableCell>
                    <TableCell>
                      <Chip label={parseFloat(r.amount).toFixed(2)} size='small' color='error' />
                    </TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{t.refunds.dialogTitle}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pt-4'>
          <TextField label={t.refunds.labelOrderId} type='number' value={formData.order_id} onChange={e => setFormData({ ...formData, order_id: e.target.value })} fullWidth required />
          <TextField label={t.refunds.labelAmount} type='number' value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} fullWidth required inputProps={{ step: '0.01' }} />
          <TextField label={t.refunds.labelReason} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} fullWidth required multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' color='error' onClick={handleSubmit}>{t.refunds.processRefund}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default RefundsManagement
