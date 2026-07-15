import { useMatches } from '@tanstack/react-router';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip';
import { useAddSpotStore } from 'features/AddSpot';
import { deriveAppChromePolicy } from 'shared/model/appChromePolicy';

export function AppShell() {
  const isAddSpotActive = useAddSpotStore((s) => s.isActive);
  const matches = useMatches();
  const isFullPageRouteActive = matches.some((match) => match.routeId === '/_page');
  const chromePolicy = deriveAppChromePolicy({ isAddSpotActive, isFullPageRouteActive });

  return (
    <>
      {!isFullPageRouteActive && <GlobeScene />}
      {chromePolicy.showLeftStrip && <LeftStrip />}
    </>
  );
}
