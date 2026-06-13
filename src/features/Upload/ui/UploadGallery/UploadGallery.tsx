import React, { FC, memo } from 'react';
import { QueueItem, UploadItemAction } from '../../model';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import StepModeModal from './StepModeModal';

export interface UploadGalleryProps {
  items: QueueItem[];
  hasActiveUploads: boolean;
  onRemove: (id: string) => Promise<void>;
  onAddFiles?: (files: File[]) => void;
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
  onRetry?: (id: string) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
  onAction?: (action: UploadItemAction, itemId: string) => void;
  selection: UseGallerySelectionReturn<QueueItem>;
  onProceed: (count: number) => void;
  onCancelAll?: () => void;
  onDiscardAll: (items: QueueItem[]) => void;
  hideZone?: boolean;
  externalModalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
}

const UploadGallery: FC<UploadGalleryProps> = memo(({
  items,
  hasActiveUploads,
  onRemove,
  onAddFiles,
  onDriveImport,
  driveLoading,
  onBulkPriceEdit,
  onRetry,
  onAction,
  selection,
  onProceed,
  onCancelAll,
  onDiscardAll,
  hideZone = false,
  externalModalOpen,
  onModalOpenChange,
  onPricesChange,
}) => (
  <StepModeModal
    items={items}
    hasActiveUploads={hasActiveUploads}
    selection={selection}
    onProceed={onProceed}
    onDiscardAll={onDiscardAll}
    onRemove={onRemove}
    onCancelAll={onCancelAll}
    onAddFiles={onAddFiles}
    onBulkPriceEdit={onBulkPriceEdit}
    onAction={onAction}
    onRetry={onRetry}
    onDriveImport={onDriveImport}
    driveLoading={driveLoading}
    onPricesChange={onPricesChange}
    hideZone={hideZone}
    externalModalOpen={externalModalOpen}
    onModalOpenChange={onModalOpenChange}
  />
));

UploadGallery.displayName = 'UploadGallery';

export default UploadGallery;
