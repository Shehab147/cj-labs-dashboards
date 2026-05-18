'use client'

import { useCallback, useEffect, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import CustomTextField from '@core/components/mui/TextField'
import { geoZoneApi } from '@/services/api'
import type { GeoZone } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'

export default function AdminZonesList() {
  const dictionary = useDictionary()
  const [rows, setRows] = useState<GeoZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<{ id?: number; name: string; description: string }>({ name: '', description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await geoZoneApi.list()

    if (res.status === 'success' && res.data?.zones) setRows(res.data.zones)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm({ name: '', description: '' })
    setDialogOpen(true)
  }
  const openEdit = (z: GeoZone) => {
    setForm({ id: z.id, name: z.name, description: z.description || '' })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    setBusy(true)
    const payload = { name: form.name.trim(), description: form.description.trim() || undefined }
    const res = form.id
      ? await geoZoneApi.update({ id: form.id, ...payload })
      : await geoZoneApi.create(payload)

    setBusy(false)

    if (res.status === 'success') {
      setDialogOpen(false)
      load()
    } else setError(res.message || dictionary.common.anErrorOccurred)
  }

  const remove = async (id: number) => {
    if (!confirm(dictionary.zones.confirmDelete)) return
    const res = await geoZoneApi.delete(id)

    if (res.status === 'success') load()
    else setError(res.message || dictionary.zones.deleteFailed)
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between flex-wrap gap-3'>
          <Typography variant='h4'>{dictionary.zones.title}</Typography>
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
            {dictionary.zones.addZone}
          </Button>
        </Box>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{dictionary.zones.tableName}</TableCell>
                  <TableCell>{dictionary.zones.tableDescription}</TableCell>
                  <TableCell align='right'>{dictionary.common.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={3}>
                        <Skeleton variant='rectangular' height={28} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align='center'>
                      {dictionary.zones.noZonesFound}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(z => (
                    <TableRow key={z.id} hover>
                      <TableCell>{z.name}</TableCell>
                      <TableCell>{z.description || '—'}</TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => openEdit(z)}>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                        <IconButton size='small' color='error' onClick={() => remove(z.id)}>
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
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{form.id ? dictionary.zones.editZone : dictionary.zones.addZone}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label={dictionary.zones.tableName}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                multiline
                rows={2}
                label={dictionary.zones.tableDescription}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={busy}>
            {dictionary.common.cancel}
          </Button>
          <Button variant='contained' onClick={submit} disabled={busy}>
            {dictionary.common.save}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
