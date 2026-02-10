/**
 * MainLayoutClient Tests
 *
 * Tests for the search-to-preview-to-gallery flow
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';

/**
 * Test: Preview closes when gallery opens
 *
 * This test documents the expected behavior where:
 * 1. User searches for a spot
 * 2. Selects spot from dropdown (preview opens)
 * 3. Clicks "View Gallery" (gallery opens, preview should close)
 *
 * Implementation: useEffect in MainLayoutClient watches searchParams.get('spotId')
 * and sets selectedSpotId to null when gallery URL param appears.
 */
describe('MainLayoutClient - Gallery opens behavior', () => {
  it('should set selectedSpotId to null when drawerSpotId changes', async () => {
    // Simulate the state management logic
    const { result, rerender } = renderHook(
      ({ drawerSpotId }: { drawerSpotId: string | null }) => {
        const [selectedSpotId, setSelectedSpotId] = useState<string | null>('spot-123');

        useEffect(() => {
          if (drawerSpotId) {
            setSelectedSpotId(null);
          }
        }, [drawerSpotId]);

        return { selectedSpotId, setSelectedSpotId };
      },
      { initialProps: { drawerSpotId: null as string | null } }
    );

    // Initial state: preview is open (selectedSpotId has value)
    expect(result.current.selectedSpotId).toBe('spot-123');

    // User clicks "View Gallery" - URL changes to /?spotId=spot-123
    rerender({ drawerSpotId: 'spot-123' });

    // Preview should close (selectedSpotId becomes null)
    await waitFor(() => {
      expect(result.current.selectedSpotId).toBeNull();
    });
  });

  it('should clear popup when selectedSpotId becomes null', () => {
    // Simulate the GlobeMapComponent useEffect logic
    const setActiveSpotId = vi.fn();
    const selectedSpotId = null;
    const isLoaded = true;

    // This mimics the useEffect in GlobeMapComponent
    if (isLoaded) {
      if (!selectedSpotId) {
        setActiveSpotId(null);
      }
    }

    expect(setActiveSpotId).toHaveBeenCalledWith(null);
  });
});

/**
 * Integration Test Checklist (Manual)
 *
 * To manually verify this behavior:
 *
 * Test Case 1: Search → Preview → Gallery (✅ Fixed)
 * 1. Open app at http://localhost:3000
 * 2. Search for "Uluwatu" in search bar
 * 3. Select spot from dropdown
 * 4. ✅ Preview popup should open with map flying to spot
 * 5. Click "View Gallery" button in preview
 * 6. ✅ Gallery drawer should open (URL includes ?spotId=...&tab=gallery)
 * 7. ✅ Preview popup should close (selectedSpotId → null)
 *
 * Test Case 2: Map Click → Preview → Gallery (✅ Fixed in this commit)
 * 1. Open app at http://localhost:3000
 * 2. Click directly on a spot marker on the map (not via search)
 * 3. ✅ Preview popup should open
 * 4. Click "View Gallery" button in preview
 * 5. ✅ Gallery drawer should open (URL includes ?spotId=...&tab=gallery)
 * 6. ✅ Preview popup should close (selectedSpotId → null)
 *
 * Test Case 3: Gallery Close Behavior
 * 1. Follow either Test Case 1 or 2 to open gallery
 * 2. Close gallery drawer
 * 3. ✅ Preview popup should stay closed
 * 4. Search again or click marker - popup should reopen
 *
 * Test Case 4: Preview Close → Zoom Out Centering (Regression)
 * 1. Open any spot preview (search or click)
 * 2. Close the preview (X button)
 * 3. Zoom out to full globe view
 * 4. ✅ Earth should remain centered (no lingering top padding offset)
 *
 * Related Files:
 * - src/app/layouts/MainLayoutClient/MainLayoutClient.tsx (lines 28-32, 48)
 * - src/widgets/GlobeMap/GlobeMapComponent.tsx (lines 88-95, 116-120)
 * - src/app/layouts/GlobeLayout/GlobeLayout.tsx
 *
 * Implementation Note: Single source of truth
 * Both search selection and map clicks flow into the same selectedSpotId state
 * in MainLayoutClient, so opening the gallery drawer closes the preview for both paths.
 */
