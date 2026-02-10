'use client';

import { useMemo } from 'react';
import { MediaItem } from 'entities/Media/types';

/**
 * Validation rules for upload items
 */
export interface UploadValidationRules {
  /** Whether date (capturedAt) is required */
  requireDate?: boolean;
  /** Whether price must be set */
  requirePrice?: boolean;
  /** Whether spot ID must be assigned */
  requireSpot?: boolean;
}

/**
 * Options for useUploadValidation hook
 */
export interface UseUploadValidationOptions {
  /** Items to validate */
  items: MediaItem[];
  /** Validation rules to apply */
  rules?: UploadValidationRules;
}

/**
 * Validation result for a single item
 */
export interface ValidationResult {
  /** Whether the item has validation errors */
  hasError: boolean;
  /** Array of error messages */
  messages: string[];
}

/**
 * Return value from useUploadValidation hook
 */
export interface UseUploadValidationReturn {
  /** Validate a single item by ID */
  validate: (id: string) => ValidationResult;
  /** Validate all items and return Map of results */
  validateAll: () => Map<string, ValidationResult>;
  /** Whether any items have errors */
  hasErrors: boolean;
  /** Total count of items with errors */
  errorCount: number;
}

/**
 * Hook for validating upload items before publishing
 *
 * Business-specific validation logic for draft media items.
 * Lives in features/Upload (not shared) because rules are
 * domain-specific to the upload workflow.
 *
 * @example
 * ```tsx
 * const validation = useUploadValidation({
 *   items: uploadItems,
 *   rules: { requireDate: true, requirePrice: false },
 * });
 *
 * <DraftCard
 *   mediaItem={item}
 *   validation={validation.validate(item.id)}
 * />
 * ```
 */
export function useUploadValidation({
  items,
  rules = {},
}: UseUploadValidationOptions): UseUploadValidationReturn {
  const { requireDate = true, requirePrice = false, requireSpot = false } = rules;

  // Build validation map (memoized to prevent recalculation)
  const validationMap = useMemo(() => {
    const map = new Map<string, ValidationResult>();

    items.forEach((item) => {
      const messages: string[] = [];

      if (requireDate && !item.capturedAt) {
        messages.push('Date is required');
      }

      if (requirePrice && (item.price == null || item.price < 0)) {
        messages.push('Valid price is required');
      }

      if (requireSpot && !item.spotId) {
        messages.push('Spot assignment is required');
      }

      map.set(item.id, {
        hasError: messages.length > 0,
        messages,
      });
    });

    return map;
  }, [items, requireDate, requirePrice, requireSpot]);

  // Validate single item by ID
  const validate = (id: string): ValidationResult => {
    return validationMap.get(id) || { hasError: false, messages: [] };
  };

  // Validate all items
  const validateAll = () => {
    return validationMap;
  };

  // Check if any items have errors
  const hasErrors = useMemo(() => {
    return Array.from(validationMap.values()).some((result) => result.hasError);
  }, [validationMap]);

  // Count items with errors
  const errorCount = useMemo(() => {
    return Array.from(validationMap.values()).filter((result) => result.hasError)
      .length;
  }, [validationMap]);

  return {
    validate,
    validateAll,
    hasErrors,
    errorCount,
  };
}
