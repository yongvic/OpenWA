export type CampaignSendOutcome = 'completed' | 'cancelled' | 'failed';

export type BulkBatchProgressSnapshot = {
  total?: number;
  sent?: number;
  failed?: number;
  pending?: number;
  cancelled?: number;
};

export type BulkBatchResultSnapshot = {
  chatId: string;
  status: string;
  messageId?: string;
  error?: { code?: string; message?: string };
};

export type BulkBatchStatusSnapshot = {
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  progress?: BulkBatchProgressSnapshot | null;
  results?: BulkBatchResultSnapshot[];
};

function rowStatus(row: BulkBatchResultSnapshot): string {
  return String(row.status ?? '').toLowerCase();
}

/** A row the engine accepted — including SENT later overwritten to FAILED after a post-send throw. */
function rowCountsAsSent(row: BulkBatchResultSnapshot): boolean {
  if (row.messageId) return true;
  const status = rowStatus(row);
  return status === 'sent' || status === 'delivered' || status === 'read' || status === 'success';
}

function rowCountsAsFailed(row: BulkBatchResultSnapshot): boolean {
  if (rowCountsAsSent(row)) return false;
  const status = rowStatus(row);
  return status === 'failed' || status === 'error';
}

function fromResults(results: BulkBatchResultSnapshot[]): { sent: number; failed: number } {
  let sent = 0;
  let failed = 0;
  for (const row of results) {
    if (rowCountsAsSent(row)) sent += 1;
    else if (rowCountsAsFailed(row)) failed += 1;
  }
  return { sent, failed };
}

/** Read sent/failed counts from per-message results, falling back to progress counters. */
export function tallyBulkBatch(status: BulkBatchStatusSnapshot): { sent: number; failed: number } {
  const results = status.results ?? [];
  if (results.length > 0) {
    return fromResults(results);
  }

  const p = status.progress;
  if (!p || typeof p !== 'object') {
    return { sent: 0, failed: 0 };
  }

  const sent = Number(p.sent);
  const failed = Number(p.failed);
  return {
    sent: Number.isFinite(sent) ? sent : 0,
    failed: Number.isFinite(failed) ? failed : 0,
  };
}

export function firstBatchFailureMessage(status: BulkBatchStatusSnapshot): string | null {
  for (const row of status.results ?? []) {
    if (rowCountsAsSent(row)) continue;
    const message = row.error?.message?.trim();
    if (message) return message;
  }
  return null;
}

/** Final screen: any successful send counts as success (partial campaigns included). */
export function resolveCampaignSendOutcome(
  totals: { sent: number; failed: number },
  batchStatus: BulkBatchStatusSnapshot['status'],
): CampaignSendOutcome {
  if (batchStatus === 'cancelled') return 'cancelled';
  if (totals.sent > 0) return 'completed';
  if (batchStatus === 'failed' || totals.failed > 0) return 'failed';
  return 'completed';
}
