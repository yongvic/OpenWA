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
