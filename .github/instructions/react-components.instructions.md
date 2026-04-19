---
applyTo: "**/*.tsx"
---
# React Component Guidelines

## Component Structure
- Keep docs descriptive and concise, focus on what the component is for.
- Specify responsibility of the component, keep it focused on a single task
- Place in appropriate FSD layer based on scope
- Use Mantine UI components for all UI elements
- Split parameters by new line for readability if there are more than 2
- Split component props by new line for readability if there is more than 1

## State Management

## Performance Patterns
- Wrap heavy components (Gallery, MediaCard, lists) with `React.memo`
- No inline handlers; Extract to `useCallback`
- No inline `style={{ }}` objects; use CSS Modules or `useMemo`
- Extract computed values/objects to `useMemo`

## Cleanup Requirements (Memory Leak Prevention)
- `useEffect` must return cleanup for subscriptions/timers/listeners

