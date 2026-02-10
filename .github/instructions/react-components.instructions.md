---
applyTo: "**/*.tsx"
---
# React Component Guidelines

## Component Structure
- Server Components by default; add `'use client'` only when needed
- Place in appropriate FSD layer based on scope
- Use Mantine UI components for all UI elements

## State Management
- Client state: `useState`, `useReducer`, `useTransition` only
- Server state: Server Actions via `startTransition`
- No prop drilling; lift state to appropriate parent

## Performance Patterns
- Wrap heavy components (Gallery, MediaCard, lists) with `React.memo`
- Extract event handlers to `useCallback`
- Extract computed values/objects to `useMemo`
- No inline `style={{ }}` objects; use CSS Modules or `useMemo`

## Cleanup Requirements (Memory Leak Prevention)
- `useEffect` must return cleanup for subscriptions/timers
- `addEventListener` paired with `removeEventListener`
- `setTimeout`/`setInterval` cleared in cleanup
- Destroy third-party instances: `hls.destroy()`, `map.remove()`
- `URL.createObjectURL()` paired with `URL.revokeObjectURL()`
- Use AbortController for async operations in effects
