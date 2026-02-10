import { auth } from '../../../auth';
import { getSpotDetails } from 'app/actions/spot-details';
import { getDraftMedia } from 'app/actions/media';
import { SpotDrawerProvider } from './SpotDrawerContext';
import { SpotDrawerClient } from './SpotDrawerClient';

interface SpotDrawerWithDataProps {
  spotId: string;
}

/**
 * Server Component: SpotDrawer with Server-Side Data Fetching
 *
 * Handles all data fetching for the SpotDrawer:
 * - Checks authentication server-side
 * - Fetches spot details and draft media in parallel
 * - Provides data via context to child components
 *
 * Used by both intercepted and standalone spot routes to avoid duplication.
 *
 * @example
 * // In route (RSC):
 * <SpotDrawerWithData spotId="mavericks" />
 */
export async function SpotDrawerWithData({ spotId }: SpotDrawerWithDataProps) {
  // Check auth server-side (no extra request, just reads session cookie)
  const session = await auth();
  const isAuthenticated = !!session?.user;

  // Fetch spot details and user's draft media in parallel
  const [spotData, draftMedia] = await Promise.all([
    getSpotDetails(spotId),
    isAuthenticated ? getDraftMedia({ spotId }) : Promise.resolve(null),
  ]);

  return (
    <SpotDrawerProvider spotData={spotData} draftMedia={draftMedia}>
      <SpotDrawerClient />
    </SpotDrawerProvider>
  );
}
