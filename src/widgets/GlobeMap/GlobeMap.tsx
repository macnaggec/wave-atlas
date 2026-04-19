import { lazy, Suspense } from 'react';
import { Loader } from '@mantine/core';
import { SpotPreviewCard } from 'features/SpotPreview';
import type { GlobeMapProps, GlobeMapHandle, PageMode } from './GlobeMapComponent';
import type { Spot } from 'entities/Spot/types';
import classes from './GlobeMap.module.css';

/**
 * GlobeMap - Fullscreen interactive 3D globe with spot markers
 *
 * Uses Mapbox GL JS with globe projection for an immersive experience.
 * Lazily loaded to prevent bundling WebGL at boot time.
 *
 * Provides the default renderPopupContent (SpotPreviewCard) so consumers
 * don't need to wire it unless they want to override.
 */
const GlobeMapLazy = lazy(() =>
  import('./GlobeMapComponent').then((mod) => ({ default: mod.GlobeMapComponent }))
);

const defaultRenderPopupContent = (spot: Spot) => <SpotPreviewCard spot={spot} />;

export function GlobeMap(props: GlobeMapProps) {
  return (
    <Suspense
      fallback={
        <div className={classes.globeContainer}>
          <div className={classes.loading}>
            <Loader color="blue" size="lg" />
          </div>
        </div>
      }
    >
      <GlobeMapLazy renderPopupContent={defaultRenderPopupContent} {...props} />
    </Suspense>
  );
}

export type { GlobeMapProps, GlobeMapHandle, PageMode };
