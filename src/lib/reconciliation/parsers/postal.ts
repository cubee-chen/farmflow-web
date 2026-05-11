import Papa from 'papaparse';

export interface ParsedPostalRow {
  txDate: string;        // YYYY-MM-DD
  amount: number;
  direction: 'in' | 'out';
  accountLast5: string | null;
  memo: string | null;
  // raw_row is the full parsed CSV object for storage in DB
  rawRow: Record<string, string>;
}

export interface PostalParseResult {
  rows: ParsedPostalRow[];
  errors: string[];
}

// TODO: 需依真實中華郵政 CSV 樣本微調欄位名稱
const COL = {
  date: '交易日期',
  withdrawal: '提款金額',
  deposit: '存款金額',
  account: '轉出入帳號',
  summary: '摘要',
  notes: '備註',
} as const;

function decodeBuffer(buf: Uint8Array): string {
  // Strip UTF-8 BOM (EF BB BF)
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buf.slice(3));
  }
  // Try UTF-8; fall back to Big5 if replacement chars appear
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('big5').decode(buf);
}

function normalizeDate(raw: string): string | null {
  // Accepts "2026/05/01" or "2026-05-01"
  const cleaned = raw.trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, '').trim()) || 0;
}

// Extract last 5 digits from account strings like "012-00001234567"
function extractLast5(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const withoutBankCode = raw.includes('-') ? raw.split('-').slice(1).join('') : raw;
  const digits = withoutBankCode.replace(/\D/g, '');
  return digits.length >= 5 ? digits.slice(-5) : digits || null;
}

// Find the actual header line index (the line containing 交易日期)
function findHeaderLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(COL.date)) return i;
  }
  return -1;
}

export async function parsePostalCsv(file: File): Promise<PostalParseResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = decodeBuffer(bytes);

  const lines = text.split(/\r?\n/);
  const headerIdx = findHeaderLineIndex(lines);

  if (headerIdx === -1) {
    return {
      rows: [],
      errors: [`找不到標頭列（缺少「${COL.date}」欄）`],
    };
  }

  const csvContent = lines.slice(headerIdx).join('\n');

  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: ParsedPostalRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const lineNum = headerIdx + i + 2; // 1-based, +1 for header row itself

    const rawDate = row[COL.date] ?? '';
    const txDate = normalizeDate(rawDate);
    if (!txDate) {
      errors.push(`第 ${lineNum} 列：日期格式無效（"${rawDate}"）`);
      continue;
    }

    const withdrawalStr = (row[COL.withdrawal] ?? '').trim();
    const depositStr = (row[COL.deposit] ?? '').trim();

    let amount: number;
    let direction: 'in' | 'out';

    if (depositStr && !withdrawalStr) {
      amount = parseAmount(depositStr);
      direction = 'in';
    } else if (withdrawalStr && !depositStr) {
      amount = parseAmount(withdrawalStr);
      direction = 'out';
    } else if (withdrawalStr && depositStr) {
      errors.push(`第 ${lineNum} 列：提款與存款欄位同時有值，略過此列`);
      continue;
    } else {
      errors.push(`第 ${lineNum} 列：金額欄位均為空，略過此列`);
      continue;
    }

    if (amount <= 0) {
      errors.push(`第 ${lineNum} 列：金額不合法（${amount}），略過此列`);
      continue;
    }

    const summary = (row[COL.summary] ?? '').trim();
    const notes = (row[COL.notes] ?? '').trim();
    const memo = [summary, notes].filter(Boolean).join('｜') || null;

    rows.push({
      txDate,
      amount,
      direction,
      accountLast5: extractLast5(row[COL.account]),
      memo,
      rawRow: { ...row },
    });
  }

  // Collect PapaParse-level parse errors
  for (const err of parsed.errors) {
    errors.push(`CSV 解析錯誤（第 ${err.row ?? '?'} 列）：${err.message}`);
  }

  return { rows, errors };
}
