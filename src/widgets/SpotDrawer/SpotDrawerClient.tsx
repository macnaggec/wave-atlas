'use client';

import { useEffect, useState } from 'react';
import { SpotDrawer } from './SpotDrawer';

// Track if current drawer instance has animated
let hasAnimated = false;

/**
 * Client wrapper for SpotDrawer that handles mount transitions
 *
 * Delays opening the drawer by one tick to trigger Mantine's
 * slide-in animation on client-side navigation.
 *
 * Prevents animation delay on remounts (e.g., tab changes).
 *
 * Pure technical component - knows nothing about data.
 */
export function SpotDrawerClient() {
  const [opened, setOpened] = useState(() => hasAnimated);

  useEffect(() => {
    // Only apply animation delay on first render
    if (!hasAnimated) {
      const timer = setTimeout(() => {
        setOpened(true);
        hasAnimated = true;
      }, 10);

      return () => {
        clearTimeout(timer);
        hasAnimated = false;
      };
    } else {
      // Already animated, stay open
      setOpened(true);

      return () => {
        hasAnimated = false;
      };
    }
  }, []);

  return <SpotDrawer opened={opened} />;
}
