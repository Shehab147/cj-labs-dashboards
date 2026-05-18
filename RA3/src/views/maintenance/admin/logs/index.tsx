'use client'

import { useEffect, useState } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'

import { logsApi } from '@/services/api'
import type { AuditLogEntry } from '@/types/maintenance'
import { useDictionary } from '@/contexts/dictionaryContext'

export default function AdminLogsList() {
  const dictionary = useDictionary()
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const res = await logsApi.admin(200)

      if (!mounted) return

      if (res.status === 'success' && res.data?.logs) setRows(res.data.logs)
      else setError(res.message || dictionary.common.anErrorOccurred)
      setLoading(false)
    })()

    return () => {
      mounted = false
    }
  }, [dictionary.common.anErrorOccurred])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Box className='flex items-center justify-between'>
          <Typography variant='h4'>{dictionary.logs.title}</Typography>
        </Box>
      </Grid>

      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>{error}</Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{dictionary.logs.tableActor}</TableCell>
                  <TableCell>{dictionary.logs.tableAction}</TableCell>
                  <TableCell>{dictionary.logs.tableTarget}</TableCell>
                  <TableCell>{dictionary.logs.tableDetails}</TableCell>
                  <TableCell>{dictionary.logs.tableDate}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton variant='rectangular' height={26} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align='center'>{dictionary.logs.noLogsFound}</TableCell>
                  </TableRow>
                ) : (
                  rows.map(l => (
                    <TableRow key={l.id} hover>
                      <TableCell>{l.actor_name || '—'}</TableCell>
                      <TableCell>{l.action}</TableCell>
                      <TableCell>
                        {l.target_type ? `${l.target_type}${l.target_id ? `#${l.target_id}` : ''}` : '—'}
                      </TableCell>
                      <TableCell style={{ maxWidth: 400 }}>
                        <Typography variant='caption' style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {l.details || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{new Date(l.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}
