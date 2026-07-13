/** Statuses that belong at the end of work queues (done / cancelled). */
export const FINALIZED_REQUEST_STATUSES = new Set(['validated', 'completed', 'cancelled']);

export const FINALIZED_KIT_STATUSES = new Set(['devuelta', 'usada']);

export function isFinalizedRequestStatus(status?: string | null) {
  return FINALIZED_REQUEST_STATUSES.has(status ?? '');
}

export function isFinalizedKitStatus(status?: string | null) {
  return FINALIZED_KIT_STATUSES.has(status ?? '');
}

/** Active work first; finalized last. Stable within each group by original order. */
export function partitionByFinalized<T>(
  items: T[],
  getStatus: (item: T) => string | null | undefined,
  isFinalized: (status?: string | null) => boolean,
): { active: T[]; finalized: T[] } {
  const active: T[] = [];
  const finalized: T[] = [];
  for (const item of items) {
    if (isFinalized(getStatus(item))) finalized.push(item);
    else active.push(item);
  }
  return { active, finalized };
}
