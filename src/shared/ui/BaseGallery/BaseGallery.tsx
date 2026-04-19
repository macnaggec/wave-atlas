'use client';

import React, { FC, ReactNode, memo, useCallback } from 'react';
import { Stack, Box } from '@mantine/core';
import styles from './BaseGallery.module.css';
import SelectionCheckbox from './SelectionCheckbox';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { MediaItem } from 'entities/Media/types';

/**
 * Reusable style objects to prevent inline object creation
 */
const POINTER_CURSOR = { cursor: 'pointer' } as const;
const DEFAULT_CURSOR = { cursor: 'default' } as const;
const RELATIVE_POSITION = { position: 'relative' as const };

/**
 * Context passed to renderCard for each item
 */
export interface CardContext {
  /** Index of the item in the array */
  index: number;
  /** Whether this is the first item */
  isFirst: boolean;
  /** Whether this is the last item */
  isLast: boolean;
  /** Whether selection mode is active (hides individual card actions) */
  isSelectionMode: boolean;
}

/**
 * Props for the BaseGallery component
 * @template T - Type of items in the gallery (defaults to MediaItem)
 */
export interface BaseGalleryProps<T = MediaItem> {
  /** Array of items to display in the gallery */
  items: T[];

  /** Render function for each card - receives item and context */
  renderCard: (item: T, context: CardContext) => ReactNode;

  /** Optional function to extract unique ID from each item */
  getId?: (item: T) => string;

  /** Optional selection state from useGallerySelection hook */
  selection?: UseGallerySelectionReturn<T>;

  /** Optional toolbar content displayed above the gallery grid */
  toolbar?: ReactNode;

  /** Optional content displayed before the gallery grid (e.g., AddFileCard) */
  prepend?: ReactNode;

  /** Optional empty state displayed when items array is empty */
  emptyState?: ReactNode;

  /** Grid gap spacing (Mantine spacing value or CSS value) */
  gap?: string | number;

  /** Accessibility label for the gallery */
  'aria-label'?: string;
}

/**
 * Gallery - Generic slot-based grid component for displaying media items
 *
 * Renders items in a responsive CSS Grid masonry layout with slots for
 * toolbars, custom cards, and empty states. Foundation component for
 * feature-specific galleries (PublicGallery, UploadGallery, etc.).
 *
 * @example
 * ```tsx
 * const selection = useGallerySelection({ items, getId: (i) => i.id });
 *
 * <Gallery
 *   items={items}
 *   selection={selection}  // Gallery handles selection UI
 *   toolbar={<SelectionToolbar selection={selection} />}
 *   prepend={<AddFileCard onFilesSelected={handleFiles} />}
 *   renderCard={(item, context) => (
 *     <DraftCard mediaItem={item} />  // No selection props needed
 *   )}
 * />
 * ```
 */
const BaseGallery = memo(<T extends { id: string } = MediaItem>({
  items,
  renderCard,
  getId = (item: T) => item.id,
  selection,
  toolbar,
  prepend,
  emptyState,
  gap = 'md',
  'aria-label': ariaLabel = 'Gallery',
}: BaseGalleryProps<T>) => {
  // Stable click handler to avoid creating new functions per item
  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const itemId = e.currentTarget.getAttribute('data-item-id');
      if (itemId && selection?.isSelectionMode) {
        selection.toggle(itemId);
      }
    },
    [selection]
  );

  return (
    <Stack gap={gap}>
      {/* Toolbar slot - for filters, selection controls, bulk actions */}
      {toolbar}

      {/* Main gallery grid */}
      <div className={styles.gallery} role="grid" aria-label={ariaLabel}>
        {/* Prepend slot - for special first items like AddFileCard */}
        {prepend && (
          <div className={styles['gallery-item']} role="gridcell">
            {prepend}
          </div>
        )}

        {items.map((item, index) => {
          const itemId = getId(item);
          const isSelected = selection?.isSelected(itemId) || false;
          const showCheckbox = selection?.isSelectionMode || false;

          return (
            <div
              key={itemId}
              className={styles['gallery-item']}
              role="gridcell"
              data-item-id={itemId}
              onClick={showCheckbox ? handleItemClick : undefined}
              style={showCheckbox ? POINTER_CURSOR : DEFAULT_CURSOR}
            >
              <div style={RELATIVE_POSITION}>
                {renderCard(item, {
                  index,
                  isFirst: index === 0,
                  isLast: index === items.length - 1,
                  isSelectionMode: showCheckbox,
                })}

                {/* Selection checkbox overlay */}
                {showCheckbox && (
                  <SelectionCheckbox checked={isSelected} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state slot - shown when no items */}
      {items.length === 0 && emptyState}
    </Stack>
  );
}) as <T extends { id: string } = MediaItem>(
  props: BaseGalleryProps<T>
) => React.ReactElement;

(BaseGallery as any).displayName = 'BaseGallery';

export default BaseGallery;
