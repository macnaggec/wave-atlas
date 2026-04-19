import { z } from 'zod';

export const cartItemIdsSchema = z.array(z.uuid()).min(1);

export const mediaItemIdSchema = z.uuid();
