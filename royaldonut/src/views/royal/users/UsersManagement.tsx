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
import Tooltip from '@mui/material/Tooltip'

import { userApi } from '@/services/api'
import { useAuth } from '@/contexts/authContext'
import { formatLocalDate } from '@/utils/timezone'

interface User {
  id: number
  full_name: string
  username: string
  phone?: string
  role: 'cashier' | 'kitchen' | 'super_admin'
  is_active: 0 | 1
  created_at?: string
}

const ROLES = [
  { value: 'super_admin', role_id: 3, label: 'مدير', color: 'primary' as const },
  { value: 'cashier',     role_id: 1, label: 'كاشير', color: 'success' as const },
  { value: 'kitchen',     role_id: 2, label: 'مطبخ',  color: 'warning' as const },
]

const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role
const roleColor = (role: string) => ROLES.find(r => r.value === role)?.color || 'default'
const roleId = (role: string) => ROLES.find(r => r.value === role)?.role_id || 1

const UsersManagement = () => {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const [formData, setFormData] = useState({
    full_name: '', username: '', password: '', phone: '', role: 'cashier'
  })

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await userApi.getAll()
      if (res.status === 'success') {
        setUsers(res.data?.users || [])
      } else {
        setError(res.message || 'فشل تحميل المستخدمين')
      }
    } catch {
      setError('فشل تحميل المستخدمين')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleOpenAdd = () => {
    setEditUser(null)
    setFormData({ full_name: '', username: '', password: '', phone: '', role: 'cashier' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: User) => {
    setEditUser(user)
    setFormData({ full_name: user.full_name, username: user.username, password: '', phone: user.phone || '', role: user.role })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.full_name.trim() || !formData.username.trim()) {
      setSnackbar({ open: true, message: 'الاسم واسم المستخدم مطلوبان', severity: 'error' })
      return
    }
    try {
      let res
      if (editUser) {
        const data: any = {
          id: editUser.id,
          full_name: formData.full_name,
          phone: formData.phone || undefined,
          role_id: roleId(formData.role),
        }
        if (formData.password) data.password = formData.password
        res = await userApi.update(data)
      } else {
        if (!formData.password) {
          setSnackbar({ open: true, message: 'كلمة المرور مطلوبة للمستخدمين الجدد', severity: 'error' })
          return
        }
        res = await userApi.create({
          full_name: formData.full_name,
          username: formData.username,
          password: formData.password,
          role_id: roleId(formData.role),
          phone: formData.phone || undefined,
        })
      }
      if (res.status === 'success') {
        setSnackbar({ open: true, message: editUser ? 'تم تحديث المستخدم بنجاح' : 'تمت إضافة المستخدم بنجاح', severity: 'success' })
        setDialogOpen(false)
        fetchUsers()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشلت العملية', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'حدث خطأ', severity: 'error' })
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      const res = await userApi.toggleStatus(user.id)
      if (res.status === 'success') {
        setSnackbar({ open: true, message: user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم', severity: 'success' })
        fetchUsers()
      } else {
        setSnackbar({ open: true, message: res.message || 'فشل تغيير الحالة', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: 'حدث خطأ', severity: 'error' })
    }
  }

  if (!isAdmin) {
    return <Alert severity='error'>الوصول مرفوض. للمدير فقط.</Alert>
  }

  if (isLoading) {
    return <div className='flex items-center justify-center min-h-[400px]'><CircularProgress /></div>
  }

  return (
    <>
      <Card>
        <CardHeader
          title='إدارة المستخدمين'
          subheader={`${users.length} مستخدم(ين) إجمالاً`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={handleOpenAdd}>
              إضافة مستخدم
            </Button>
          }
        />
        <Divider />
        {error && <Alert severity='error' className='m-4'>{error}</Alert>}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>الاسم الكامل</TableCell>
                <TableCell>اسم المستخدم</TableCell>
                <TableCell>الهاتف</TableCell>
                <TableCell>الدور</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>تاريخ الإنشاء</TableCell>
                <TableCell align='right'>الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align='center'>
                    <Typography variant='body2' color='text.secondary'>لا يوجد مستخدمين</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => (
                  <TableRow key={user.id} sx={{ opacity: user.is_active ? 1 : 0.55 }}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      <Typography variant='subtitle2'>{user.full_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>{user.username}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>{user.phone || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={roleLabel(user.role)} size='small' color={roleColor(user.role) as any} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'نشط' : 'معطّل'}
                        size='small'
                        color={user.is_active ? 'success' : 'default'}
                        variant='tonal'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption' color='text.secondary'>
                        {user.created_at ? formatLocalDate(user.created_at, 'ar-SA') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Tooltip title='تعديل'>
                        <IconButton size='small' onClick={() => handleOpenEdit(user)} color='primary'>
                          <i className='tabler-edit text-lg' />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={user.is_active ? 'تعطيل' : 'تفعيل'}>
                        <IconButton size='small' onClick={() => handleToggleStatus(user)} color={user.is_active ? 'error' : 'success'}>
                          <i className={`tabler-${user.is_active ? 'user-off' : 'user-check'} text-lg`} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '1rem !important', overflow: 'visible' }}>
          <TextField
            label='الاسم الكامل'
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label='اسم المستخدم'
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            fullWidth
            required
            disabled={!!editUser}
            helperText={editUser ? 'لا يمكن تغيير اسم المستخدم' : ''}
          />
          <TextField
            label={editUser ? 'كلمة المرور (اتركها فارغة للإبقاء)' : 'كلمة المرور'}
            type='password'
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            fullWidth
            required={!editUser}
          />
          <TextField
            label='الهاتف (اختياري)'
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            fullWidth
          />
          <TextField
            select
            label='الدور'
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
            fullWidth
            slotProps={{ select: { MenuProps: { disablePortal: false, PaperProps: { style: { maxHeight: 200 } } } } }}
          >
            {ROLES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إلغاء</Button>
          <Button variant='contained' onClick={handleSubmit}>
            {editUser ? 'تحديث' : 'إضافة'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default UsersManagement
