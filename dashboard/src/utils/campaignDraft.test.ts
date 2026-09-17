import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_DRAFT_KEY,
  clearCampaignDraft,
  parseCampaignDraft,
  readCampaignDraft,
  writeCampaignDraft,
  type CampaignDraft,
} from './campaignDraft.ts';

const valid: CampaignDraft = {
  v: 1,
  step: 2,
  sessionId: 'shop',
  source: 'paste',
  pasteText: '33612345678',
  recipients: [{ chatId: '33612345678@c.us', label: '33612345678' }],
  invalidNumbers: ['123'],
  message: 'Bonjour {{name}}',
  messageType: 'text',
  selectedTemplateId: '',
  mediaUrl: '',
  mediaSource: 'upload',
  selectedWaIds: [],
  waContacts: [],
  waContactSearch: '',
};

test('parseCampaignDraft accepts a complete v1 draft', () => {
  const parsed = parseCampaignDraft(JSON.stringify(valid));
  assert.deepEqual(parsed, valid);
});

test('parseCampaignDraft rejects truncated or foreign payloads', () => {
  assert.equal(parseCampaignDraft(null), null);
  assert.equal(parseCampaignDraft('{'), null);
  assert.equal(parseCampaignDraft(JSON.stringify({ ...valid, v: 2 })), null);
  assert.equal(parseCampaignDraft(JSON.stringify({ ...valid, step: 9 })), null);
  assert.equal(parseCampaignDraft(JSON.stringify({ ...valid, messageType: 'sticker' })), null);
});

test('write/read/clear round-trip through a memory store', () => {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };

  writeCampaignDraft(valid, memory);
  assert.equal(store.has(CAMPAIGN_DRAFT_KEY), true);
  assert.deepEqual(readCampaignDraft(memory), valid);
  clearCampaignDraft(memory);
  assert.equal(readCampaignDraft(memory), null);
});
