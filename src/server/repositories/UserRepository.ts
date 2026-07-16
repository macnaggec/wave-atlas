import { MediaStatus, SurfSessionStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { NotFoundError } from 'shared/errors';

export interface IUserRepository {
  anonymizeAndDelete(userId: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
  anonymizeAndDelete(userId: string): Promise<void> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        if (!user) throw new NotFoundError('User');

        const deletedAt = new Date();

        // Record the forfeited balance so the ledger still explains where the money went
        if (user.balance > 0) {
          await tx.transaction.create({
            data: {
              userId,
              amount: -user.balance,
              type: TransactionType.FORFEIT,
              status: TransactionStatus.COMPLETED,
            },
          });
        }

        // Retire published work so it stops earning into an account nobody can sign into
        await tx.mediaItem.updateMany({
          where: { photographerId: userId, deletedAt: null },
          data: { status: MediaStatus.DELETED, deletedAt },
        });
        await tx.surfSession.updateMany({
          where: { photographerId: userId, status: SurfSessionStatus.PUBLISHED },
          data: { status: SurfSessionStatus.DELETED },
        });

        // Nullify spot creator references so spots remain visible
        await tx.spot.updateMany({
          where: { creatorId: userId },
          data: { creatorId: null },
        });

        // Anonymize PII and mark as deleted (preserves purchases/transactions for audit)
        await tx.user.update({
          where: { id: userId },
          data: {
            name: 'Deleted User',
            email: `deleted_${userId}@deleted.invalid`,
            image: null,
            password: null,
            balance: 0,
            deletedAt,
          },
        });

        // Hard-delete auth records so the account cannot be used to log in
        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
      })
    );
  }
}

export const userRepository = new UserRepository();
