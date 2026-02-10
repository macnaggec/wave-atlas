---
applyTo: "src/app/actions/**/*.ts"
---
# Server Actions Guidelines

## Factory Selection

### Decision Criteria
```
Need authentication?
├─ YES
│  ├─ Form with inline errors (useActionState)? → createProtectedActionResult
│  └─ Throw errors (try/catch)? → createProtectedAction
└─ NO
   ├─ Form with inline errors (useActionState)? → createActionResult
   └─ Throw errors (try/catch)? → createAction
```

### Use Cases
- **createAction**: Public data fetching (spots, previews)
- **createProtectedAction**: User-specific operations (create, update, delete)
- **createActionResult**: Public forms (register, login, contact)
- **createProtectedActionResult**: Authenticated forms (profile update, settings)

### Rules
- Result variants return `{ success: boolean, data?, error? }` envelope
- Protected variants guarantee `ctx.user` (throws UnauthorizedError if missing)
- Always verify ownership in protected actions
- Use Zod v4 for schema validation
