import { router, protectedProcedure, publicProcedure } from 'server/trpc';
import { checkoutService } from 'server/services/CheckoutService';
import {
  createCheckoutSchema,
  getSignedMediaAccessSchema,
  getSignedMediaAccessByTokenSchema,
  getGuestPurchasesSchema,
  getGuestDownloadAccessSchema,
  saveGuestEmailSchema,
} from 'shared/validation/checkoutSchemas';
import { createRateLimiter } from 'server/lib/rateLimiter';

// 5 checkout session creations per IP/user per minute — prevents CryptoCloud API abuse
const createCheckoutLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
// 20 token-based download URL generations per IP per minute — prevents token enumeration
const tokenDownloadLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export const checkoutRouter = router({
  create: publicProcedure
    .input(createCheckoutSchema)
    .use(({ ctx, next }) => {
      createCheckoutLimiter(ctx.user?.id ?? ctx.clientIp);
      return next();
    })
    .mutation(async ({ input, ctx }) => {
      return checkoutService.createCheckoutSession(
        ctx.user?.id ?? null,
        input.guestEmail,
        input.itemIds,
      );
    }),

  myPurchases: protectedProcedure.query(async ({ ctx }) => {
    return checkoutService.getPurchases(ctx.user.id);
  }),

  getSignedMediaAccess: protectedProcedure
    .input(getSignedMediaAccessSchema)
    .query(async ({ input, ctx }) => {
      return checkoutService.generateDownloadAccess(ctx.user.id, input.mediaItemId);
    }),

  getSignedMediaAccessByToken: publicProcedure
    .input(getSignedMediaAccessByTokenSchema)
    .use(({ ctx, next }) => {
      tokenDownloadLimiter(ctx.clientIp);
      return next();
    })
    .query(async ({ input }) => {
      return checkoutService.generateDownloadAccessByToken(input.downloadToken);
    }),

  getGuestPurchases: publicProcedure
    .input(getGuestPurchasesSchema)
    .use(({ ctx, next }) => {
      tokenDownloadLimiter(ctx.clientIp);
      return next();
    })
    .query(async ({ input }) => {
      return checkoutService.getGuestPurchases(input.orderId);
    }),

  getGuestDownloadAccess: publicProcedure
    .input(getGuestDownloadAccessSchema)
    .use(({ ctx, next }) => {
      tokenDownloadLimiter(ctx.clientIp);
      return next();
    })
    .query(async ({ input }) => {
      return checkoutService.getGuestDownloadAccess(input.purchaseId, input.orderId);
    }),

  saveGuestEmail: publicProcedure
    .input(saveGuestEmailSchema)
    .mutation(async ({ input }) => {
      await checkoutService.saveGuestEmail(input.orderId, input.email);
    }),
});
