'use client'

// MUI Imports
import { useParams } from 'next/navigation'

import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import { Menu, MenuItem, MenuSection } from '@menu/vertical-menu'

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
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const { isAdmin, isSuperAdmin, isEngineer } = useAuth()
  const params = useParams()
  const lang = params.lang as string

  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar
  const nav = dictionary['navigation']

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false),
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true),
          })}
    >
      <Menu
        popoutMenuOffset={{ mainAxis: 23 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='tabler-circle text-xs' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {isAdmin && (
          <>
            <MenuSection label={nav.main}>
              <MenuItem href={`/${lang}/admin/dashboard`} icon={<i className='tabler-smart-home' />}>
                {nav.dashboard}
              </MenuItem>
            </MenuSection>
            <MenuSection label={nav.operations}>
              <MenuItem href={`/${lang}/admin/requests`} icon={<i className='tabler-clipboard-list' />}>
                {nav.requests}
              </MenuItem>
              <MenuItem href={`/${lang}/admin/engineers`} icon={<i className='tabler-tool' />}>
                {nav.engineers}
              </MenuItem>
              <MenuItem href={`/${lang}/admin/zones`} icon={<i className='tabler-map-pin' />}>
                {nav.geoZones}
              </MenuItem>
            </MenuSection>
            {isSuperAdmin && (
              <MenuSection label={nav.management}>
                <MenuItem href={`/${lang}/admin/admins`} icon={<i className='tabler-shield-lock' />}>
                  {nav.admins}
                </MenuItem>
                <MenuItem href={`/${lang}/admin/logs`} icon={<i className='tabler-history' />}>
                  {nav.auditLogs}
                </MenuItem>
              </MenuSection>
            )}
          </>
        )}

        {isEngineer && (
          <MenuSection label={nav.main}>
            <MenuItem href={`/${lang}/engineer/dashboard`} icon={<i className='tabler-smart-home' />}>
              {nav.dashboard}
            </MenuItem>
            <MenuItem href={`/${lang}/engineer/requests`} icon={<i className='tabler-clipboard-list' />}>
              {nav.myRequests}
            </MenuItem>
          </MenuSection>
        )}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
