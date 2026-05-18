'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Link from '@mui/material/Link'
import NextLink from 'next/link'

import CustomTextField from '@core/components/mui/TextField'
import RequestStatusChip from '@/components/maintenance/RequestStatusChip'
import { adminRequestApi, engineerApi } from '@/services/api'
import type { EngineerAccount, MaintenanceRequestDetails } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'
import { useAuth } from '@/contexts/authContext'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

interface Props {
  requestId: number
}

type DialogKind = null | 'price' | 'reassign' | 'reject' | 'cancel' | 'notes' | 'file'

export default function AdminRequestDetail({ requestId }: Props) {
  const dictionary = useDictionary()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'ar'
  const router = useRouter()
  const { isAdmin } = useAuth()

  const [data, setData] = useState<MaintenanceRequestDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [engineers, setEngineers] = useState<EngineerAccount[]>([])
  const [busy, setBusy] = useState(false)

  const [dialog, setDialog] = useState<DialogKind>(null)
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [priceAdminNotes, setPriceAdminNotes] = useState('')
  const [reassignTo, setReassignTo] = useState<string>('')
  const [rejectComment, setRejectComment] = useState('')
  const [cancelComment, setCancelComment] = useState('')
  const [notes, setNotes] = useState('')
  const [fileType, setFileType] = useState('')
  const [fileUrl, setFileUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await adminRequestApi.get(requestId)

    if (res.status === 'success' && res.data?.request) {
      setData(res.data.request)
      setNotes(res.data.request.admin_notes || '')
    } else setError(res.message || dictionary.common.anErrorOccurred)
    setLoading(false)
  }, [requestId, dictionary.common.anErrorOccurred])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    engineerApi.list({ status: 'active' }).then(r => {
      if (r.status === 'success' && r.data?.engineers) setEngineers(r.data.engineers)
    })
  }, [])

  const closeDialog = () => setDialog(null)

  const run = async <T,>(fn: () => Promise<{ status: 'success' | 'error'; message?: string; data?: T }>) => {
    setBusy(true)
    const r = await fn()

    setBusy(false)

    if (r.status === 'success') {
      closeDialog()
      load()
    } else {
      setError(r.message || dictionary.requests.updateFailed)
    }
  }

  const submitPrice = () => {
    const f = Number(priceFrom)
    const t = Number(priceTo)

    if (!f || !t || f > t) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    run(() =>
      adminRequestApi.setPriceRange({
        id: requestId,
        price_range_from: f,
        price_range_to: t,
        admin_notes: priceAdminNotes.trim() || undefined
      })
    )
  }

  const acceptByCustomer = () => run(() => adminRequestApi.markAccepted(requestId))

  const submitReject = () => run(() => adminRequestApi.markRejected(requestId, rejectComment.trim() || undefined))

  const submitReassign = () =>
    run(() => adminRequestApi.reassignEngineer(requestId, reassignTo ? Number(reassignTo) : undefined))

  const submitCancel = () => run(() => adminRequestApi.cancel(requestId, cancelComment.trim() || undefined))

  const submitNotes = () => run(() => adminRequestApi.updateAdminNotes(requestId, notes))

  const submitFile = () => {
    if (!fileType || !fileUrl) {
      setError(dictionary.common.anErrorOccurred)

      return
    }
    run(() =>
      adminRequestApi.addFile({ request_id: requestId, file_type: fileType.trim(), url: fileUrl.trim() })
    )
  }

  const deleteFile = (id: number) => run(() => adminRequestApi.deleteFile(id))

  if (loading) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant='rectangular' height={120} />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant='rectangular' height={300} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Skeleton variant='rectangular' height={300} />
        </Grid>
      </Grid>
    )
  }

  if (!data) {
    return <Alert severity='error'>{error || dictionary.common.anErrorOccurred}</Alert>
  }

  const isTerminal = data.status === 'completed' || data.status === 'rejected' || data.status === 'cancelled'
  const canSetPrice = isAdmin && (data.status === 'pending' || data.status === 'price_offered')
  const canMarkAccepted = isAdmin && data.status === 'price_offered'
  const canReject = isAdmin && (data.status === 'pending' || data.status === 'price_offered')
  const canCancel = isAdmin && !isTerminal
  const canReassign = isAdmin && data.engineer_id != null && !isTerminal

  return (
    <Grid container spacing={6}>
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <Box className='flex items-center justify-between flex-wrap gap-3'>
              <Box>
                <Typography variant='h5'>
                  {dictionary.requests.title} #{data.id}
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mt-1'>
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

      {/* Main column */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={6}>
          <Card>
            <CardHeader title={dictionary.requests.subheader} />
            <CardContent>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.customerName}
                  </Typography>
                  <Typography>{data.customer_name}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.customerPhone}
                  </Typography>
                  <Typography>{data.customer_phone}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.fullAddress}
                  </Typography>
                  <Typography>{data.full_address}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.geoZone}
                  </Typography>
                  <Typography>{data.zone_name || '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.assignedEngineer}
                  </Typography>
                  <Typography>
                    {data.engineer_name
                      ? `${data.engineer_name}${data.engineer_phone ? ` (${data.engineer_phone})` : ''}`
                      : dictionary.requests.noEngineer}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.summary}
                  </Typography>
                  <Typography>{data.summary}</Typography>
                </Grid>
                {data.full_description && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {dictionary.requests.fullDescription}
                    </Typography>
                    <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.full_description}</Typography>
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.priceRange}
                  </Typography>
                  <Typography>
                    {data.price_range_from != null && data.price_range_to != null
                      ? `${data.price_range_from} - ${data.price_range_to} ${dictionary.common.currency}`
                      : '—'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {dictionary.requests.finalPrice}
                  </Typography>
                  <Typography>
                    {data.final_price != null ? `${data.final_price} ${dictionary.common.currency}` : '—'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={dictionary.requests.adminNotes}
              action={
                <Button size='small' onClick={() => setDialog('notes')}>
                  {dictionary.common.edit}
                </Button>
              }
            />
            <CardContent>
              <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.admin_notes || '—'}</Typography>
            </CardContent>
          </Card>

          {data.engineer_notes && (
            <Card>
              <CardHeader title={dictionary.requests.engineerNotes} />
              <CardContent>
                <Typography style={{ whiteSpace: 'pre-wrap' }}>{data.engineer_notes}</Typography>
              </CardContent>
            </Card>
          )}

          {/* Files */}
          <Card>
            <CardHeader
              title={dictionary.requests.files}
              action={
                <Button
                  size='small'
                  startIcon={<i className='tabler-plus' />}
                  onClick={() => {
                    setFileType('')
                    setFileUrl('')
                    setDialog('file')
                  }}
                >
                  {dictionary.requests.addFile}
                </Button>
              }
            />
            <CardContent>
              {data.files && data.files.length > 0 ? (
                <Stack spacing={2} divider={<Divider flexItem />}>
                  {data.files.map(f => (
                    <Box key={f.id} className='flex items-center justify-between gap-3'>
                      <Box className='flex items-center gap-3 min-w-0'>
                        <i className='tabler-paperclip' />
                        <Box className='min-w-0'>
                          <Typography variant='body2' fontWeight={600}>
                            {f.file_type}
                          </Typography>
                          <Link
                            href={f.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            variant='caption'
                            className='break-all'
                          >
                            {f.url}
                          </Link>
                        </Box>
                      </Box>
                      <IconButton size='small' color='error' onClick={() => deleteFile(f.id)} disabled={busy}>
                        <i className='tabler-trash' />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color='text.secondary'>—</Typography>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title={dictionary.requests.activities} />
            <CardContent>
              {data.activities && data.activities.length > 0 ? (
                <Stack spacing={2}>
                  {data.activities.map(a => (
                    <Box key={a.id} className='flex gap-3'>
                      <Box className='pt-1'>
                        <i className='tabler-point-filled text-primary' />
                      </Box>
                      <Box className='flex-1'>
                        <Typography variant='body2' fontWeight={600}>
                          {a.action}
                        </Typography>
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
              ) : (
                <Typography color='text.secondary'>—</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      {/* Side actions */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title={dictionary.common.actions} />
          <CardContent>
            <Stack spacing={2}>
              {canSetPrice && (
                <Button
                  variant='contained'
                  startIcon={<i className='tabler-tag' />}
                  onClick={() => {
                    setPriceFrom(data.price_range_from?.toString() || '')
                    setPriceTo(data.price_range_to?.toString() || '')
                    setPriceAdminNotes('')
                    setDialog('price')
                  }}
                >
                  {dictionary.requests.setPriceRange}
                </Button>
              )}
              {canMarkAccepted && (
                <Button
                  variant='contained'
                  color='success'
                  startIcon={<i className='tabler-check' />}
                  onClick={acceptByCustomer}
                  disabled={busy}
                >
                  {dictionary.requests.markAccepted}
                </Button>
              )}
              {canReassign && (
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-replace' />}
                  onClick={() => {
                    setReassignTo('')
                    setDialog('reassign')
                  }}
                >
                  {dictionary.requests.reassignEngineer}
                </Button>
              )}
              {canReject && (
                <Button
                  variant='outlined'
                  color='warning'
                  startIcon={<i className='tabler-x' />}
                  onClick={() => {
                    setRejectComment('')
                    setDialog('reject')
                  }}
                >
                  {dictionary.requests.markRejected}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant='outlined'
                  color='error'
                  startIcon={<i className='tabler-ban' />}
                  onClick={() => {
                    setCancelComment('')
                    setDialog('cancel')
                  }}
                >
                  {dictionary.requests.cancelRequest}
                </Button>
              )}
              <Button
                variant='text'
                component={NextLink}
                href={getLocalizedUrl('/admin/requests', locale)}
              >
                {dictionary.common.back}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {/* Price dialog */}
      <Dialog open={dialog === 'price'} onClose={closeDialog} maxWidth='xs' fullWidth>
        <DialogTitle>{dictionary.requests.setPriceRange}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                fullWidth
                type='number'
                label={dictionary.requests.priceFrom}
                value={priceFrom}
                onChange={e => setPriceFrom(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                fullWidth
                type='number'
                label={dictionary.requests.priceTo}
                value={priceTo}
                onChange={e => setPriceTo(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                multiline
                rows={2}
                label={`${dictionary.requests.adminNotes} (${dictionary.common.optional})`}
                value={priceAdminNotes}
                onChange={e => setPriceAdminNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitPrice} disabled={busy}>{dictionary.common.save}</Button>
        </DialogActions>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={dialog === 'reassign'} onClose={closeDialog} maxWidth='xs' fullWidth>
        <DialogTitle>{dictionary.requests.reassignEngineer}</DialogTitle>
        <DialogContent>
          <CustomTextField
            select
            fullWidth
            label={dictionary.requests.assignedEngineer}
            value={reassignTo}
            onChange={e => setReassignTo(e.target.value)}
            className='mt-2'
          >
            <MenuItem value=''>{dictionary.requests.autoAssign}</MenuItem>
            {engineers.map(e => (
              <MenuItem key={e.id} value={String(e.id)}>
                {e.full_name} {e.geo_zone_name ? `— ${e.geo_zone_name}` : ''}
              </MenuItem>
            ))}
          </CustomTextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitReassign} disabled={busy}>{dictionary.common.confirm}</Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === 'reject'} onClose={closeDialog} maxWidth='xs' fullWidth>
        <DialogTitle>{dictionary.requests.confirmReject}</DialogTitle>
        <DialogContent>
          <CustomTextField
            fullWidth
            multiline
            rows={3}
            label={dictionary.common.comment}
            value={rejectComment}
            onChange={e => setRejectComment(e.target.value)}
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button color='warning' variant='contained' onClick={submitReject} disabled={busy}>{dictionary.common.confirm}</Button>
        </DialogActions>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={dialog === 'cancel'} onClose={closeDialog} maxWidth='xs' fullWidth>
        <DialogTitle>{dictionary.requests.confirmCancel}</DialogTitle>
        <DialogContent>
          <CustomTextField
            fullWidth
            multiline
            rows={3}
            label={dictionary.common.comment}
            value={cancelComment}
            onChange={e => setCancelComment(e.target.value)}
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button color='error' variant='contained' onClick={submitCancel} disabled={busy}>{dictionary.common.confirm}</Button>
        </DialogActions>
      </Dialog>

      {/* Notes dialog */}
      <Dialog open={dialog === 'notes'} onClose={closeDialog} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary.requests.updateNotes}</DialogTitle>
        <DialogContent>
          <CustomTextField
            fullWidth
            multiline
            rows={5}
            label={dictionary.requests.adminNotes}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitNotes} disabled={busy}>{dictionary.common.save}</Button>
        </DialogActions>
      </Dialog>

      {/* File dialog */}
      <Dialog open={dialog === 'file'} onClose={closeDialog} maxWidth='sm' fullWidth>
        <DialogTitle>{dictionary.requests.addFile}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label={dictionary.requests.fileType}
                value={fileType}
                onChange={e => setFileType(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label={dictionary.requests.fileUrl}
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>{dictionary.common.cancel}</Button>
          <Button variant='contained' onClick={submitFile} disabled={busy}>{dictionary.common.save}</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
