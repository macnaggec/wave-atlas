import type {
  PayoutRequest,
  Transaction,
  User,
} from '@prisma/client';
import {
  PayoutStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { BadRequestError, NotFoundError } from 'shared/errors';

export type LedgerSummaryRecords = {
  user: Pick<User, 'id' | 'balance'> | null;
  recentTransactions: Transaction[];
  payoutRequests: PayoutRequest[];
};

export type ReservePayoutInput = {
  photographerId: string;
  amountCents: number;
};

export type PayoutReservation = {
  payoutRequest: PayoutRequest;
  transaction: Transaction;
};

export type OperatorPayoutRequest = PayoutRequest & {
  photographer: {
    id: string;
    email: string;
    name: string | null;
  };
};

export interface ILedgerRepository {
  getSummaryRecords(photographerId: string): Promise<LedgerSummaryRecords>;
  listOperatorPayouts(): Promise<OperatorPayoutRequest[]>;
  reservePayout(input: ReservePayoutInput): Promise<PayoutReservation>;
  markPayoutProcessing(payoutRequestId: string): Promise<PayoutReservation>;
  completePayout(payoutRequestId: string, externalTransferId: string): Promise<PayoutReservation>;
  rejectPayout(payoutRequestId: string, note: string): Promise<PayoutReservation>;
}

export class LedgerRepository implements ILedgerRepository {
  getSummaryRecords(photographerId: string): Promise<LedgerSummaryRecords> {
    return runQuery(async () => {
      const [user, recentTransactions, payoutRequests] = await Promise.all([
        prisma.user.findUnique({
          where: { id: photographerId },
          select: { id: true, balance: true },
        }),
        prisma.transaction.findMany({
          where: { userId: photographerId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.payoutRequest.findMany({
          where: { photographerId },
          orderBy: { requestedAt: 'desc' },
          take: 20,
        }),
      ]);

      return { user, recentTransactions, payoutRequests };
    });
  }

  reservePayout(input: ReservePayoutInput): Promise<PayoutReservation> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const reserved = await tx.user.updateMany({
          where: {
            id: input.photographerId,
            balance: { gte: input.amountCents },
          },
          data: { balance: { decrement: input.amountCents } },
        });

        if (reserved.count !== 1) {
          throw new BadRequestError('Insufficient available balance');
        }

        const transaction = await tx.transaction.create({
          data: {
            userId: input.photographerId,
            amount: -input.amountCents,
            type: TransactionType.PAYOUT,
            status: TransactionStatus.PENDING,
          },
        });

        const payoutRequest = await tx.payoutRequest.create({
          data: {
            photographerId: input.photographerId,
            transactionId: transaction.id,
            amount: input.amountCents,
            status: PayoutStatus.PENDING,
          },
        });

        return { payoutRequest, transaction };
      })
    );
  }

  listOperatorPayouts(): Promise<OperatorPayoutRequest[]> {
    return runQuery(() =>
      prisma.payoutRequest.findMany({
        orderBy: { requestedAt: 'asc' },
        take: 100,
        include: {
          photographer: { select: { id: true, email: true, name: true } },
        },
      })
    );
  }

  markPayoutProcessing(payoutRequestId: string): Promise<PayoutReservation> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.payoutRequest.updateMany({
          where: { id: payoutRequestId, status: PayoutStatus.PENDING },
          data: { status: PayoutStatus.PROCESSING },
        });

        if (updated.count !== 1) {
          throw new BadRequestError('Payout request cannot be marked processing');
        }

        const payoutRequest = await tx.payoutRequest.findUniqueOrThrow({
          where: { id: payoutRequestId },
        });
        const transaction = await tx.transaction.findUniqueOrThrow({
          where: { id: payoutRequest.transactionId },
        });

        return { payoutRequest, transaction };
      })
    );
  }

  completePayout(payoutRequestId: string, externalTransferId: string): Promise<PayoutReservation> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.payoutRequest.updateMany({
          where: { id: payoutRequestId, status: PayoutStatus.PROCESSING },
          data: {
            status: PayoutStatus.COMPLETED,
            externalTransferId,
            processedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestError('Payout request cannot be completed');
        }

        const payoutRequest = await tx.payoutRequest.findUniqueOrThrow({
          where: { id: payoutRequestId },
        });
        const transaction = await tx.transaction.update({
          where: { id: payoutRequest.transactionId },
          data: { status: TransactionStatus.COMPLETED },
        });

        return { payoutRequest, transaction };
      })
    );
  }

  rejectPayout(payoutRequestId: string, note: string): Promise<PayoutReservation> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.payoutRequest.findUnique({
          where: { id: payoutRequestId },
        });

        if (!existing) {
          throw new NotFoundError('Payout request');
        }
        if (
          existing.status !== PayoutStatus.PENDING &&
          existing.status !== PayoutStatus.PROCESSING
        ) {
          throw new BadRequestError('Payout request cannot be rejected');
        }

        const updated = await tx.payoutRequest.updateMany({
          where: {
            id: payoutRequestId,
            status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
          },
          data: {
            status: PayoutStatus.REJECTED,
            note,
            processedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestError('Payout request cannot be rejected');
        }

        const transaction = await tx.transaction.update({
          where: { id: existing.transactionId },
          data: { status: TransactionStatus.FAILED },
        });
        await tx.user.update({
          where: { id: existing.photographerId },
          data: { balance: { increment: existing.amount } },
        });
        const payoutRequest = await tx.payoutRequest.findUniqueOrThrow({
          where: { id: payoutRequestId },
        });

        return { payoutRequest, transaction };
      })
    );
  }
}

export const ledgerRepository = new LedgerRepository();
