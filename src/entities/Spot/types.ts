import { SpotStatus } from './constants';

/** Minimal spot data needed to render the panel header. */
export type SpotHeaderData = {
  name: string;
  location: string;
  status?: string;
};

export type Spot = {
  id: string;
  name: string;
  location: string;
  coords: [number, number];
  status?: SpotStatus;
};
