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
  const { isAdmin, isCashier, isKitchen } = useAuth()

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
        {/* Dashboard - admin only */}
        {isAdmin && (
          <MenuItem href={`/${locale}/dashboard`} icon={<i className='tabler-smart-home' />}>
            {nav.dashboard}
          </MenuItem>
        )}

        {/* POS - admin & cashier */}
        {(isAdmin || isCashier) && (
          <MenuItem href={`/${locale}/pos`} icon={<i className='tabler-cash-register' />}>
            {nav.pos}
          </MenuItem>
        )}

        {/* Products & Categories - admin only */}
        {isAdmin && (
          <>
            <MenuItem href={`/${locale}/products`} icon={<i className='tabler-cookie' />}>
              {nav.products}
            </MenuItem>
            <MenuItem href={`/${locale}/categories`} icon={<i className='tabler-category' />}>
              {nav.categories}
            </MenuItem>
          </>
        )}

        {/* Orders - admin & cashier */}
        {(isAdmin || isCashier) && (
          <MenuItem href={`/${locale}/orders`} icon={<i className='tabler-receipt' />}>
            {nav.orders}
          </MenuItem>
        )}

        {/* Kitchen - admin & kitchen */}
        {(isAdmin || isKitchen) && (
          <SubMenu label={nav.kitchen} icon={<i className='tabler-chef-hat' />}>
            <MenuItem href={`/${locale}/kitchen`} icon={<i className='tabler-list-check' />}>
              {nav.kitchenOrders}
            </MenuItem>
            <MenuItem href={`/${locale}/kitchen/logs`} icon={<i className='tabler-file-text' />}>
              {nav.kitchenLogs}
            </MenuItem>
          </SubMenu>
        )}

        {/* Analytics - admin only */}
        {isAdmin && (
          <SubMenu label={nav.analytics} icon={<i className='tabler-chart-bar' />}>
            <MenuItem href={`/${locale}/analytics`} icon={<i className='tabler-chart-pie' />}>
              {nav.overview}
            </MenuItem>
            <MenuItem href={`/${locale}/analytics/sales`} icon={<i className='tabler-chart-line' />}>
              {nav.salesAnalytics}
            </MenuItem>
            <MenuItem href={`/${locale}/analytics/top-products`} icon={<i className='tabler-star' />}>
              {nav.topProducts}
            </MenuItem>
            <MenuItem href={`/${locale}/analytics/cashier-performance`} icon={<i className='tabler-user-check' />}>
              {nav.cashierPerformance}
            </MenuItem>
          </SubMenu>
        )}

        {/* Management - admin only */}
        {isAdmin && (
          <>
            <MenuItem href={`/${locale}/shifts`} icon={<i className='tabler-clock' />}>
              {nav.shifts}
            </MenuItem>
            <MenuItem href={`/${locale}/users`} icon={<i className='tabler-users' />}>
              {nav.users}
            </MenuItem>
          </>
        )}
      </Menu>
    </HorizontalNav>
  )
}

export default HorizontalMenu
