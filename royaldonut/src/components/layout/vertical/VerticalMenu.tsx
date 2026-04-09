'use client'

// MUI Imports
import { useParams } from 'next/navigation'

import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

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
  const { isAdmin, isCashier, isKitchen } = useAuth()
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
        {/* Main - All roles */}
        <MenuSection label={nav.main}>
          <MenuItem href={`/${lang}/dashboard`} icon={<i className='tabler-smart-home' />}>
            {nav.dashboard}
          </MenuItem>
          {(isAdmin || isCashier) && (
            <MenuItem
              href={`/${lang}/pos`}
              icon={<i className='tabler-cash-register' />}
              className='bg-primary/5 border-l-4 border-primary'
            >
              <div className='flex items-center justify-between w-full'>
                <span>{nav.pos}</span>
                <Chip label='POS' size='small' color='primary' className='ml-2' />
              </div>
            </MenuItem>
          )}
        </MenuSection>

        {/* Kitchen - Kitchen role & Admin */}
        {(isAdmin || isKitchen) && (
          <MenuSection label={nav.kitchen}>
            <MenuItem href={`/${lang}/kitchen`} icon={<i className='tabler-chef-hat' />}>
              {nav.kitchenOrders}
            </MenuItem>
            <MenuItem href={`/${lang}/kitchen/logs`} icon={<i className='tabler-clipboard-list' />}>
              {nav.kitchenLogs}
            </MenuItem>
          </MenuSection>
        )}

        {/* Orders - Admin & Cashier */}
        {(isAdmin || isCashier) && (
          <MenuSection label={nav.orderManagement}>
            <MenuItem href={`/${lang}/orders`} icon={<i className='tabler-receipt' />}>
              {nav.orders}
            </MenuItem>
            {isAdmin && (
              <MenuItem href={`/${lang}/refunds`} icon={<i className='tabler-receipt-refund' />}>
                {nav.refunds}
              </MenuItem>
            )}
          </MenuSection>
        )}

        {/* Shop Management - Admin only */}
        {isAdmin && (
          <MenuSection label={nav.shopManagement}>
            <MenuItem href={`/${lang}/products`} icon={<i className='tabler-cookie' />}>
              {nav.products}
            </MenuItem>
            <MenuItem href={`/${lang}/categories`} icon={<i className='tabler-category' />}>
              {nav.categories}
            </MenuItem>
            <MenuItem href={`/${lang}/inventory`} icon={<i className='tabler-packages' />}>
              {nav.inventory}
            </MenuItem>
          </MenuSection>
        )}

        {/* Analytics & Management - Admin only */}
        {isAdmin && (
          <>
            <MenuSection label={nav.analytics}>
              <SubMenu label={nav.analytics} icon={<i className='tabler-chart-bar' />}>
                <MenuItem href={`/${lang}/analytics`} icon={<i className='tabler-dashboard' />}>
                  {nav.overview}
                </MenuItem>
                <MenuItem href={`/${lang}/analytics/sales`} icon={<i className='tabler-report-money' />}>
                  {nav.salesAnalytics}
                </MenuItem>
                <MenuItem href={`/${lang}/analytics/top-products`} icon={<i className='tabler-trophy' />}>
                  {nav.topProducts}
                </MenuItem>
                <MenuItem href={`/${lang}/analytics/cashier-performance`} icon={<i className='tabler-user-check' />}>
                  {nav.cashierPerformance}
                </MenuItem>
              </SubMenu>
              <MenuItem href={`/${lang}/shifts`} icon={<i className='tabler-clock' />}>
                {nav.shifts}
              </MenuItem>
            </MenuSection>
            <MenuSection label={nav.management}>
              <MenuItem href={`/${lang}/users`} icon={<i className='tabler-users-group' />}>
                {nav.users}
              </MenuItem>
            </MenuSection>
          </>
        )}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
