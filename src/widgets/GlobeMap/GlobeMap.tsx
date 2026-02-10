'use client';

import dynamic from 'next/dynamic';
import { Loader } from '@mantine/core';
import type { GlobeMapProps, GlobeMapHandle, PageMode } from './GlobeMapComponent';
import classes from './GlobeMap.module.css';

/**
 * GlobeMap - Fullscreen interactive 3D globe with spot markers
 *
 * Uses Mapbox GL JS with globe projection for an immersive experience.
 * Dynamically imported to prevent SSR issues with WebGL.
 */
const GlobeMap = dynamic(
  () => import('./GlobeMapComponent').then((mod) => mod.GlobeMapComponent),
  {
    ssr: false,
    loading: () => (
      <div className={classes.globeContainer}>
        <div className={classes.loading}>
          <Loader color="blue" size="lg" />
        </div>
      </div>
    ),
  }
);

export { GlobeMap };
export type { GlobeMapProps, GlobeMapHandle, PageMode };
