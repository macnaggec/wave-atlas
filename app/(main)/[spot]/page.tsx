import { SpotDrawerWithData } from 'widgets/SpotDrawer';
import HomePage from 'views/HomePage/ui/HomePage';

interface SpotPageProps {
  params: Promise<{ spot: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Standalone Spot Page
 *
 * This route handles direct navigation to /[spot] URLs
 * (typed directly, refreshed, or shared links).
 *
 * Renders the same drawer UI over the homepage background
 * to maintain visual consistency with intercepted routes.
 *
 * Data fetching handled by SpotDrawerWithData server component.
 *
 * URL: /mavericks?tab=gallery
 */
export default async function SpotPage({ params }: SpotPageProps) {
  const { spot: spotId } = await params;

  return (
    <>
      <HomePage />
      <SpotDrawerWithData spotId={spotId} />
    </>
  );
}
