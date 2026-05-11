import { z } from 'zod';

export const cartItemIdsSchema = z.array(z.uuid()).min(1);

export const mediaItemIdSchema = z.uuid();

export const downloadTokenSchema = z.string().length(64);
