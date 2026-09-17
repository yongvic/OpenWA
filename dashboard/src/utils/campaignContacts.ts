export interface CampaignRecipient {
  chatId: string;
  label: string;
}

/** Extract digit-only phone strings from free text (one per line or comma-separated). */
export function parsePhoneNumbers(raw: string): string[] {
  const seen = new Set<string>();
  const numbers: string[] = [];
  for (const line of raw.split(/[\r\n,;]+/)) {
    const digits = line.replace(/[^\d]/g, '');
    if (digits.length < 8 || seen.has(digits)) continue;
    seen.add(digits);
    numbers.push(digits);
  }
  return numbers;
}

/** Parse a CSV/TXT file — first column with digits, skips a header row when obvious. */
export async function parseContactsFile(file: File): Promise<string[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstDigits = lines[0].replace(/[^\d]/g, '');
  const looksLikeHeader =
    lines.length > 1 &&
    firstDigits.length < 8 &&
    /phone|tel|numero|numéro|mobile|contact/i.test(lines[0]);

  const body = looksLikeHeader ? lines.slice(1) : lines;
  const numbers: string[] = [];
  const seen = new Set<string>();

  for (const line of body) {
    const cell = line.split(/[,;\t]/)[0] ?? line;
    const digits = cell.replace(/[^\d]/g, '');
    if (digits.length < 8 || seen.has(digits)) continue;
    seen.add(digits);
    numbers.push(digits);
  }
  return numbers;
}

export function isPersonalContactId(id: string): boolean {
  return id.endsWith('@c.us') || id.endsWith('@lid');
}

/** Fold accents and punctuation so "Côte" matches "cote" and "Jean-Pierre" matches "jean pierre". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim();
}

export function contactDisplayName(contact: {
  name?: string;
  pushName?: string;
  number?: string;
  id?: string;
}): string {
  const name = (contact.name || contact.pushName || '').trim();
  const number = (contact.number || '').trim();
  if (name && number && !name.includes(number)) return `${name} · ${number}`;
  return name || number || contact.id || '';
}

export function contactMatchesQuery(contact: CampaignRecipient, query: string): boolean {
  const raw = query.trim();
  if (!raw) return true;
  const haystack = normalizeSearchText(`${contact.label} ${contact.chatId}`);
  const tokens = normalizeSearchText(raw).split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every(token => haystack.includes(token))) return true;
  const queryDigits = raw.replace(/\D/g, '');
  if (queryDigits.length >= 3) {
    const idDigits = contact.chatId.replace(/\D/g, '');
    if (idDigits.includes(queryDigits)) return true;
  }
  return false;
}

export function pickCampaignContacts(
  contacts: Array<{
    id: string;
    name?: string;
    pushName?: string;
    number?: string;
    isMyContact?: boolean;
    isBlocked?: boolean;
  }>,
): CampaignRecipient[] {
  const usable = contacts.filter(c => isPersonalContactId(c.id) && !c.isBlocked);
  const inBook = usable.filter(c => c.isMyContact);
  const source = inBook.length > 0 ? inBook : usable;
  const seen = new Set<string>();
  const out: CampaignRecipient[] = [];
  for (const c of source) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const hasIdentity = Boolean((c.name || c.pushName || c.number || '').trim());
    if (!hasIdentity) continue;
    out.push({ chatId: c.id, label: contactDisplayName(c) });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return out;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function resolvePhoneNumbers(
  checkNumber: (digits: string) => Promise<{ exists: boolean; whatsappId: string | null }>,
  numbers: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ valid: CampaignRecipient[]; invalid: string[] }> {
  const valid: CampaignRecipient[] = [];
  const invalid: string[] = [];
  const concurrency = 4;

  for (let i = 0; i < numbers.length; i += concurrency) {
    const slice = numbers.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async digits => {
        try {
          const result = await checkNumber(digits);
          return { digits, result };
        } catch {
          return { digits, result: { exists: false, whatsappId: null } };
        }
      }),
    );

    for (const { digits, result } of results) {
      if (result.exists && result.whatsappId) {
        valid.push({ chatId: result.whatsappId, label: digits });
      } else {
        invalid.push(digits);
      }
    }
    onProgress?.(Math.min(i + slice.length, numbers.length), numbers.length);
  }

  return { valid, invalid };
}

export function estimateCampaignMinutes(recipientCount: number, delayMs = 3000): number {
  return Math.max(1, Math.ceil((recipientCount * delayMs) / 60_000));
}
