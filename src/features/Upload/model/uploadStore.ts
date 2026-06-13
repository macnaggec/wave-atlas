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
    set(state => {
      const item = state.uploadQueue.find(i => i.id === id);
      if (item?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      return { uploadQueue: state.uploadQueue.filter(i => i.id !== id) };
    });
  },

  clearQueue: () => {
    const state = get();
    state.uploadQueue.forEach(item => {
      if (item.status === 'importing') return;
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      if (item.abortUpload && item.status !== 'completed' && item.status !== 'error') {
        item.abortUpload();
      }
    });
    set(s => ({
      uploadQueue: s.uploadQueue
        .filter(i => i.status === 'importing')
        .map(i => ({ ...i, status: 'cancelled' as const })),
      uploadSpotId: null,
      wizardStep: 'files',
    }));
  },
}));
