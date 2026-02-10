import { SpotStatus } from './constants';

export type Spot = {
  id: string;
  name: string;
  location: string;
  coords: [number, number];
  status?: SpotStatus;
};
