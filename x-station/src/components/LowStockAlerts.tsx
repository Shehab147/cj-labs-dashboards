'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'

// API Import
import { cafeteriaApi } from '@/services/api'

// Auth Context
import { useAuth } from '@/contexts/authContext'

// Notification Queue Context
import { useNotificationQueue } from '@/contexts/notificationQueueContext'

// Dictionary Hook
import { useClientDictionary } from '@/hooks/useClientDictionary'

interface LowStockItem {
  id: number
  name: string
  stock: number
  price: number
  cost: number
  photo: string | null
}

// Poll interval in milliseconds (60 seconds - less frequent than booking alerts)
const POLL_INTERVAL = 60000

// Low stock threshold
const LOW_STOCK_THRESHOLD = 10

const LowStockAlerts = () => {
  const { isAuthenticated } = useAuth()
  const { addNotification } = useNotificationQueue()
  const dictionary = useClientDictionary()
  const stockAlerts = dictionary?.stockAlerts || {}
  const common = dictionary?.common || {}
  
  const [items, setItems] = useState<LowStockItem[]>([])
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const previousItemIds = useRef<Set<number>>(new Set())
  const hasShownInitialAlert = useRef(false)

  // Helper to convert numbers to Arabic numerals
  const toLocalizedNumber = useCallback((num: number): string => {
    const isArabic = dictionary?.navigation?.main === 'الرئيسية'
    if (isArabic) {
      return num.toString().replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
    }
    return num.toString()
  }, [dictionary])

  const showStockNotification = useCallback((stockItems: LowStockItem[]) => {
    const outOfStockCount = stockItems.filter(i => i.stock === 0).length
    addNotification({
      title: stockAlerts.lowStockWarning || 'Low Stock Warning!',
      message: (
        <>
          <strong>{toLocalizedNumber(stockItems.length)}</strong> {stockAlerts.itemsNeedAttention || 'item(s) need attention'}
          {outOfStockCount > 0 && (
            <>
              <br />
              <span style={{ color: '#ffcdd2' }}>
                {toLocalizedNumber(outOfStockCount)} {stockAlerts.outOfStockItems || 'out of stock'}
              </span>
            </>
          )}
        </>
      ),
      severity: 'error',
      duration: 8000
    })
  }, [addNotification, stockAlerts, toLocalizedNumber])

  const fetchLowStockItems = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await cafeteriaApi.getLowStock(LOW_STOCK_THRESHOLD)
      
      if (response.status === 'success' && response.data) {
        const newItems = response.data as LowStockItem[]
        
        // Check for new low stock items
        const currentIds = new Set(newItems.map(item => item.id))
        
        // Show notification on first load if there are items
        if (!hasShownInitialAlert.current && newItems.length > 0) {
          hasShownInitialAlert.current = true
          showStockNotification(newItems)
          previousItemIds.current = currentIds
          setItems(newItems)
          return
        }
        
        // Show notification for new low stock items (after initial load)
        const newLowStockItems = newItems.filter(item => !previousItemIds.current.has(item.id))
        if (newLowStockItems.length > 0 && hasShownInitialAlert.current) {
          showStockNotification(newLowStockItems)
        }
        
        previousItemIds.current = currentIds
        setItems(newItems)
      }
    } catch (error) {
      console.error('Failed to fetch low stock items:', error)
    }
  }, [isAuthenticated, showStockNotification])

  // Initial fetch and polling
  useEffect(() => {
    if (!isAuthenticated) return

    // Initial fetch
    fetchLowStockItems()

    // Set up polling interval
    const intervalId = setInterval(fetchLowStockItems, POLL_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAuthenticated, fetchLowStockItems])

  const handlePopoverOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handlePopoverClose = () => {
    setAnchorEl(null)
  }

  const getStockColor = (stock: number) => {
    if (stock === 0) return 'error'
    if (stock <= 5) return 'error'
    return 'warning'
  }

  const popoverOpen = Boolean(anchorEl)

  // Don't render if not authenticated
  if (!isAuthenticated) return null

  return (
    <>
      {/* Stock Alert Icon with Badge */}
      <Tooltip title={items.length > 0 ? `${toLocalizedNumber(items.length)} ${stockAlerts.itemsLowStock || 'item(s) low on stock'}` : (stockAlerts.noAlerts || 'Stock levels OK')}>
        <IconButton 
          onClick={handlePopoverOpen}
          sx={{ 
            position: 'fixed', 
            bottom: 140, 
            right: 24, 
            zIndex: 1200,
            bgcolor: items.length > 0 ? 'error.main' : 'background.paper',
            color: items.length > 0 ? 'error.contrastText' : 'text.primary',
            boxShadow: 3,
            '&:hover': {
              bgcolor: items.length > 0 ? 'error.dark' : 'action.hover',
            },
            animation: items.length > 0 ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.1)' },
              '100%': { transform: 'scale(1)' },
            }
          }}
        >
          <Badge badgeContent={toLocalizedNumber(items.length)} color="warning">
            <i className="tabler-package" style={{ fontSize: 24 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Alerts Popover */}
      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Box sx={{ width: 350, maxHeight: 400, overflow: 'auto' }}>
          <Box sx={{ p: 2, bgcolor: 'error.main' }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              <i className="tabler-alert-triangle" style={{ marginInlineEnd: 8 }} />
              {stockAlerts.title || 'Low Stock Alerts'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              {stockAlerts.subtitle || 'Items running low on stock'}
            </Typography>
          </Box>
          
          {items.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <i className="tabler-check-circle" style={{ fontSize: 48, color: '#4caf50' }} />
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {stockAlerts.allStocked || 'All items are well stocked'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {items.map((item, index) => (
                <Box key={item.id}>
                  <ListItem 
                    sx={{ 
                      bgcolor: item.stock === 0 ? 'error.lighter' : 'warning.lighter',
                      py: 2 
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {item.name}
                          </Typography>
                          <Chip 
                            label={item.stock === 0 
                              ? (stockAlerts.outOfStock || 'Out of stock')
                              : `${toLocalizedNumber(item.stock)} ${stockAlerts.left || 'left'}`
                            }
                            color={getStockColor(item.stock)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }} component="span">
                          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                            <i className="tabler-currency-dollar" style={{ marginRight: 4, fontSize: 14 }} />
                            {stockAlerts.price || 'Price'}: {toLocalizedNumber(item.price)} {common?.currency || 'EGP'}
                          </Typography>
                          {item.stock === 0 && (
                            <Typography variant="body2" color="error.main" fontWeight={500} component="span" sx={{ display: 'block' }}>
                              <i className="tabler-alert-circle" style={{ marginRight: 4, fontSize: 14 }} />
                              {stockAlerts.needsRestock || 'Needs immediate restock!'}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < items.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
          
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {stockAlerts.threshold || 'Threshold'}: {toLocalizedNumber(LOW_STOCK_THRESHOLD)} {stockAlerts.units || 'units'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stockAlerts.autoRefresh || 'Auto-refreshes every minute'}
            </Typography>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

export default LowStockAlerts
