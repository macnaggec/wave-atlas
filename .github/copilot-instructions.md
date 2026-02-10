# Wave Atlas

## Stack
Next.js 15 (App Router) | PostgreSQL + Prisma 7 | NextAuth.js v5 | Mantine UI 8 | Cloudinary | Zod 4

## Architecture: Feature-Sliced Design

Layers (import only from layers below):
1. **app/** - Next.js routes; **src/app/** - providers, actions, layouts
2. **src/views/** - Page components for routes
3. **src/widgets/** - Header, Footer, complex compositions
4. **src/features/** - Business interactions (Cart, Upload)
5. **src/entities/** - Domain types and mappers (Spot, Media, User)
6. **src/shared/** - Reusable code (ui, api, hooks, lib, errors)

## Conventions

### Validation
- Zod v4 syntax only (avoid deprecated APIs)
- Server Actions are the validation source of truth

### UI
- Mantine UI components for all UI elements
- Styling: Mantine props first, CSS Modules (`classes.root`) for custom layout

### Error Handling
- Use centralized error types from `src/shared/errors/`
- Server Actions return typed errors via action factories

## Key Files
- [src/app/actions/](../src/app/actions/) - Server Actions
