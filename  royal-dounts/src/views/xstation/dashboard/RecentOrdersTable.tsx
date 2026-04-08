'use client'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

import type { Order } from '@/types/xstation'
import { formatLocalDate } from '@/utils/timezone'

interface RecentOrdersTableProps {
  orders: Order[]
  dictionary: any
}

const RecentOrdersTable = ({ orders, dictionary }: RecentOrdersTableProps) => {
  return (
    <Card>
      <CardHeader title={dictionary?.dashboard?.recentOrders || 'Recent Orders'} />
      <CardContent>
        {orders.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b'>
                  <th className='text-start p-3'>#</th>
                  <th className='text-start p-3'>{dictionary?.bookings?.customer || 'Customer'}</th>
                  <th className='text-start p-3'>{dictionary?.orders?.orderItems || 'Items'}</th>
                  <th className='text-start p-3'>{dictionary?.orders?.total || 'Total'}</th>
                  <th className='text-start p-3'>{dictionary?.common?.date || 'Date'}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((order) => (
                  <tr key={order.id} className='border-b last:border-0'>
                    <td className='p-3'>
                      <Typography variant='body2'>#{order.id}</Typography>
                    </td>
                    <td className='p-3'>
                      <Typography variant='body2'>{order.customer_name}</Typography>
                    </td>
                    <td className='p-3'>
                      <Typography variant='body2'>{order.items?.length || 0} {dictionary?.orders?.items || 'items'}</Typography>
                    </td>
                    <td className='p-3'>
                      <Typography variant='body2' color='success.main' fontWeight={500}>
                        {order.price} {dictionary?.common?.currency || 'EGP'}
                      </Typography>
                    </td>
                    <td className='p-3'>
                      <Typography variant='body2' color='text.secondary'>
                        {formatLocalDate(order.created_at)}
                      </Typography>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Typography variant='body2' color='text.secondary' className='text-center py-4'>
            {dictionary?.common?.noData || 'No data available'}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default RecentOrdersTable
