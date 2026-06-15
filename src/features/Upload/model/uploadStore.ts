import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media';
import { UploadItem } from './types';

interface UploadState {
  uploadQueue: UploadItem[];
  uploadSpotId: string | null;
  photoPrice: number;
  videoPrice: number;
}

interface UploadActions {
  addToQueue: (items: UploadItem[]) => void;
  updateItem: (id: string, updates: Partial<UploadItem>) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  setUploadSpotId: (spotId: string | null) => void;
  setPhotoPrice: (price: number) => void;
  setVideoPrice: (price: number) => void;
}

interface UploadStore extends UploadState, UploadActions { }

export const useUploadStore = create<UploadStore>()(
  persist(
    (set) => ({
      uploadQueue: [],
      uploadSpotId: null,
      photoPrice: MIN_MEDIA_PRICE_CENTS,
      videoPrice: MIN_MEDIA_PRICE_CENTS,

      addToQueue: (items: UploadItem[]) => {
        set(state => ({ uploadQueue: [...state.uploadQueue, ...items] }));
      },

      setUploadSpotId: (spotId: string | null) => {
        set({ uploadSpotId: spotId });
      },

      setPhotoPrice: (price: number) => {
        set({ photoPrice: price });
      },

      setVideoPrice: (price: number) => {
        set({ videoPrice: price });
      },

      updateItem: (id: string, updates: Partial<UploadItem>) => {
        set(state => ({
          uploadQueue: state.uploadQueue.map(item =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      // Blob URL revocation is owned by the hook layer (useUploadManager).
      // The store only manages queue membership — no side effects on removal.
      removeItem: (id: string) => {
        set(state => ({
          uploadQueue: state.uploadQueue.filter(i => i.id !== id),
        }));
      },

      // Pure membership reset — no side effects. Abort and blob revocation are owned by useUploadManager.
      clearQueue: () => {
        set(s => ({
          uploadQueue: s.uploadQueue
            .filter(i => i.status === 'importing')
            .map(i => ({ ...i, status: 'cancelled' as const })),
          uploadSpotId: null,
          photoPrice: MIN_MEDIA_PRICE_CENTS,
          videoPrice: MIN_MEDIA_PRICE_CENTS,
        }));
      },
    }),
    {
      name: 'wave-atlas-upload',
      // Only persist spot and price — queue is transient (blobs lost on reload)
      partialize: (state) => ({
        uploadSpotId: state.uploadSpotId,
        photoPrice: state.photoPrice,
        videoPrice: state.videoPrice,
      }),
    },
  ),
);
