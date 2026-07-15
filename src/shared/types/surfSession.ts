export const SURF_SESSION_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DELETED: 'DELETED',
} as const;

export type SurfSessionStatus = typeof SURF_SESSION_STATUS[keyof typeof SURF_SESSION_STATUS];

export type SurfSessionItem = {
  id: string;
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
  status: SurfSessionStatus;
  createdAt: Date;
  spot: { id: string; name: string; location: string };
  photographer: { id: string; name: string | null };
  thumbnailUrl: string | null;
  mediaCount: number;
};

export type SurfSessionPage = {
  items: SurfSessionItem[];
  nextCursor: string | null;
};

export type SurfSessionDraft = {
  id: string;
  spotId: string | null;
  photographerId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  photoPrice: number;
  videoPrice: number;
  status: SurfSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  spot: { id: string; name: string; location: string } | null;
  mediaCount: number;
};
