export const SPOT_STATUS = {
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
} as const;

export type SpotStatus = typeof SPOT_STATUS[keyof typeof SPOT_STATUS];
