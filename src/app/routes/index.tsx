import { createFileRoute } from '@tanstack/react-router';

// Globe is always rendered by the root layout — this route renders nothing.
export const Route = createFileRoute('/')({
  component: () => null,
});
