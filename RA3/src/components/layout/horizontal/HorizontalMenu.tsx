'use client'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Type Imports
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import HorizontalNav, { Menu, MenuItem } from '@menu/horizontal-menu'
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

type RenderExpandIconProps = { level?: number }
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
  const verticalNavOptions = useVerticalNav()
  const theme = useTheme()
  const params = useParams()
  const { isAdmin, isSuperAdmin, isEngineer } = useAuth()

  const { transitionDuration } = verticalNavOptions
  const { lang: locale } = params
  const nav = dictionary['navigation']

  return (
    <HorizontalNav
      switchToVertical
      verticalNavContent={VerticalNavContent}
      verticalNavProps={{
        customStyles: verticalNavigationCustomStyles(verticalNavOptions, theme),
        backgroundColor: 'var(--mui-palette-background-paper)',
      }}
    >
      <Menu
        rootStyles={menuRootStyles(theme)}
        renderExpandIcon={({ level }) => <RenderExpandIcon level={level} />}
        menuItemStyles={menuItemStyles(theme, 'tabler-circle')}
        renderExpandedMenuItemIcon={{ icon: <i className='tabler-circle text-xs' /> }}
        popoutMenuOffset={{
          mainAxis: ({ level }) => (level && level > 0 ? 14 : 12),
          alignmentAxis: 0,
        }}
        verticalMenuProps={{
          menuItemStyles: verticalMenuItemStyles(verticalNavOptions, theme),
          renderExpandIcon: ({ open }) => (
            <RenderVerticalExpandIcon open={open} transitionDuration={transitionDuration} />
          ),
          renderExpandedMenuItemIcon: { icon: <i className='tabler-circle text-xs' /> },
          menuSectionStyles: verticalMenuSectionStyles(verticalNavOptions, theme),
        }}
      >
        {isAdmin && (
          <>
            <MenuItem href={`/${locale}/admin/dashboard`} icon={<i className='tabler-smart-home' />}>
              {nav.dashboard}
            </MenuItem>
            <MenuItem href={`/${locale}/admin/requests`} icon={<i className='tabler-clipboard-list' />}>
              {nav.requests}
            </MenuItem>
            <MenuItem href={`/${locale}/admin/engineers`} icon={<i className='tabler-tool' />}>
              {nav.engineers}
            </MenuItem>
            <MenuItem href={`/${locale}/admin/zones`} icon={<i className='tabler-map-pin' />}>
              {nav.geoZones}
            </MenuItem>
            {isSuperAdmin && (
              <>
                <MenuItem href={`/${locale}/admin/admins`} icon={<i className='tabler-shield-lock' />}>
                  {nav.admins}
                </MenuItem>
                <MenuItem href={`/${locale}/admin/logs`} icon={<i className='tabler-history' />}>
                  {nav.auditLogs}
                </MenuItem>
              </>
            )}
          </>
        )}

        {isEngineer && (
          <>
            <MenuItem href={`/${locale}/engineer/dashboard`} icon={<i className='tabler-smart-home' />}>
              {nav.dashboard}
            </MenuItem>
            <MenuItem href={`/${locale}/engineer/requests`} icon={<i className='tabler-clipboard-list' />}>
              {nav.myRequests}
            </MenuItem>
          </>
        )}
      </Menu>
    </HorizontalNav>
  )
}

export default HorizontalMenu
