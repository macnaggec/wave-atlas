'use client';

import { createContext, useContext, ReactNode } from 'react';
import { MediaItem } from 'entities/Media/types';
import { SpotDetailData } from 'app/actions/spot-details';

interface SpotDrawerContextValue {
  spotData: SpotDetailData | null;
  draftMedia: MediaItem[] | null;
}

const SpotDrawerContext = createContext<SpotDrawerContextValue | undefined>(undefined);

interface SpotDrawerProviderProps {
  spotData: SpotDetailData | null;
  draftMedia: MediaItem[] | null;
  children: ReactNode;
}

/**
 * Context Provider for SpotDrawer data
 *
 * Provides server-fetched spot details and draft media to nested components
 * without props drilling through intermediate layers.
 *
 * Auth state is handled by global SessionProvider.
 *
 * @example
 * // In route (RSC):
 * <SpotDrawerProvider spotData={spot} draftMedia={drafts}>
 *   <SpotDrawerClient />
 * </SpotDrawerProvider>
 */
export function SpotDrawerProvider({ spotData, draftMedia, children }: SpotDrawerProviderProps) {
  return (
    <SpotDrawerContext.Provider value={{ spotData, draftMedia }}>
      {children}
    </SpotDrawerContext.Provider>
  );
}

/**
 * Hook to consume SpotDrawer context
 *
 * @throws Error if used outside SpotDrawerProvider
 *
 * @example
 * const { spotData, draftMedia } = useSpotDrawerContext();
 */
export function useSpotDrawerContext() {
  const context = useContext(SpotDrawerContext);

  if (context === undefined) {
    throw new Error('useSpotDrawerContext must be used within SpotDrawerProvider');
  }

  return context;
}
