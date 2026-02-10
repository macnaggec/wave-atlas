import { SpotDrawerWithData } from 'widgets/SpotDrawer';

interface DrawerPageProps {
  params: Promise<{ spot: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Intercepted Drawer Route
 *
 * This route intercepts client-side navigation to /[spot] routes
 * and renders the drawer over the current page (SPA-like experience).
 *
 * Data fetching handled by SpotDrawerWithData server component.
 *
 * URL: /mavericks?tab=gallery
 */
export default async function DrawerPage({ params }: DrawerPageProps) {
  const { spot: spotId } = await params;

  return <SpotDrawerWithData spotId={spotId} />;
}
