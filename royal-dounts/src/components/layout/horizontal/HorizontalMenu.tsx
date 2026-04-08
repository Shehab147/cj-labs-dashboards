'use client'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Type Imports
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import HorizontalNav, { Menu, SubMenu, MenuItem } from '@menu/horizontal-menu'
import VerticalNavContent from './VerticalNavContent'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'
import { useAuth } from '@/contexts/authContext'

// Styled Component Imports
import StyledHorizontalNavExpandIcon from '@menu/styles/horizontal/StyledHorizontalNavExpandIcon'
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/horizontal/menuItemStyles'
import menuRootStyles from '@core/styles/horizontal/menuRootStyles'
import verticalNavigationCustomStyles from '@core/styles/vertical/navigationCustomStyles'
import verticalMenuItemStyles from '@core/styles/vertical/menuItemStyles'
import verticalMenuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  level?: number
}

type RenderVerticalExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

const RenderExpandIcon = ({ level }: RenderExpandIconProps) => (
  <StyledHorizontalNavExpandIcon level={level}>
    <i className='tabler-chevron-right' />
  </StyledHorizontalNavExpandIcon>
)

const RenderVerticalExpandIcon = ({ open, transitionDuration }: RenderVerticalExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='tabler-chevron-right' />
  </StyledVerticalNavExpandIcon>
)

const HorizontalMenu = ({ dictionary }: { dictionary: Awaited<ReturnType<typeof getDictionary>> }) => {
  // Hooks
  const verticalNavOptions = useVerticalNav()
  const theme = useTheme()
  const params = useParams()
  const { isSuperadmin } = useAuth()

  // Vars
  const { transitionDuration } = verticalNavOptions
  const { lang: locale } = params
  const nav = dictionary['navigation']

  return (
    <HorizontalNav
      switchToVertical
      verticalNavContent={VerticalNavContent}
      verticalNavProps={{
        customStyles: verticalNavigationCustomStyles(verticalNavOptions, theme),
        backgroundColor: 'var(--mui-palette-background-paper)'
      }}
    >
      <Menu
        rootStyles={menuRootStyles(theme)}
        renderExpandIcon={({ level }) => <RenderExpandIcon level={level} />}
        menuItemStyles={menuItemStyles(theme, 'tabler-circle')}
        renderExpandedMenuItemIcon={{ icon: <i className='tabler-circle text-xs' /> }}
        popoutMenuOffset={{
          mainAxis: ({ level }) => (level && level > 0 ? 14 : 12),
          alignmentAxis: 0
        }}
        verticalMenuProps={{
          menuItemStyles: verticalMenuItemStyles(verticalNavOptions, theme),
          renderExpandIcon: ({ open }) => (
            <RenderVerticalExpandIcon open={open} transitionDuration={transitionDuration} />
          ),
          renderExpandedMenuItemIcon: { icon: <i className='tabler-circle text-xs' /> },
          menuSectionStyles: verticalMenuSectionStyles(verticalNavOptions, theme)
        }}
      >
        {/* Dashboard */}
        <MenuItem href={`/${locale}/dashboard`} icon={<i className='tabler-smart-home' />}>
          {nav.dashboard}
        </MenuItem>

        {/* Front Desk */}
        <MenuItem href={`/${locale}/front-desk`} icon={<i className='tabler-device-desktop' />}>
          {nav.frontDesk}
        </MenuItem>

        {/* Rooms */}
        <SubMenu label={nav.rooms} icon={<i className='tabler-door' />}>
          <MenuItem href={`/${locale}/rooms/list`} icon={<i className='tabler-list' />}>
            {nav.roomsList}
          </MenuItem>
          <MenuItem href={`/${locale}/rooms/status`} icon={<i className='tabler-chart-dots' />}>
            {nav.roomsStatus}
          </MenuItem>
        </SubMenu>

        {/* Bookings */}
        <MenuItem href={`/${locale}/bookings`} icon={<i className='tabler-calendar-event' />}>
          {nav.bookings}
        </MenuItem>

        {/* Customers */}
        <MenuItem href={`/${locale}/customers`} icon={<i className='tabler-users' />}>
          {nav.customers}
        </MenuItem>

        {/* Cafeteria */}
        <MenuItem href={`/${locale}/cafeteria`} icon={<i className='tabler-coffee' />}>
          {nav.cafeteria}
        </MenuItem>

        {/* Orders */}
        <MenuItem href={`/${locale}/orders`} icon={<i className='tabler-receipt' />}>
          {nav.orders}
        </MenuItem>

        {/* Analytics - Superadmin only */}
        {isSuperadmin && (
          <MenuItem href={`/${locale}/analytics`} icon={<i className='tabler-chart-bar' />}>
            {nav.analytics}
          </MenuItem>
        )}

        {/* Admins - Superadmin only */}
        {isSuperadmin && (
          <MenuItem href={`/${locale}/admins`} icon={<i className='tabler-user-cog' />}>
            {nav.admins}
          </MenuItem>
        )}
      </Menu>
    </HorizontalNav>
  )
}

export default HorizontalMenu
