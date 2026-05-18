'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'

import CustomTextField from '@core/components/mui/TextField'
import { useDictionary } from '@/contexts/dictionaryContext'
import { adminRequestApi, geoZoneApi } from '@/services/api'
import type { GeoZone } from '@/types/maintenance'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function NewRequestDialog({ open, onClose, onCreated }: Props) {
  const dictionary = useDictionary()
  const [zones, setZones] = useState<GeoZone[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    full_address: '',
    geo_zone_id: '',
    summary: '',
    full_description: ''
  })

  useEffect(() => {
    if (!open) return
    geoZoneApi.list().then(res => {
      if (res.status === 'success' && res.data?.zones) setZones(res.data.zones)
    })
    setError(null)
    setForm({
      customer_name: '',
      customer_phone: '',
      full_address: '',
      geo_zone_id: '',
      summary: '',
      full_description: ''
    })
  }, [open])

  const update = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.customer_name || !form.customer_phone || !form.full_address || !form.geo_zone_id || !form.summary) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    setSubmitting(true)
    const res = await adminRequestApi.create({
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      full_address: form.full_address.trim(),
      geo_zone_id: Number(form.geo_zone_id),
      summary: form.summary.trim(),
      full_description: form.full_description.trim() || undefined
    })

    setSubmitting(false)

    if (res.status === 'success') {
      onCreated()
      onClose()
    } else {
      setError(res.message || dictionary.requests.createFailed)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>{dictionary.requests.newRequest}</DialogTitle>
      <DialogContent>
        <Grid container spacing={4} className='pt-2'>
          {error && (
            <Grid size={{ xs: 12 }}>
              <Alert severity='error'>{error}</Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              label={dictionary.requests.customerName}
              value={form.customer_name}
              onChange={e => update('customer_name', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              fullWidth
              label={dictionary.requests.customerPhone}
              value={form.customer_phone}
              onChange={e => update('customer_phone', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              label={dictionary.requests.fullAddress}
              value={form.full_address}
              onChange={e => update('full_address', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CustomTextField
              select
              fullWidth
              label={dictionary.requests.geoZone}
              value={form.geo_zone_id}
              onChange={e => update('geo_zone_id', e.target.value)}
            >
              {zones.map(z => (
                <MenuItem key={z.id} value={String(z.id)}>
                  {z.name}
                </MenuItem>
              ))}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              label={dictionary.requests.summary}
              value={form.summary}
              onChange={e => update('summary', e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <CustomTextField
              fullWidth
              multiline
              rows={3}
              label={`${dictionary.requests.fullDescription} (${dictionary.common.optional})`}
              value={form.full_description}
              onChange={e => update('full_description', e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {dictionary.common.cancel}
        </Button>
        <Button variant='contained' onClick={submit} disabled={submitting}>
          {dictionary.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
