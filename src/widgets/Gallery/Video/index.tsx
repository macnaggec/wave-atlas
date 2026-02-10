'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded Video component
 * HLS.js (~240KB) is only loaded when a video is rendered
 */
export const Video = dynamic(() => import('./Video'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        aspectRatio: '16/9',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}
    >
      Loading video...
    </div>
  ),
});

export default Video;
