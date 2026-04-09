'use client'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

const TablesManagement = () => {
  return (
    <Card>
      <CardHeader title='إدارة الطاولات' subheader='حالة التكامل الحالية مع الخادم' />
      <Divider />
      <CardContent>
        <Alert severity='info' icon={<i className='tabler-info-circle' />}>
          هذا النظام لا يحتوي حالياً على واجهات API للطاولات في `backend_documentation.md`.
        </Alert>
        <Typography variant='body2' color='text.secondary' className='mt-4'>
          لإدارة الطلبات بشكل مباشر استخدم شاشة نقاط البيع أو شاشة الطلبات.
        </Typography>
      </CardContent>
    </Card>
  )
}

export default TablesManagement
