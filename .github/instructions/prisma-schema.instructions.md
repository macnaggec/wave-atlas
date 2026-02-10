---
applyTo: "prisma/schema.prisma"
---
# Prisma Schema Guidelines

## Naming Conventions
- Models: PascalCase (`MediaItem`, `User`)
- Fields: camelCase (`photographerId`, `createdAt`)
- Use `@map()` for snake_case database columns
- Use `@@map()` for snake_case table names

## Required Patterns
```prisma
model Example {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  @@map("examples")
}
```

## After Schema Changes
1. Run `npx prisma migrate dev --name descriptive-name`
2. Or for dev: `npx prisma db push`
3. Regenerate client: `npx prisma generate`
