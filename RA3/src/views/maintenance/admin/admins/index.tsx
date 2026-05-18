'use client'

import { useCallback, useEffect, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
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
import MenuItem from '@mui/material/MenuItem'

import CustomTextField from '@core/components/mui/TextField'
import { adminApi } from '@/services/api'
import type { AdminAccount, AdminRole } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { useAuth } from '@/contexts/authContext'

type FormState = {
  id?: number
  name: string
  email: string
  password: string
  role: AdminRole
}

const empty: FormState = { name: '', email: '', password: '', role: 'admin' }

export default function AdminAdminsList() {
  const dictionary = useDictionary()
  const { admin: currentAdmin, isSuperAdmin } = useAuth()
  const [rows, setRows] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(empty)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminApi.list()

    if (res.status === 'success' && res.data?.admins) setRows(res.data.admins)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [dictionary.common.anErrorOccurred])

  useEffect(() => {
    if (isSuperAdmin) load()
    else setLoading(false)
  }, [isSuperAdmin, load])

  if (!isSuperAdmin) {
    return <Alert severity='warning'>{dictionary.common.anErrorOccurred}</Alert>
  }

  const openCreate = () => {
    setForm(empty)
    setDialogOpen(true)
  }
  const openEdit = (a: AdminAccount) => {
    setForm({ id: a.id, name: a.name, email: a.email, password: '', role: a.role })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || (!form.id && !form.password)) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    setBusy(true)
    const res = form.id
      ? await adminApi.update({
          id: form.id,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password || undefined
        })
      : await adminApi.create({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role })

    setBusy(false)

    if (res.status === 'success') {
      setDialogOpen(false)
      load()
    } else setError(res.message || dictionary.common.anErrorOccurred)
  }

  const toggle = async (a: AdminAccount) => {
    if (a.id === currentAdmin?.id) {
      setError(dictionary.admins.cannotDisableSelf)

      return
    }
    const res = await adminApi.toggleStatus(a.id)

    if (res.status === 'success') load()
    else setError(res.message || dictionary.common.anErrorOccurred)
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between flex-wrap gap-3'>
          <Typography variant='h4'>{dictionary.admins.title}</Typography>
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
            {dictionary.admins.addAdmin}
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
                  <TableCell>{dictionary.admins.tableName}</TableCell>
                  <TableCell>{dictionary.admins.tableEmail}</TableCell>
                  <TableCell>{dictionary.admins.tableRole}</TableCell>
                  <TableCell>{dictionary.admins.tableStatus}</TableCell>
                  <TableCell align='right'>{dictionary.common.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton variant='rectangular' height={28} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align='center'>
                      {dictionary.admins.noAdminsFound}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(a => (
                    <TableRow key={a.id} hover>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.email}</TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          color={a.role === 'super_admin' ? 'primary' : 'default'}
                          label={a.role === 'super_admin' ? dictionary.admins.roleSuperAdmin : dictionary.admins.roleAdmin}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          color={a.is_active ? 'success' : 'default'}
                          label={a.is_active ? dictionary.common.active : dictionary.common.inactive}
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => openEdit(a)}>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                        <IconButton size='small' onClick={() => toggle(a)} disabled={a.id === currentAdmin?.id}>
                          <i className={a.is_active ? 'tabler-toggle-right text-lg' : 'tabler-toggle-left text-lg'} />
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{form.id ? dictionary.admins.editAdmin : dictionary.admins.addAdmin}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label={dictionary.common.name} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth type='email' label={dictionary.common.email} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='password'
                label={form.id ? `${dictionary.common.password} (${dictionary.admins.passwordEditNote})` : dictionary.common.password}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth select label={dictionary.common.role} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as AdminRole }))}>
                <MenuItem value='admin'>{dictionary.admins.roleAdmin}</MenuItem>
                <MenuItem value='super_admin'>{dictionary.admins.roleSuperAdmin}</MenuItem>
              </CustomTextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submit} disabled={busy}>{dictionary.common.save}</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
