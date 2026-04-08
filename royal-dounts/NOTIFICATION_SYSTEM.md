# Notification and Data Refresh System

This project now includes an improved notification and data refresh system that automatically:
1. **Auto-dismisses success notifications** after 3 seconds (configurable)
2. **Silently refreshes data** after successful API operations
3. **Provides consistent notification management** across all views

## New Hooks

### `useNotification`
Located in `src/hooks/useNotification.ts`

Manages success and error notifications with automatic dismissal.

#### Usage:

```typescript
import { useNotification } from '@/hooks/useNotification'

const MyComponent = () => {
  const { successMessage, error, showSuccess, showError, clearSuccess, clearError } = useNotification()

  const handleSubmit = async () => {
    try {
      const response = await api.create(data)
      
      if (response.status === 'success') {
        // Auto-dismisses after 3 seconds
        showSuccess('Item created successfully')
        
        // Silent refresh - no page reload
        await fetchData()
      } else {
        // Does not auto-dismiss (errors persist until user closes)
        showError(response.message)
      }
    } catch (err) {
      showError('Network error occurred')
    }
  }

  return (
    <>
      {error && (
        <Alert severity='error' onClose={clearError}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity='success' onClose={clearSuccess}>
          {successMessage}
        </Alert>
      )}
    </>
  )
}
```

#### API:

- **`successMessage`**: Current success message (null if none)
- **`error`**: Current error message (null if none)
- **`showSuccess(message, options?)`**: Display success notification
  - `options.autoDismiss`: Auto-dismiss after duration (default: true)
  - `options.duration`: Duration in ms (default: 3000)
- **`showError(message, options?)`**: Display error notification
  - `options.autoDismiss`: Auto-dismiss after duration (default: false)
  - `options.duration`: Duration in ms (default: 3000)
- **`clearSuccess()`**: Manually clear success message
- **`clearError()`**: Manually clear error message
- **`clearAll()`**: Clear both messages

#### Configuration:

```typescript
// Custom default duration (5 seconds)
const notification = useNotification({ duration: 5000 })

// Disable auto-dismiss by default
const notification = useNotification({ autoDismiss: false })

// Override per call
showSuccess('Message', { duration: 2000, autoDismiss: false })
```

### `useDataRefresh`
Located in `src/hooks/useDataRefresh.ts`

Handles API calls with automatic data refresh on success.

#### Usage:

```typescript
import { useDataRefresh } from '@/hooks/useDataRefresh'

const MyComponent = () => {
  const { showSuccess, showError } = useNotification()
  
  const { execute, isLoading } = useDataRefresh({
    onSuccess: async () => {
      // This is the "silent refresh"
      await fetchData()
    },
    showSuccessNotification: showSuccess,
    showErrorNotification: showError
  })

  const handleDelete = async () => {
    await execute(async () => {
      const response = await api.delete(id)
      if (response.status === 'success') {
        showSuccess('Deleted successfully')
      }
      return response
    })
    // Data is automatically refreshed via onSuccess callback
  }
}
```

## Migration Guide

### Old Pattern:
```typescript
const [error, setError] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string | null>(null)

const handleSubmit = async () => {
  try {
    const response = await api.create(data)
    if (response.status === 'success') {
      setSuccessMessage('Success!')
      fetchData() // Not awaited
    } else {
      setError(response.message)
    }
  } catch (err) {
    setError('Error')
  }
}

// JSX
<Alert severity='error' onClose={() => setError(null)}>
<Alert severity='success' onClose={() => setSuccessMessage(null)}>
```

### New Pattern:
```typescript
import { useNotification } from '@/hooks/useNotification'

const { successMessage, error, showSuccess, showError, clearSuccess, clearError } = useNotification()

const handleSubmit = async () => {
  try {
    const response = await api.create(data)
    if (response.status === 'success') {
      showSuccess('Success!') // Auto-dismisses after 3s
      await fetchData() // Silent refresh
    } else {
      showError(response.message)
    }
  } catch (err) {
    showError('Error')
  }
}

// JSX
<Alert severity='error' onClose={clearError}>
<Alert severity='success' onClose={clearSuccess}>
```

## Files Already Migrated

✅ `src/views/xstation/rooms/RoomsList.tsx` - Fully migrated
✅ `src/views/xstation/customers/CustomersList.tsx` - Fully migrated

## Benefits

1. **Consistent UX**: All success messages auto-dismiss uniformly
2. **Silent Refresh**: Data updates without page reload or loading spinners
3. **Clean Code**: Less boilerplate, clearer intent
4. **Configurable**: Easy to adjust timing per notification
5. **Type-Safe**: Full TypeScript support

## Best Practices

1. **Always await data refresh**: Use `await fetchData()` after successful operations
2. **Keep fetch functions simple**: Don't show loading spinners during silent refresh
3. **Use appropriate durations**: 
   - Quick actions (save, delete): 3000ms (default)
   - Long operations: 5000ms
   - Critical info: Disable auto-dismiss
4. **Error notifications don't auto-dismiss**: Users need time to read errors

## Examples

### Simple Save Operation
```typescript
const handleSave = async () => {
  setIsSubmitting(true)
  try {
    const response = await roomApi.update(data)
    if (response.status === 'success') {
      showSuccess('Room updated successfully')
      handleCloseDialog()
      await fetchRooms() // Silent refresh
    } else {
      showError(response.message)
    }
  } catch (err) {
    showError('Network error')
  } finally {
    setIsSubmitting(false)
  }
}
```

### Delete with Confirmation
```typescript
const handleDelete = async () => {
  setIsSubmitting(true)
  try {
    const response = await api.delete(id)
    if (response.status === 'success') {
      showSuccess('Deleted successfully')
      setDeleteDialogOpen(false)
      await fetchData() // Silent refresh
    } else {
      showError(response.message)
    }
  } catch (err) {
    showError('Failed to delete')
  } finally {
    setIsSubmitting(false)
  }
}
```

### Multiple Operations
```typescript
const handleBulkUpdate = async () => {
  try {
    await Promise.all(items.map(item => api.update(item)))
    showSuccess(`${items.length} items updated`, { duration: 4000 })
    await fetchData() // Single refresh after all complete
  } catch (err) {
    showError('Some items failed to update')
  }
}
```
