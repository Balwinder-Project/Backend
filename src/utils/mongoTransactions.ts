import mongoose from 'mongoose';

/**
 * MongoDB multi-document transactions require a replica set or a sharded
 * (mongos) deployment. On a standalone server they throw
 * "Transaction numbers are only allowed on a replica set member or mongos".
 *
 * This detects transaction support once (cached) so callers can gracefully
 * fall back to non-transactional writes on standalone deployments.
 */
let cached: boolean | null = null;

export const supportsTransactions = async (): Promise<boolean> => {
  if (cached !== null) return cached;
  try {
    const db = mongoose.connection.db;
    if (!db) return false;
    const info: any = await db.admin().command({ hello: 1 });
    // Replica-set members report `setName`; a mongos reports msg 'isdbgrid'.
    cached = Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch {
    cached = false;
  }
  return cached;
};
