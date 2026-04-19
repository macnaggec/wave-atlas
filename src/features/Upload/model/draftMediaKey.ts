/**
 * SWR key factory for draft media.
 * Kept separate from useDraftMedia.ts so RSC can import it without
 * pulling in client-only SWR hooks.
 *
 * Returns null when spotId is absent — SWR skips fetching on null key.
 */
export const draftMediaKey = (spotId: string | null | undefined): [string, string] | null =>
  spotId ? ['draft-media', spotId] : null;
