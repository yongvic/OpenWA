import type { CampaignRecipient } from './campaignContacts';
import type { CampaignMessageType } from './campaignMessage';

export const CAMPAIGN_DRAFT_KEY = 'openwa_campaign_draft';

export type ContactSource = 'paste' | 'file' | 'whatsapp';
export type MediaSource = 'upload' | 'url';

export interface CampaignDraft {
  v: 1;
  step: 1 | 2 | 3;
  sessionId: string;
  source: ContactSource;
  pasteText: string;
  recipients: CampaignRecipient[];
  invalidNumbers: string[];
  message: string;
  messageType: CampaignMessageType;
  selectedTemplateId: string;
  mediaUrl: string;
  mediaSource: MediaSource;
  selectedWaIds: string[];
  waContacts: CampaignRecipient[];
  waContactSearch: string;
}

const MESSAGE_TYPES: CampaignMessageType[] = ['text', 'image', 'video', 'document', 'template'];

function isStep(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function isSource(value: unknown): value is ContactSource {
  return value === 'paste' || value === 'file' || value === 'whatsapp';
}

function isMediaSource(value: unknown): value is MediaSource {
  return value === 'upload' || value === 'url';
}

function isMessageType(value: unknown): value is CampaignMessageType {
  return typeof value === 'string' && MESSAGE_TYPES.includes(value as CampaignMessageType);
}

export function parseCampaignDraft(raw: string | null | undefined): CampaignDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CampaignDraft>;
    if (data.v !== 1) return null;
    if (!isStep(data.step)) return null;
    if (typeof data.sessionId !== 'string') return null;
    if (!isSource(data.source)) return null;
    if (typeof data.pasteText !== 'string') return null;
    if (!Array.isArray(data.recipients)) return null;
    if (!Array.isArray(data.invalidNumbers)) return null;
    if (typeof data.message !== 'string') return null;
    if (!isMessageType(data.messageType)) return null;
    if (typeof data.selectedTemplateId !== 'string') return null;
    if (typeof data.mediaUrl !== 'string') return null;
    if (!isMediaSource(data.mediaSource)) return null;
    if (!Array.isArray(data.selectedWaIds)) return null;
    if (!Array.isArray(data.waContacts)) return null;
    if (typeof data.waContactSearch !== 'string') return null;
    return data as CampaignDraft;
  } catch {
    return null;
  }
}

export function readCampaignDraft(storage: Pick<Storage, 'getItem'> = sessionStorage): CampaignDraft | null {
  try {
    return parseCampaignDraft(storage.getItem(CAMPAIGN_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function writeCampaignDraft(draft: CampaignDraft, storage: Pick<Storage, 'setItem'> = sessionStorage): void {
  try {
    storage.setItem(CAMPAIGN_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode — composing still works without persistence */
  }
}

export function clearCampaignDraft(storage: Pick<Storage, 'removeItem'> = sessionStorage): void {
  try {
    storage.removeItem(CAMPAIGN_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
