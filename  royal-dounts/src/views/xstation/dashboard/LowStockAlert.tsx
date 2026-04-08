'use client'

import { useRouter, useParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'

import type { CafeteriaItem } from '@/types/xstation'
import type { Locale } from '@/configs/i18n'
import { getLocalizedUrl } from '@/utils/i18n'

interface LowStockAlertProps {
  items: CafeteriaItem[]
  dictionary: any
}

const LowStockAlert = ({ items, dictionary }: LowStockAlertProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as Locale) || 'en'

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: dictionary?.cafeteria?.outOfStock || 'Out of Stock', color: 'error' as const }
    if (stock < 5) return { label: dictionary?.cafeteria?.lowStock || 'Low Stock', color: 'warning' as const }
    return { label: dictionary?.cafeteria?.inStock || 'In Stock', color: 'success' as const }
  }

  return (
    <Card className='bs-full'>
      <CardHeader
        title={dictionary?.frontDesk?.stockAlerts || 'Stock Alerts'}
        action={
          items.length > 0 && (
            <Button
              size='small'
              variant='text'
              onClick={() => router.push(getLocalizedUrl('/cafeteria?filter=lowstock', locale))}
            >
              {dictionary?.common?.viewAll || 'View All'}
            </Button>
          )
        }
      />
      <CardContent>
        <div className='flex flex-col gap-3'>
          {items.length > 0 ? (
            <>
              {items.slice(0, 5).map(item => {
                const status = getStockStatus(item.stock)
                return (
                  <div
                    key={item.id}
                    className='flex items-center justify-between p-3 rounded-lg border'
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      <div className='w-10 h-10 rounded-lg bg-actionHover flex items-center justify-center'>
                        <i className='tabler-package text-xl' />
                      </div>
                      <div className='flex-1'>
                        <Typography variant='body2' fontWeight={500}>
                          {item.name}
                        </Typography>
                        <div className='flex items-center gap-2 mt-1'>
                          <LinearProgress
                            variant='determinate'
                            value={Math.min((item.stock / 20) * 100, 100)}
                            color={status.color}
                            className='flex-1 h-2'
                          />
                          <Typography variant='caption' color='text.secondary'>
                            {item.stock}
                          </Typography>
                        </div>
                      </div>
                    </div>
                    <Chip
                      label={status.label}
                      color={status.color}
                      variant='tonal'
                      size='small'
                      className='ml-2'
                    />
                  </div>
                )
              })}
              {items.length > 5 && (
                <Button
                  fullWidth
                  variant='outlined'
                  onClick={() => router.push(getLocalizedUrl('/cafeteria?filter=lowstock', locale))}
                >
                  {dictionary?.common?.viewMore || `View ${items.length - 5} More`}
                </Button>
              )}
            </>
          ) : (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <i className='tabler-check-circle text-5xl text-success mb-3' />
              <Typography variant='body1' color='text.secondary'>
                {dictionary?.common?.noData || 'All items are well stocked'}
              </Typography>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default LowStockAlert
