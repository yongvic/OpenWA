export type CampaignSendOutcome = 'completed' | 'cancelled' | 'failed';

export type BulkBatchProgressSnapshot = {
  total?: number;
  sent?: number;
  failed?: number;
  pending?: number;
  cancelled?: number;
};

export type BulkBatchStatusSnapshot = {
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  progress?: BulkBatchProgressSnapshot | null;
  results?: Array<{ chatId: string; status: string; messageId?: string }>;
};

/** Read sent/failed counts from batch progress, falling back to per-message results. */
export function tallyBulkBatch(status: BulkBatchStatusSnapshot): { sent: number; failed: number } {
  const results = status.results ?? [];
  const fromResults = () => {
    let sent = 0;
    let failed = 0;
    for (const row of results) {
      if (row.status === 'sent') sent += 1;
      else if (row.status === 'failed') failed += 1;
    }
    return { sent, failed };
  };

  const p = status.progress;
  if (!p || typeof p !== 'object') {
    return fromResults();
  }

  const sent = Number(p.sent);
  const failed = Number(p.failed);
  const hasProgressNumbers = Number.isFinite(sent) && Number.isFinite(failed);

  if (hasProgressNumbers && (sent > 0 || failed > 0)) {
    return { sent, failed };
  }

  if (results.length > 0) {
    return fromResults();
  }

  return {
    sent: hasProgressNumbers ? sent : 0,
    failed: hasProgressNumbers ? failed : 0,
  };
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
