import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstBatchFailureMessage,
  resolveCampaignSendOutcome,
  tallyBulkBatch,
  type BulkBatchStatusSnapshot,
} from './campaignBatch.ts';

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

test('tallyBulkBatch: prefers per-message results over a wrong failed progress counter', () => {
  const status: BulkBatchStatusSnapshot = {
    status: 'failed',
    progress: { total: 3, sent: 0, failed: 3, pending: 0, cancelled: 0 },
    results: [
      { chatId: 'a@c.us', status: 'sent', messageId: '1' },
      { chatId: 'b@c.us', status: 'sent', messageId: '2' },
      { chatId: 'c@c.us', status: 'sent', messageId: '3' },
    ],
  };
  assert.deepEqual(tallyBulkBatch(status), { sent: 3, failed: 0 });
});

test('tallyBulkBatch: a messageId means sent even if status was later overwritten to failed', () => {
  const status: BulkBatchStatusSnapshot = {
    status: 'failed',
    progress: { total: 1, sent: 0, failed: 1, pending: 0, cancelled: 0 },
    results: [{ chatId: 'a@c.us', status: 'failed', messageId: 'true-id', error: { message: 'persist' } }],
  };
  assert.deepEqual(tallyBulkBatch(status), { sent: 1, failed: 0 });
});

test('firstBatchFailureMessage: skips rows that actually sent', () => {
  const status: BulkBatchStatusSnapshot = {
    status: 'failed',
    results: [
      { chatId: 'a@c.us', status: 'failed', messageId: '1', error: { message: 'bookkeeping' } },
      { chatId: 'b@c.us', status: 'failed', error: { message: 'No LID for user' } },
    ],
  };
  assert.equal(firstBatchFailureMessage(status), 'No LID for user');
});

test('resolveCampaignSendOutcome: success when at least one message was sent', () => {
  assert.equal(resolveCampaignSendOutcome({ sent: 3, failed: 1 }, 'failed'), 'completed');
  assert.equal(resolveCampaignSendOutcome({ sent: 0, failed: 2 }, 'failed'), 'failed');
  assert.equal(resolveCampaignSendOutcome({ sent: 0, failed: 0 }, 'cancelled'), 'cancelled');
});
