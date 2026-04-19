import { create } from 'zustand';
import { UploadItem } from 'features/Upload/model/types';

interface UploadState {
  // Current upload context
  uploadingSpotId: string | null;
  uploadingSpotName: string | null;
  uploadQueue: UploadItem[];

  // Session-scoped monotonic counters for the upload plate display.
  // Incremented-only within a batch; never derived from queue length.
  sessionTotal: number;
  sessionCompleted: number;
}

interface UploadActions {
  // Set the active upload context for a spot
  setSpotContext: (spotId: string, spotName: string | null) => void;

  // Add items to the upload queue (resets session counters when starting fresh)
  addToQueue: (items: UploadItem[]) => void;

  // Increment completed counter when an upload finishes successfully
  incrementSessionCompleted: () => void;

  // Update a specific upload item
  updateItem: (id: string, updates: Partial<UploadItem>) => void;

  // Remove an item from the queue
  removeItem: (id: string) => void;

  // Clear all completed uploads
  clearCompleted: () => void;

  // Clear entire queue (for spot context switch)
  clearQueue: () => void;

  // Check if a specific spot is currently uploading
  isUploadingForSpot: (spotId: string) => boolean;
}

interface UploadStore extends UploadState, UploadActions { }

export const useUploadStore = create<UploadStore>((set, get) => ({
  // Initial state
  uploadingSpotId: null,
  uploadingSpotName: null,
  uploadQueue: [],
  sessionTotal: 0,
  sessionCompleted: 0,

  // Actions
  setSpotContext: (spotId: string, spotName: string | null) => {
    // Set the upload context without clearing queue.
    // Completed items are cleared after router.refresh() in useUploadManager
    // to avoid losing visibility before RSC draftMedia is updated.
    set({ uploadingSpotId: spotId, uploadingSpotName: spotName });
  },

  addToQueue: (items: UploadItem[]) => {
    set(state => {
      // Reset session counters when starting a new batch (queue is idle).
      // Appending to an active batch increments total only.
      const isNewBatch = state.uploadQueue.length === 0;
      return {
        uploadQueue: [...state.uploadQueue, ...items],
        sessionTotal: isNewBatch ? items.length : state.sessionTotal + items.length,
        sessionCompleted: isNewBatch ? 0 : state.sessionCompleted,
      };
    });
  },

  incrementSessionCompleted: () => {
    set(state => ({ sessionCompleted: state.sessionCompleted + 1 }));
  },

  updateItem: (id: string, updates: Partial<UploadItem>) => {
    set(state => ({
      uploadQueue: state.uploadQueue.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  removeItem: (id: string) => {
    set(state => ({
      uploadQueue: state.uploadQueue.filter(item => item.id !== id),
    }));
  },

  clearCompleted: () => {
    set(state => ({
      uploadQueue: state.uploadQueue.filter(item => item.status !== 'completed'),
    }));
  },

  clearQueue: () => {
    const state = get();
    // Abort any in-progress uploads
    state.uploadQueue.forEach(item => {
      if (item.abortUpload && item.status !== 'completed' && item.status !== 'error') {
        item.abortUpload();
      }
    });

    set({
      uploadQueue: [],
      uploadingSpotId: null,
      uploadingSpotName: null,
      sessionTotal: 0,
      sessionCompleted: 0,
    });
  },

  isUploadingForSpot: (spotId: string) => {
    const state = get();
    const hasActiveUploads = state.uploadQueue.some(
      item => item.status !== 'completed' && item.status !== 'error'
    );
    return state.uploadingSpotId === spotId && hasActiveUploads;
  },
}));
