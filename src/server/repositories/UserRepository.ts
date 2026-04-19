import { prisma } from 'server/db';

export async function anonymizeAndDelete(userId: string): Promise<void> {
  await prisma.$transaction([
    // Nullify spot creator references so spots remain visible
    prisma.spot.updateMany({
      where: { creatorId: userId },
      data: { creatorId: null },
    }),
    // Anonymize PII and mark as deleted (preserves purchases/transactions for audit)
    prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: `deleted_${userId}@deleted.invalid`,
        image: null,
        password: null,
        deletedAt: new Date(),
      },
    }),
    // Hard-delete auth records so the account cannot be used to log in
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
  ]);
}
