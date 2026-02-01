import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CustomAvatar from '@core/components/mui/Avatar'
import type { ThemeColor } from '@core/types'

interface DashboardStatsCardProps {
  title: string
  stats: string
  avatarIcon: string
  avatarColor?: ThemeColor
  trend?: 'positive' | 'negative'
  trendNumber?: string
}

const DashboardStatsCard = ({
  title,
  stats,
  avatarIcon,
  avatarColor = 'primary',
  trend,
  trendNumber
}: DashboardStatsCardProps) => {
  return (
    <Card className='bs-full'>
      <CardContent>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex flex-col gap-1'>
            <Typography variant='h4' fontWeight={600}>
              {stats}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {title}
            </Typography>
            {trendNumber && (
              <div className='flex items-center gap-1'>
                <i
                  className={`text-lg ${
                    trend === 'negative' ? 'tabler-chevron-down text-error' : 'tabler-chevron-up text-success'
                  }`}
                />
                <Typography
                  variant='body2'
                  color={trend === 'negative' ? 'error.main' : 'success.main'}
                >
                  {trendNumber}
                </Typography>
              </div>
            )}
          </div>
          <CustomAvatar variant='rounded' color={avatarColor} skin='light' size={44}>
            <i className={`${avatarIcon} text-[26px]`} />
          </CustomAvatar>
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardStatsCard
