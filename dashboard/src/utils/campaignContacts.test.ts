import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contactDisplayName,
  contactMatchesQuery,
  pickCampaignContacts,
  type CampaignRecipient,
} from './campaignContacts.ts';

test('contactDisplayName prefers saved name, then push name, then number', () => {
  assert.equal(contactDisplayName({ name: 'Ada', pushName: 'Ada W', number: '3361' }), 'Ada · 3361');
  assert.equal(contactDisplayName({ pushName: 'Ada W', number: '3361' }), 'Ada W · 3361');
  assert.equal(contactDisplayName({ number: '3361' }), '3361');
});

test('contactMatchesQuery is accent-insensitive and matches every word', () => {
  const contact: CampaignRecipient = { chatId: '33612345678@c.us', label: 'Côte Jean-Pierre · 33612345678' };
  assert.equal(contactMatchesQuery(contact, 'cote'), true);
  assert.equal(contactMatchesQuery(contact, 'JEAN pierre'), true);
  assert.equal(contactMatchesQuery(contact, 'marie'), false);
  assert.equal(contactMatchesQuery(contact, '612345'), true);
});

test('pickCampaignContacts keeps the address book, drops blocked/groups, sorts by name', () => {
  const picked = pickCampaignContacts([
    { id: '2@c.us', name: 'Zoé', number: '2', isMyContact: true, isBlocked: false },
    { id: '1@c.us', name: 'Anne', number: '1', isMyContact: true, isBlocked: false },
    { id: 'x@g.us', name: 'Group', number: '9', isMyContact: true, isBlocked: false },
    { id: '3@c.us', name: 'Blocked', number: '3', isMyContact: true, isBlocked: true },
    { id: 'ghost@lid', number: '', isMyContact: false, isBlocked: false },
  ]);
  assert.deepEqual(
    picked.map(c => c.chatId),
    ['1@c.us', '2@c.us'],
  );
});

test('pickCampaignContacts falls back to named chats when the address book is empty', () => {
  const picked = pickCampaignContacts([
    { id: '9@c.us', pushName: 'Sam', number: '9', isMyContact: false, isBlocked: false },
    { id: '8@lid', number: '', isMyContact: false, isBlocked: false },
  ]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].chatId, '9@c.us');
});
