'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import CustomTextField from '@core/components/mui/TextField'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { engineerRequestApi } from '@/services/api'
import type { MaintenanceRequestDetails, RequestStatus } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'

interface Props {
  requestId: number
}

type Action =
  | null
  | { kind: 'transition'; to: RequestStatus; needsFinalPrice?: boolean }
  | { kind: 'note' }

export default function EngineerRequestDetail({ requestId }: Props) {
  const dictionary = useDictionary()
  const router = useRouter()
  const { lang: _lang } = useParams()

  const [data, setData] = useState<MaintenanceRequestDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [action, setAction] = useState<Action>(null)
  const [comment, setComment] = useState('')
  const [finalPrice, setFinalPrice] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await engineerRequestApi.details(requestId)

    if (res.status === 'success' && res.data?.request) setData(res.data.request)
    else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [requestId, dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  const close = () => {
    setAction(null)
    setComment('')
    setFinalPrice('')
    setNote('')
  }

  const submitTransition = async () => {
    if (action?.kind !== 'transition' || !data) return
    const payload: any = { id: requestId, status: action.to }

    if (comment.trim()) payload.comment = comment.trim()

    if (action.needsFinalPrice) {
      const fp = Number(finalPrice)

      if (!fp) {
        setError(dictionary.requests.finalPriceRequired)

        return
      }
      if (data.price_range_from != null && data.price_range_to != null) {
        if (fp < data.price_range_from || fp > data.price_range_to) {
          setError(dictionary.requests.finalPriceOutOfRange)

          return
        }
      }
      payload.final_price = fp
    }

    setBusy(true)
    const res = await engineerRequestApi.updateStatus(payload)

    setBusy(false)

    if (res.status === 'success') {
      close()
      load()
    } else setError(res.message || dictionary.requests.updateFailed)
  }

  const submitNote = async () => {
    if (!note.trim()) return
    setBusy(true)
    const res = await engineerRequestApi.addNotes(requestId, note.trim())

    setBusy(false)

    if (res.status === 'success') {
      close()
      load()
    } else setError(res.message || dictionary.requests.updateFailed)
  }

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant='rectangular' height={120} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant='rectangular' height={400} />
        </Grid>
      </Grid>
    )
  }

  if (!data) {
    return <Alert severity='error'>{error || dictionary.common.anErrorOccurred}</Alert>
  }

  // Allowed transitions for engineer
  const transitions: { to: RequestStatus; label: string; color?: any; icon: string; needsFinalPrice?: boolean }[] = []

  if (data.status === 'accepted') {
    transitions.push({ to: 'in_progress', label: dictionary.requests.startWork, icon: 'tabler-player-play', color: 'primary' })
    transitions.push({ to: 'on_hold', label: dictionary.requests.putOnHold, icon: 'tabler-pause', color: 'warning' })
  } else if (data.status === 'in_progress') {
    transitions.push({ to: 'on_hold', label: dictionary.requests.putOnHold, icon: 'tabler-pause', color: 'warning' })
    transitions.push({ to: 'completed', label: dictionary.requests.complete, icon: 'tabler-circle-check', color: 'success', needsFinalPrice: true })
  } else if (data.status === 'on_hold') {
    transitions.push({ to: 'in_progress', label: dictionary.requests.resume, icon: 'tabler-player-play', color: 'primary' })
  }

  return (
    <Grid container spacing={6}>
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError(null)}>{error}</Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center justify-between flex-wrap gap-3'>
              <Box>
                <Typography variant='h5'>
                  {dictionary.requests.title} #{data.id}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {new Date(data.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Box className='flex items-center gap-2'>
                <RequestStatusChip status={data.status} size='medium' />
                <Button size='small' variant='outlined' onClick={() => router.back()}>
                  {dictionary.common.back}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={6}>
          <Card>
            <CardHeader title={dictionary.requests.subheader} />
            <CardContent>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.customerName}</Typography>
                  <Typography>{data.customer_name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.customerPhone}</Typography>
                  <Typography>
                    <Link href={`tel:${data.customer_phone}`}>{data.customer_phone}</Link>
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.fullAddress}</Typography>
                  <Typography>{data.full_address}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.geoZone}</Typography>
                  <Typography>{data.zone_name || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.priceRange}</Typography>
                  <Typography>
                    {data.price_range_from != null && data.price_range_to != null
                      ? `${data.price_range_from} - ${data.price_range_to} ${dictionary.common.currency}`
                      : '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.finalPrice}</Typography>
                  <Typography>
                    {data.final_price != null ? `${data.final_price} ${dictionary.common.currency}` : '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant='caption' color='text.secondary'>{dictionary.requests.summary}</Typography>
                  <Typography>{data.summary}</Typography>
                </Grid>
                {data.full_description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='caption' color='text.secondary'>{dictionary.requests.fullDescription}</Typography>
                    <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.full_description}</Typography>
                  </Grid>
                )}
                {data.admin_notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='caption' color='text.secondary'>{dictionary.requests.adminNotes}</Typography>
                    <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.admin_notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={dictionary.requests.engineerNotes} />
            <CardContent>
              <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.engineer_notes || '—'}</Typography>
            </CardContent>
          </Card>

          {data.files && data.files.length > 0 && (
            <Card>
              <CardHeader title={dictionary.requests.files} />
              <CardContent>
                <Stack spacing={2}>
                  {data.files.map(f => (
                    <Box key={f.id} className='flex items-center gap-3'>
                      <i className='tabler-paperclip' />
                      <Box>
                        <Typography variant='body2' fontWeight={600}>{f.file_type}</Typography>
                        <Link href={f.url} target='_blank' rel='noopener noreferrer' variant='caption' className='break-all'>{f.url}</Link>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {data.activities && data.activities.length > 0 && (
            <Card>
              <CardHeader title={dictionary.requests.activities} />
              <CardContent>
                <Stack spacing={2}>
                  {data.activities.map(a => (
                    <Box key={a.id} className='flex gap-3'>
                      <Box className='pt-1'>
                        <i className='tabler-point-filled text-primary' />
                      </Box>
                      <Box className='flex-1'>
                        <Typography variant='body2' fontWeight={600}>{a.action}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {a.actor_name || a.actor_type} • {new Date(a.created_at).toLocaleString()}
                        </Typography>
                        {a.comment && (
                          <Typography variant='body2' className='mt-1' style={{ whiteSpace: 'pre-wrap' }}>
                            {a.comment}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title={dictionary.common.actions} />
          <CardContent>
            <Stack spacing={2}>
              {transitions.map(t => (
                <Button
                  key={t.to}
                  variant='contained'
                  color={t.color || 'primary'}
                  startIcon={<i className={t.icon} />}
                  onClick={() => setAction({ kind: 'transition', to: t.to, needsFinalPrice: t.needsFinalPrice })}
                >
                  {t.label}
                </Button>
              ))}
              <Button variant='outlined' startIcon={<i className='tabler-note' />} onClick={() => setAction({ kind: 'note' })}>
                {dictionary.requests.addNote}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Transition dialog */}
      <Dialog open={action?.kind === 'transition'} onClose={close} maxWidth='xs' fullWidth>
        <DialogTitle>{dictionary.requests.changeStatus}</DialogTitle>
        <DialogContent>
          <Stack spacing={4} className='pt-2'>
            {action?.kind === 'transition' && action.needsFinalPrice && (
              <CustomTextField
                fullWidth
                type='number'
                label={dictionary.requests.finalPrice}
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                helperText={
                  data?.price_range_from != null && data?.price_range_to != null
                    ? `${dictionary.requests.priceRange}: ${data.price_range_from} - ${data.price_range_to}`
                    : undefined
                }
              />
            )}
            <CustomTextField
              fullWidth
              multiline
              rows={3}
              label={`${dictionary.common.comment} (${dictionary.common.optional})`}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitTransition} disabled={busy}>{dictionary.common.confirm}</Button>
        </DialogActions>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={action?.kind === 'note'} onClose={close} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary.requests.addNote}</DialogTitle>
        <DialogContent>
          <CustomTextField
            fullWidth
            multiline
            rows={5}
            label={dictionary.requests.note}
            value={note}
            onChange={e => setNote(e.target.value)}
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitNote} disabled={busy}>{dictionary.common.save}</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
