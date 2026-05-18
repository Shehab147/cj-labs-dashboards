'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'

import CustomTextField from '@core/components/mui/TextField'
import { engineerApi, geoZoneApi } from '@/services/api'
import type { EngineerAccount, ExperienceLevel, GeoZone } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'

const EXP_LEVELS: ExperienceLevel[] = ['junior', 'mid', 'senior']

type FormState = {
  id?: number
  full_name: string
  phone: string
  password: string
  geo_zone_id: string
  experience_level: string
  id_card_url: string
  bio: string
}

const empty: FormState = {
  full_name: '',
  phone: '',
  password: '',
  geo_zone_id: '',
  experience_level: '',
  id_card_url: '',
  bio: ''
}

export default function AdminEngineersList() {
  const dictionary = useDictionary()
  const [rows, setRows] = useState<EngineerAccount[]>([])
  const [zones, setZones] = useState<GeoZone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(empty)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await engineerApi.list({
      status: statusFilter,
      zone_id: zoneFilter ? Number(zoneFilter) : undefined
    })

    if (res.status === 'success' && res.data?.engineers) setRows(res.data.engineers)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [statusFilter, zoneFilter, dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    geoZoneApi.list().then(r => r.status === 'success' && r.data?.zones && setZones(r.data.zones))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()

    return rows.filter(r => r.full_name.toLowerCase().includes(q) || r.phone.includes(q))
  }, [rows, search])

  const openCreate = () => {
    setForm(empty)
    setDialogOpen(true)
  }

  const openEdit = (e: EngineerAccount) => {
    setForm({
      id: e.id,
      full_name: e.full_name,
      phone: e.phone,
      password: '',
      geo_zone_id: String(e.geo_zone_id),
      experience_level: e.experience_level || '',
      id_card_url: e.id_card_url || '',
      bio: e.bio || ''
    })
    setDialogOpen(true)
  }

  const update = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.full_name || !form.phone || !form.geo_zone_id) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    if (!form.id && !form.password) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    setBusy(true)
    const base: any = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      geo_zone_id: Number(form.geo_zone_id),
      experience_level: form.experience_level || undefined,
      id_card_url: form.id_card_url.trim() || undefined,
      bio: form.bio.trim() || undefined
    }

    if (form.password) base.password = form.password
    const res = form.id
      ? await engineerApi.update({ id: form.id, ...base })
      : await engineerApi.create(base)

    setBusy(false)

    if (res.status === 'success') {
      setDialogOpen(false)
      load()
    } else setError(res.message || dictionary.engineers.updateFailed)
  }

  const toggle = async (id: number) => {
    const res = await engineerApi.toggleStatus(id)

    if (res.status === 'success') load()
    else setError(res.message || dictionary.common.anErrorOccurred)
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between flex-wrap gap-3'>
          <Typography variant='h4'>{dictionary.engineers.title}</Typography>
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
            {dictionary.engineers.addEngineer}
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
          <CardHeader title={dictionary.common.filter} />
          <Box className='p-4'>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.requests.filterZone}
                  value={zoneFilter}
                  onChange={e => setZoneFilter(e.target.value)}
                >
                  <MenuItem value=''>{dictionary.common.all}</MenuItem>
                  {zones.map(z => (
                    <MenuItem key={z.id} value={String(z.id)}>
                      {z.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  select
                  label={dictionary.common.status}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                >
                  <MenuItem value='all'>{dictionary.common.all}</MenuItem>
                  <MenuItem value='active'>{dictionary.common.active}</MenuItem>
                  <MenuItem value='inactive'>{dictionary.common.inactive}</MenuItem>
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  label={dictionary.common.search}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{dictionary.engineers.tableName}</TableCell>
                  <TableCell>{dictionary.engineers.tablePhone}</TableCell>
                  <TableCell>{dictionary.engineers.tableZone}</TableCell>
                  <TableCell>{dictionary.engineers.tableExperience}</TableCell>
                  <TableCell>{dictionary.engineers.tableActive}</TableCell>
                  <TableCell>{dictionary.engineers.tableCompleted}</TableCell>
                  <TableCell>{dictionary.engineers.tableStatus}</TableCell>
                  <TableCell align='right'>{dictionary.common.actions}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <Skeleton variant='rectangular' height={28} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align='center'>
                      {dictionary.engineers.noEngineersFound}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(e => (
                    <TableRow key={e.id} hover>
                      <TableCell>{e.full_name}</TableCell>
                      <TableCell>{e.phone}</TableCell>
                      <TableCell>{e.geo_zone_name || '—'}</TableCell>
                      <TableCell>{e.experience_level || '—'}</TableCell>
                      <TableCell>{e.active_requests ?? 0}</TableCell>
                      <TableCell>{e.completed_requests ?? 0}</TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          color={e.is_active ? 'success' : 'default'}
                          label={e.is_active ? dictionary.common.active : dictionary.common.inactive}
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => openEdit(e)}>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                        <IconButton size='small' onClick={() => toggle(e.id)}>
                          <i className={e.is_active ? 'tabler-toggle-right text-lg' : 'tabler-toggle-left text-lg'} />
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
        <DialogTitle>{form.id ? dictionary.engineers.editEngineer : dictionary.engineers.addEngineer}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label={dictionary.engineers.fullName} value={form.full_name} onChange={e => update('full_name', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label={dictionary.common.phone} value={form.phone} onChange={e => update('phone', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                type='password'
                label={form.id ? `${dictionary.common.password} (${dictionary.common.optional})` : dictionary.common.password}
                value={form.password}
                onChange={e => update('password', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth select label={dictionary.engineers.tableZone} value={form.geo_zone_id} onChange={e => update('geo_zone_id', e.target.value)}>
                {zones.map(z => (
                  <MenuItem key={z.id} value={String(z.id)}>
                    {z.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth select label={dictionary.engineers.experienceLevel} value={form.experience_level} onChange={e => update('experience_level', e.target.value)}>
                <MenuItem value=''>—</MenuItem>
                {EXP_LEVELS.map(l => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label={dictionary.engineers.idCardUrl} value={form.id_card_url} onChange={e => update('id_card_url', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField fullWidth multiline rows={2} label={dictionary.engineers.bio} value={form.bio} onChange={e => update('bio', e.target.value)} />
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
