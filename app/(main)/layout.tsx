import { MainLayoutClient } from '../../src/app/layouts/MainLayoutClient';
import { getSpots } from 'app/actions/spot';

interface MainLayoutProps {
  children: React.ReactNode;
  drawer?: React.ReactNode; // Parallel route slot for drawer
}

/**
 * Main Layout - Globe-centric fullscreen experience
 *
 * Fetches spots server-side and passes to the client layout wrapper
 * which handles mode-specific interactions.
 */
export default async function MainLayout({ children, drawer }: MainLayoutProps) {
  // Fetch all spots server-side for initial globe markers
  const spots = await getSpots(undefined);

  return (
    <MainLayoutClient spots={spots}>
      {children}
      {drawer}
    </MainLayoutClient>
  );
}
