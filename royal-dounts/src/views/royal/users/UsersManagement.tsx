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
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'

import { userApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { useDictionary } from '@/contexts/dictionaryContext'
import { formatLocalDate } from '@/utils/timezone'

interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'cashier' | 'kitchen'
  created_at?: string
}

const ROLES = [
  { value: 'admin', label: 'admin', color: 'primary' as const },
  { value: 'cashier', label: 'cashier', color: 'success' as const },
  { value: 'kitchen', label: 'kitchen', color: 'warning' as const },
]

const UsersManagement = () => {
  const { isAdmin, admin } = useAuth()
  const t = useDictionary()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Form state
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'cashier' })

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await userApi.getAll()
      if (res.status === 'success') {
        setUsers(Array.isArray(res.data) ? res.data : res.data?.users || [])
      } else {
        setError(res.message || t.users.failedToLoad)
      }
    } catch {
      setError(t.users.failedToLoad)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOpenAdd = () => {
    setEditUser(null)
    setFormData({ name: '', email: '', password: '', role: 'cashier' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: User) => {
    setEditUser(user)
    setFormData({ name: user.name, email: user.email, password: '', role: user.role })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    try {
      if (editUser) {
        const updateData: any = { name: formData.name, email: formData.email, role: formData.role }
        if (formData.password) updateData.password = formData.password
        const res = await userApi.update(editUser.id, updateData)
        if (res.status === 'success') {
          setSnackbar({ open: true, message: t.users.userUpdated, severity: 'success' })
        } else {
          setSnackbar({ open: true, message: res.message || t.users.failedToUpdate, severity: 'error' })
          return
        }
      } else {
        if (!formData.password) {
          setSnackbar({ open: true, message: t.users.passwordRequired, severity: 'error' })
          return
        }
        const res = await userApi.add(formData)
        if (res.status === 'success') {
          setSnackbar({ open: true, message: t.users.userAdded, severity: 'success' })
        } else {
          setSnackbar({ open: true, message: res.message || t.users.failedToAdd, severity: 'error' })
          return
        }
      }
      setDialogOpen(false)
      fetchUsers()
    } catch {
      setSnackbar({ open: true, message: t.common.anErrorOccurred, severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    try {
      const res = await userApi.delete(deletingUser.id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: t.users.userDeleted, severity: 'success' })
        fetchUsers()
      } else {
        setSnackbar({ open: true, message: res.message || t.users.failedToDelete, severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: t.users.failedToDelete, severity: 'error' })
    }
    setDeleteConfirmOpen(false)
    setDeletingUser(null)
  }

  if (!isAdmin) {
    return <Alert severity='error'>{t.users.accessDenied}</Alert>
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t.users.title}
          subheader={`${users.length} ${t.users.totalCount}`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={handleOpenAdd}>
              {t.users.addUser}
            </Button>
          }
        />
        <Divider />
        {error && <Alert severity='error' className='m-4'>{error}</Alert>}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t.users.tableId}</TableCell>
                <TableCell>{t.users.tableName}</TableCell>
                <TableCell>{t.users.tableEmail}</TableCell>
                <TableCell>{t.users.tableRole}</TableCell>
                <TableCell>{t.users.tableCreated}</TableCell>
                <TableCell align='right'>{t.users.tableActions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <Typography variant='body2' color='text.secondary'>{t.users.noUsersFound}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => {
                  const roleInfo = ROLES.find(r => r.value === user.role) || ROLES[1]
                  const roleLabel = user.role === 'admin' ? t.users.roleAdmin : user.role === 'cashier' ? t.users.roleCashier : t.users.roleKitchen
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>
                        <Typography variant='subtitle2'>{user.name}</Typography>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip label={roleLabel} size='small' color={roleInfo.color} />
                      </TableCell>
                      <TableCell>
                        {user.created_at ? formatLocalDate(user.created_at) : '-'}
                      </TableCell>
                      <TableCell align='right'>
                        <IconButton size='small' onClick={() => handleOpenEdit(user)} color='primary'>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                        {user.id !== admin?.id && (
                          <IconButton
                            size='small'
                            onClick={() => { setDeletingUser(user); setDeleteConfirmOpen(true) }}
                            color='error'
                          >
                            <i className='tabler-trash text-lg' />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editUser ? t.users.editUser : t.users.addNewUser}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 4, pt: '1rem !important', overflow: 'visible' }}>
          <TextField
            label={t.users.labelName}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={t.users.labelEmail}
            type='email'
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label={editUser ? t.users.labelPasswordEdit : t.users.labelPassword}
            type='password'
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            fullWidth
            required={!editUser}
          />
          <TextField
            select
            label={t.users.labelRole}
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}
          >
            {ROLES.map(role => {
              const label = role.value === 'admin' ? t.users.roleAdmin : role.value === 'cashier' ? t.users.roleCashier : t.users.roleKitchen
              return <MenuItem key={role.value} value={role.value}>{label}</MenuItem>
            })}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' onClick={handleSubmit}>
            {editUser ? t.common.update : t.users.addUser}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t.users.deleteUser}</DialogTitle>
        <DialogContent>
          <Typography>{t.users.confirmDelete} <strong>{deletingUser?.name}</strong>?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t.common.cancel}</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>{t.common.delete}</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default UsersManagement
