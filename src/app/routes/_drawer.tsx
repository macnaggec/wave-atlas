import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_drawer')({
  component: DrawerLayout,
});

/**
 * DrawerLayout — pathless layout route for all spot panel routes.
 *
 * Drawer.Root is owned by __root.tsx (always mounted).
 * This layout simply passes children through so child routes
 * (/$spotId, /me) can render Drawer.Header, Drawer.Body, etc.
 * inside the root-owned Drawer.Content.
 */
function DrawerLayout() {
  return <Outlet />;
}
