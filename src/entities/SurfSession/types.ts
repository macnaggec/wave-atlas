export type SurfSessionItem = {
  id: string;
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  createdAt: Date;
  spot: { id: string; name: string; location: string };
  thumbnailUrl: string | null;
  mediaCount: number;
};

export type SurfSessionPage = {
  items: SurfSessionItem[];
  nextCursor: string | null;
};
