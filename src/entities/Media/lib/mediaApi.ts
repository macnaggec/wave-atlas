import { trpcClient } from 'app/lib/trpcClient';
import type { z } from 'zod';
import type { mediaCreateSchema } from './mediaSchemas';

/** Plain async wrappers — callable outside React lifecycle for the upload pipeline. */
export const signCloudinaryDirect = () =>
  trpcClient.media.signCloudinary.mutate();

export const createMediaDirect = (input: z.infer<typeof mediaCreateSchema>) =>
  trpcClient.media.create.mutate(input);
