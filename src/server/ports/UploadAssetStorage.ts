import type { MediaType } from '@prisma/client';
import type { DirectUploadGrant } from 'shared/types/upload';

export interface UploadTarget {
  cloudinaryPublicId: string;
  expectedMediaType: MediaType;
  photographerId: string;
}

export interface StoredAsset {
  cloudinaryPublicId: string;
  resourceType: MediaType;
  thumbnailUrl: string;
  lightboxUrl: string;
}

export interface StoredAssetIdentity {
  cloudinaryPublicId: string;
  resourceType: MediaType;
}

export interface RemoteImportInput {
  sourceUrl: string;
  authHeaders: Record<string, string>;
  target: UploadTarget;
}

export interface DirectUploadPort {
  createUploadGrant(target: UploadTarget, expiresAt: Date): DirectUploadGrant;
  verifyUploadReceipt(receipt: unknown, target: UploadTarget): Promise<StoredAsset>;
}

export interface RemoteImportPort {
  importRemoteFile(input: RemoteImportInput): Promise<StoredAsset>;
}

export interface AssetCleanupPort {
  deleteStoredAsset(asset: StoredAssetIdentity): Promise<void>;
}
