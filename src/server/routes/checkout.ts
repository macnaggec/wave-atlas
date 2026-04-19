import { z } from 'zod';
import { router, protectedProcedure } from 'server/trpc';
import { createCheckoutSession, getPurchases, generateDownloadAccess } from 'server/services/CheckoutService';
import { cartItemIdsSchema, mediaItemIdSchema } from 'shared/validation/checkoutSchemas';

export const checkoutRouter = router({
  /**
   * Creates a CryptoCloud checkout session for the current cart.
   * Returns a URL to redirect the buyer to the hosted payment page.
   */
  create: protectedProcedure
    .input(z.object({
      itemIds: cartItemIdsSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      return createCheckoutSession(ctx.user.id, input.itemIds);
    }),

  /**
   * Returns all completed purchases for the authenticated buyer.
   * Media URLs are watermarked previews only — download the original via getSignedDownloadUrl.
   */
  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    return getPurchases(ctx.user.id);
  }),

  /**
   * Generates a short-lived signed Cloudinary download URL for a purchased media item.
   *
   * Security: verifies the authenticated user has a Purchase row for this
   * mediaItemId before generating any URL. Prevents access to non-purchased media.
   */
  getSignedMediaAccess: protectedProcedure
    .input(z.object({ mediaItemId: mediaItemIdSchema }))
    .query(async ({ input, ctx }) => {
      return generateDownloadAccess(ctx.user.id, input.mediaItemId);
    }),
});
