import { create } from 'zustand';
import { UploadItem } from 'features/Upload/model/types';

interface UploadState {
  uploadQueue: UploadItem[];
  uploadSpotId: string | null;
  wizardStep: 'files' | 'time';
}

interface UploadActions {
  addToQueue: (items: UploadItem[]) => void;
  updateItem: (id: string, updates: Partial<UploadItem>) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  clearQueue: () => void;
  setUploadSpotId: (spotId: string | null) => void;
  setWizardStep: (step: 'files' | 'time') => void;
}

interface UploadStore extends UploadState, UploadActions { }

export const useUploadStore = create<UploadStore>((set, get) => ({
  uploadQueue: [],
  uploadSpotId: null,
  wizardStep: 'files',

  addToQueue: (items: UploadItem[]) => {
    set(state => ({
      uploadQueue: [...state.uploadQueue, ...items],
      uploadSpotId: state.uploadSpotId ?? items[0]?.spotId ?? null,
    }));
  },

  setUploadSpotId: (spotId: string | null) => {
    set({ uploadSpotId: spotId });
  },

  setWizardStep: (step: 'files' | 'time') => {
    set({ wizardStep: step });
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
    state.uploadQueue.forEach(item => {
      if (item.abortUpload && item.status !== 'completed' && item.status !== 'error') {
        item.abortUpload();
      }
    });
    set({ uploadQueue: [], uploadSpotId: null, wizardStep: 'files' });
  },
}));
