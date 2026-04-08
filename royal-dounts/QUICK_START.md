# Quick Start Guide

## What Changed?

### 🎯 Before: Success messages stayed forever
```
User clicks "Save" → Message appears: "Saved successfully!" → Stays on screen forever
```

### ✨ After: Success messages auto-dismiss
```
User clicks "Save" → Message appears: "Saved successfully!" → Fades away after 3 seconds
                   → Data refreshes in background (no loading spinner)
```

## How to Use in Your Component

### Step 1: Import the hook
```typescript
import { useNotification } from '@/hooks/useNotification'
```

### Step 2: Use it in your component
```typescript
const MyComponent = () => {
  // Instead of:
  // const [error, setError] = useState<string | null>(null)
  // const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Use this:
  const { successMessage, error, showSuccess, showError, clearSuccess, clearError } = useNotification()

  // ... rest of your component
}
```

### Step 3: Update your API calls
```typescript
const handleSave = async () => {
  try {
    const response = await api.update(data)
    
    if (response.status === 'success') {
      // Old way:
      // setSuccessMessage('Saved!')
      // fetchData()

      // New way:
      showSuccess('Saved!')      // Auto-dismisses after 3s
      await fetchData()          // Silent refresh (no spinner)
    } else {
      // Old way:
      // setError(response.message)

      // New way:
      showError(response.message) // Stays until user closes
    }
  } catch (err) {
    showError('Network error')
  }
}
```

### Step 4: Update your Alert components
```typescript
// Old way:
{successMessage && (
  <Alert severity='success' onClose={() => setSuccessMessage(null)}>
    {successMessage}
  </Alert>
)}

// New way:
{successMessage && (
  <Alert severity='success' onClose={clearSuccess}>
    {successMessage}
  </Alert>
)}
```

## That's It! 🎉

Now your notifications will:
- ✅ Auto-dismiss after 3 seconds
- ✅ Refresh data silently in the background
- ✅ Provide a smoother user experience

## Want to Customize?

### Change auto-dismiss duration:
```typescript
// 5 seconds instead of 3
showSuccess('Message', { duration: 5000 })

// Never auto-dismiss
showSuccess('Important!', { autoDismiss: false })
```

### Set default duration for all notifications:
```typescript
const notification = useNotification({ duration: 5000 })
```

## Examples Already Working

Visit these pages to see it in action:
- `/en/rooms/list` - Add, edit, or delete a room
- `/en/customers/list` - Manage customers

Watch how:
1. Success message appears
2. Auto-dismisses after 3 seconds
3. Data refreshes without any loading spinner!
