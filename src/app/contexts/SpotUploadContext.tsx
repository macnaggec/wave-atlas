import { createContext, useContext } from 'react';

/**
 * Thin context connecting SpotLayout (parent route) → UploadTab (child route).
 * The only signal: "a publish just succeeded" → set hasNewGallery in SpotLayout.
 */
export interface SpotUploadContextValue {
  onPublishSuccess: (mediaIds: string[]) => void;
  onQueueChange: (count: number) => void;
}

export const SpotUploadContext = createContext<SpotUploadContextValue>({
  onPublishSuccess: () => { },
  onQueueChange: () => { },
});

export function useSpotUploadContext() {
  return useContext(SpotUploadContext);
}
