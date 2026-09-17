import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCampaignSendOutcome, tallyBulkBatch, type BulkBatchStatusSnapshot } from './campaignBatch.ts';

test('tallyBulkBatch: uses results when progress counters stayed at zero', () => {
  const status: BulkBatchStatusSnapshot = {
    status: 'completed',
    progress: { total: 2, sent: 0, failed: 0, pending: 0, cancelled: 0 },
    results: [
      { chatId: 'a@c.us', status: 'sent', messageId: '1' },
      { chatId: 'b@c.us', status: 'sent', messageId: '2' },
    ],
  };
  assert.deepEqual(tallyBulkBatch(status), { sent: 2, failed: 0 });
});

test('resolveCampaignSendOutcome: success when at least one message was sent', () => {
  assert.equal(resolveCampaignSendOutcome({ sent: 3, failed: 1 }, 'failed'), 'completed');
  assert.equal(resolveCampaignSendOutcome({ sent: 0, failed: 2 }, 'failed'), 'failed');
  assert.equal(resolveCampaignSendOutcome({ sent: 0, failed: 0 }, 'cancelled'), 'cancelled');
});
