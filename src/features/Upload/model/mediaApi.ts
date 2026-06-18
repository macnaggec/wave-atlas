import { trpcClient } from 'shared/lib/trpcClient';
import type { z } from 'zod';
import type { mediaCreateSchema } from 'entities/Media';

export const signCloudinaryDirect = () =>
  trpcClient.media.signCloudinary.mutate();

export const createMediaDirect = (input: z.infer<typeof mediaCreateSchema>) =>
  trpcClient.media.create.mutate(input);
