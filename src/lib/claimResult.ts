// Pure classification of the row set_order_status returns for a Claim. Kept free
// of Supabase imports so scripts can run it under plain node.

export type ClaimResult =
  | { kind: 'claimed' }
  | { kind: 'taken'; by: string | null }
  | { kind: 'closed' }
  | { kind: 'failed' };

export interface ClaimRow {
  status: string;
  claimed_by: string | null;
}

// set_order_status is a no-op when another user already claimed the order and
// still returns that row, so the caller must compare claimed_by with itself.
export function classifyClaim(row: ClaimRow | null, userId: string | undefined): ClaimResult {
  if (!row) return { kind: 'failed' };
  if (row.status === 'completed' || row.status === 'cancelled') return { kind: 'closed' };
  if (row.status === 'in_progress') {
    if (userId && row.claimed_by === userId) return { kind: 'claimed' };
    return { kind: 'taken', by: row.claimed_by };
  }
  if (row.status === 'ready') {
    // Another press claimed and finished it before this tap landed.
    if (userId && row.claimed_by === userId) return { kind: 'claimed' };
    return { kind: 'taken', by: row.claimed_by };
  }
  // Still new: the claim did not land.
  return { kind: 'failed' };
}
