import { mapPrismaError } from 'shared/errors/PrismaErrorMapper';

export async function runQuery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw mapPrismaError(err);
  }
}
