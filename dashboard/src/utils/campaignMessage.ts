import type { MessageTemplate } from '../services/api';
import type { CampaignRecipient } from './campaignContacts';

export type CampaignMessageType = 'text' | 'image' | 'video' | 'document' | 'template';

export type CampaignMediaMessageType = 'image' | 'video' | 'document';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isMediaMessageType(type: CampaignMessageType): type is CampaignMediaMessageType {
  return type === 'image' || type === 'video' || type === 'document';
}

export function mediaAcceptForType(type: CampaignMediaMessageType): string {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,application/*';
}

export type CampaignMedia = {
  url?: string;
  base64?: string;
  mimetype?: string;
  filename?: string;
};

export function templateToText(template: Pick<MessageTemplate, 'header' | 'body' | 'footer'>): string {
  return [template.header, template.body, template.footer].filter(Boolean).join('\n\n');
}

export function recipientVariables(recipient: CampaignRecipient): Record<string, string> {
  return { name: recipient.label };
}

export function previewWithVariables(text: string, sampleName = 'Marie'): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) =>
    key === 'name' ? sampleName : `{{${key}}}`,
  );
}

export async function readFileAsBase64(file: File): Promise<CampaignMedia> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl;
  return {
    base64,
    mimetype: file.type || 'application/octet-stream',
    filename: file.name,
  };
}

export function buildBulkMessageItem(
  recipient: CampaignRecipient,
  messageType: CampaignMessageType,
  payload: {
    text: string;
    media?: CampaignMedia;
  },
) {
  const variables = recipientVariables(recipient);
  const trimmedText = payload.text.trim();

  if (messageType === 'image') {
    const media = payload.media ?? {};
    return {
      chatId: recipient.chatId,
      type: 'image' as const,
      content: {
        image: media.url ? { url: media.url } : { base64: media.base64, mimetype: media.mimetype },
        caption: trimmedText || undefined,
      },
      variables,
    };
  }

  if (messageType === 'video') {
    const media = payload.media ?? {};
    return {
      chatId: recipient.chatId,
      type: 'video' as const,
      content: {
        video: media.url ? { url: media.url } : { base64: media.base64, mimetype: media.mimetype },
        caption: trimmedText || undefined,
      },
      variables,
    };
  }

  if (messageType === 'document') {
    const media = payload.media ?? {};
    return {
      chatId: recipient.chatId,
      type: 'document' as const,
      content: {
        document: media.url
          ? { url: media.url, filename: media.filename }
          : { base64: media.base64, mimetype: media.mimetype, filename: media.filename },
        caption: trimmedText || undefined,
      },
      variables,
    };
  }

  return {
    chatId: recipient.chatId,
    type: 'text' as const,
    content: { text: trimmedText },
    variables,
  };
}

export function isMessageStepValid(
  messageType: CampaignMessageType,
  text: string,
  media: CampaignMedia | null,
  templateId: string,
): boolean {
  if (messageType === 'template') return !!templateId;
  if (isMediaMessageType(messageType)) {
    return !!(media?.url || media?.base64);
  }
  return text.trim().length > 0;
}
