'use client'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useParams } from 'next/navigation'

// Type Imports
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import { Menu, MenuItem, MenuSection, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useAuth } from '@/contexts/authContext'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

type Props = {
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: (container: any, isPerfectScrollbar: boolean) => void
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='tabler-chevron-right' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ dictionary, scrollMenu }: Props) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const { isSuperadmin } = useAuth()
  const params = useParams()
  const lang = params.lang as string

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar
  const nav = dictionary['navigation']

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      {/* Menu Section - Main Navigation */}
      <Menu
        popoutMenuOffset={{ mainAxis: 23 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='tabler-circle text-xs' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {/* Main */}
        <MenuSection label={nav.main}>
          <MenuItem href={`/${lang}/dashboard`} icon={<i className='tabler-smart-home' />}>
            {nav.dashboard}
          </MenuItem>
          <MenuItem 
            href={`/${lang}/front-desk`} 
            icon={<i className='tabler-device-desktop' />}
            className='bg-primary/5 border-l-4 border-primary'
          >
            <div className='flex items-center justify-between w-full'>
              <span>{nav.frontDesk}</span>
              <Chip label='Quick' size='small' color='primary' className='ml-2' />
            </div>
          </MenuItem>
        </MenuSection>

        {/* Room Management */}
        <MenuSection label={nav.roomManagement}>
          <SubMenu label={nav.rooms} icon={<i className='tabler-door' />}>
            <MenuItem href={`/${lang}/rooms/list`} icon={<i className='tabler-list' />}>
              {nav.roomsList}
            </MenuItem>
            <MenuItem href={`/${lang}/rooms/status`} icon={<i className='tabler-chart-dots' />}>
              {nav.roomsStatus}
            </MenuItem>
          </SubMenu>
          <MenuItem href={`/${lang}/bookings`} icon={<i className='tabler-calendar-event' />}>
            {nav.bookings}
          </MenuItem>
        </MenuSection>

        {/* Customer & Orders */}
        <MenuSection label={nav.customerOrders}>
          <MenuItem href={`/${lang}/customers`} icon={<i className='tabler-users' />}>
            {nav.customers}
          </MenuItem>
          <MenuItem href={`/${lang}/cafeteria`} icon={<i className='tabler-coffee' />}>
            {nav.cafeteria}
          </MenuItem>
          <MenuItem href={`/${lang}/orders`} icon={<i className='tabler-receipt' />}>
            {nav.orders}
          </MenuItem>
        </MenuSection>

        {/* Superadmin Only */}
        {isSuperadmin && (
          <MenuSection label={nav.management}>
            <MenuItem href={`/${lang}/analytics`} icon={<i className='tabler-chart-bar' />}>
              {nav.analytics}
            </MenuItem>
            <MenuItem href={`/${lang}/admins`} icon={<i className='tabler-user-cog' />}>
              {nav.admins}
            </MenuItem>
          </MenuSection>
        )}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
