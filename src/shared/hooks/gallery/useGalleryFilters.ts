'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Filter configuration for gallery items
 * Used for server-side filtering with URL param synchronization
 */
export interface GalleryFilters {
  /** Single date filter in ISO format (e.g., "2026-02-06") */
  date?: string;
  /** Minimum price filter */
  minPrice?: number;
  /** Maximum price filter */
  maxPrice?: number;
}

/**
 * Return value from useGalleryFilterState hook
 */
export interface UseGalleryFilterStateReturn {
  /** Applied filters (active, used by consumer for data fetching) */
  filters: GalleryFilters;
  /** Draft filters (being edited, bound to form inputs) */
  draftFilters: GalleryFilters;
  /** Update draft filters (supports partial updates and functional updates) */
  setDraftFilters: (
    filters: Partial<GalleryFilters> | ((prev: GalleryFilters) => GalleryFilters)
  ) => void;
  /** Apply draft filters → update applied state + URL params */
  applyFilters: () => void;
  /** Whether draft differs from applied (for Apply button enable state) */
  hasUnappliedChanges: boolean;
  /** Clear both draft and applied filters, reset URL */
  clearFilters: () => void;
}

/**
 * Hook for managing gallery filter state with Apply button pattern
 *
 * Separates draft (editing) from applied (active) filter state.
 * Synchronizes applied filters with URL params for shareability and SSR support.
 * Designed for server-side filtering with hundreds/thousands of items.
 *
 * @example
 * ```tsx
 * const {
 *   filters,           // Use for Server Action calls
 *   draftFilters,      // Bind to filter inputs
 *   setDraftFilters,   // Update on input change
 *   applyFilters,      // Call on Apply button click
 *   hasUnappliedChanges, // Disable Apply button when false
 *   clearFilters,      // Reset all filters
 * } = useGalleryFilterState();
 *
 * // Trigger refetch when applied filters change
 * useEffect(() => {
 *   fetchItems(filters);
 * }, [filters]);
 *
 * // Bind inputs to draft
 * <DateInput
 *   value={draftFilters.date}
 *   onChange={(date) => setDraftFilters({ date })}
 * />
 *
 * // Apply button
 * <Button
 *   onClick={applyFilters}
 *   disabled={!hasUnappliedChanges}
 * >
 *   Apply
 * </Button>
 * ```
 */
export function useGalleryFilterState(): UseGalleryFilterStateReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL params once on mount
  const initialFilters = useMemo(() => {
    const date = searchParams.get('date') || undefined;
    const minPriceParam = searchParams.get('minPrice');
    const maxPriceParam = searchParams.get('maxPrice');

    return {
      date,
      minPrice: minPriceParam ? Number(minPriceParam) : undefined,
      maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
    };
  }, []); // Empty deps - only parse once on mount

  // Both start with same values from URL
  const [filters, setFilters] = useState<GalleryFilters>(initialFilters);
  const [draftFilters, setDraftFiltersState] =
    useState<GalleryFilters>(initialFilters);

  // Wrapped setter to support both partial and functional updates
  const setDraftFilters = useCallback(
    (
      update: Partial<GalleryFilters> | ((prev: GalleryFilters) => GalleryFilters)
    ) => {
      setDraftFiltersState((prev) => {
        if (typeof update === 'function') {
          return update(prev);
        }
        return { ...prev, ...update };
      });
    },
    []
  );

  // Check if draft differs from applied
  const hasUnappliedChanges = useMemo(() => {
    return (
      draftFilters.date !== filters.date ||
      draftFilters.minPrice !== filters.minPrice ||
      draftFilters.maxPrice !== filters.maxPrice
    );
  }, [draftFilters, filters]);

  // Apply draft → applied + URL sync
  const applyFilters = useCallback(() => {
    // Update applied state (consumer reads this)
    setFilters(draftFilters);

    // Build new URL search params
    const params = new URLSearchParams();

    if (draftFilters.date) {
      params.set('date', draftFilters.date);
    }

    if (draftFilters.minPrice !== undefined) {
      params.set('minPrice', String(draftFilters.minPrice));
    }

    if (draftFilters.maxPrice !== undefined) {
      params.set('maxPrice', String(draftFilters.maxPrice));
    }

    // Update URL without full navigation or scroll
    router.push(`?${params.toString()}`, { scroll: false });
  }, [draftFilters, router]);

  // Clear both draft and applied
  const clearFilters = useCallback(() => {
    const emptyFilters: GalleryFilters = {
      date: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    };

    setDraftFiltersState(emptyFilters);
    setFilters(emptyFilters);

    // Clear URL params
    router.push('?', { scroll: false });
  }, [router]);

  return {
    filters,
    draftFilters,
    setDraftFilters,
    applyFilters,
    hasUnappliedChanges,
    clearFilters,
  };
}
