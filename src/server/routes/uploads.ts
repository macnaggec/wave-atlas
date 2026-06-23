import { router, protectedProcedure } from 'server/trpc';
import { uploadService } from 'server/services/UploadService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import {
  beginLocalSchema,
  finalizeLocalSchema,
  beginDriveSchema,
  processDriveSchema,
  discardAttemptSchema,
  discardDraftSchema,
  listAttemptsForDraftSchema,
} from 'shared/validation/uploadSchemas';

const beginLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const uploadsRouter = router({
  beginLocal: protectedProcedure
    .input(beginLocalSchema)
    .mutation(({ input, ctx }) => {
      beginLimiter(ctx.user!.id);
      return uploadService.beginLocal(ctx.user!.id, input);
    }),

  finalizeLocal: protectedProcedure
    .input(finalizeLocalSchema)
    .mutation(({ input, ctx }) =>
      uploadService.finalizeLocal(ctx.user!.id, input),
    ),

  beginDrive: protectedProcedure
    .input(beginDriveSchema)
    .mutation(({ input, ctx }) => {
      beginLimiter(ctx.user!.id);
      return uploadService.beginDrive(ctx.user!.id, input);
    }),

  processDrive: protectedProcedure
    .input(processDriveSchema)
    .mutation(({ input, ctx }) =>
      uploadService.processDrive(ctx.user!.id, input),
    ),

  discard: protectedProcedure
    .input(discardAttemptSchema)
    .mutation(({ input, ctx }) =>
      uploadService.discardAttempt(ctx.user!.id, input.attemptId),
    ),

  discardDraft: protectedProcedure
    .input(discardDraftSchema)
    .mutation(({ input, ctx }) =>
      uploadService.discardDraft(ctx.user!.id, input.draftId),
    ),

  listForDraft: protectedProcedure
    .input(listAttemptsForDraftSchema)
    .query(({ input, ctx }) =>
      uploadService.listForDraft(ctx.user!.id, input.draftId),
    ),
});
