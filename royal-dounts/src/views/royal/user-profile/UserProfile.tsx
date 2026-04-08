'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'

import { getStoredAdmin } from '@/services/api'
import { useDictionary } from '@/contexts/dictionaryContext'

const UserProfile = () => {
  const t = useDictionary()
  const [admin, setAdmin] = useState<any>(null)

  useEffect(() => {
    const data = getStoredAdmin()
    setAdmin(data)
  }, [])

  if (!admin) return null

  return (
    <Card>
      <CardHeader title={t.userDropdown.myProfile} />
      <CardContent>
        <Box className='flex flex-col items-center gap-4 mb-6'>
          <Avatar sx={{ width: 80, height: 80, fontSize: '2rem' }}>
            {admin.name?.charAt(0)?.toUpperCase() || 'A'}
          </Avatar>
          <div className='text-center'>
            <Typography variant='h5'>{admin.name}</Typography>
            <Typography variant='body2' color='text.secondary'>{admin.email}</Typography>
          </div>
          <Chip label={admin.role} color='primary' />
        </Box>
        <Divider className='mb-4' />
        <Box className='flex flex-col gap-3'>
          <Box className='flex justify-between'>
            <Typography variant='body2' color='text.secondary'>ID</Typography>
            <Typography variant='body2'>{admin.id}</Typography>
          </Box>
          <Box className='flex justify-between'>
            <Typography variant='body2' color='text.secondary'>{t.users.tableName}</Typography>
            <Typography variant='body2'>{admin.name}</Typography>
          </Box>
          <Box className='flex justify-between'>
            <Typography variant='body2' color='text.secondary'>{t.users.tableEmail}</Typography>
            <Typography variant='body2'>{admin.email}</Typography>
          </Box>
          <Box className='flex justify-between'>
            <Typography variant='body2' color='text.secondary'>{t.users.tableRole}</Typography>
            <Typography variant='body2'>{admin.role}</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default UserProfile
