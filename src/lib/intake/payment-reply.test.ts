import { describe, it, expect, vi } from 'vitest';

// Stub out heavy/server-only deps before importing the module under test.
vi.mock('server-only', () => ({}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() };
  },
}));
vi.mock('@/lib/db', () => ({ db: {} }));

import { looksLikePaymentReply, extractLast5 } from './payment-reply';

describe('looksLikePaymentReply', () => {
  it.each([
    ['已轉帳囉！'],
    ['轉帳了'],
    ['末5碼：59681'],
    ['末五碼 12345'],
    ['尾5碼 98765'],
    ['匯款了，謝謝'],
    ['好'],
    ['好的'],
    ['OK'],
    ['收到'],
  ])('detects %s as payment reply', (msg) => {
    expect(looksLikePaymentReply(msg)).toBe(true);
  });

  it.each([
    ['我要 2 箱中的，台中市信義區 X 路 1 號，0956978521 汪汪明'],
    ['我要訂大箱x3 寄到台北'],
    [''],
    ['這是一段很長的訊息描述客戶的訂單內容包含商品數量收件人地址電話等等資訊不應被判定為付款回覆才對哦哦哦'],
  ])('does NOT classify "%s" as payment reply', (msg) => {
    expect(looksLikePaymentReply(msg)).toBe(false);
  });
});

describe('extractLast5', () => {
  it('prefers labelled five-digit codes', () => {
    expect(extractLast5('末5碼：59681')).toBe('59681');
    expect(extractLast5('末五碼 12345')).toBe('12345');
    expect(extractLast5('尾5碼 98765')).toBe('98765');
  });

  it('falls back to a bare five-digit number', () => {
    expect(extractLast5('已轉帳 59681 謝謝')).toBe('59681');
  });

  it('ignores embedded longer digit runs', () => {
    expect(extractLast5('0912345678 王小明')).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(extractLast5('已轉帳囉！')).toBeNull();
  });
});
