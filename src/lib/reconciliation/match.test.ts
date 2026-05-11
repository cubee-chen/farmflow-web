import { describe, it, expect, vi } from 'vitest';

// Mock the DB module so no connection is attempted during tests.
// computeMatch is a pure function and never touches the DB.
vi.mock('@/lib/db', () => ({ db: {} }));

import { computeMatch } from './match';
import type { TxInput, OrderCandidate } from './match';

// ─── Shared fixtures ──────────────────────────────────────────────────────────
//
// 3 transactions × 5 orders covering Rule 1 / Rule 2 / Rule 3 / unmatched.
//
// Orders:
//  o1 – exact match candidate for tx1 (amount=1200, last5="34567")
//  o2 – amount-only candidate for tx2 (amount=600, last5 mismatch)
//  o3 – close-amount candidate for tx3 (amount=9990, diff=9 ≤ 10)
//  o4 – bystander, no transaction has amount=500
//  o5 – amount=1200 but wrong last5 ("99999"), so Rule 1 skips it for tx1

const ordersPool: OrderCandidate[] = [
  { id: 'o1', total_amount: '1200.00', bank_last_5: '34567' },
  { id: 'o2', total_amount: '600.00',  bank_last_5: '22222' },
  { id: 'o3', total_amount: '9990.00', bank_last_5: null    },
  { id: 'o4', total_amount: '500.00',  bank_last_5: null    },
  { id: 'o5', total_amount: '1200.00', bank_last_5: '99999' },
];

const tx1: TxInput = { id: 'tx1', amount: '1200.00', account_last_5: '34567' };
const tx2: TxInput = { id: 'tx2', amount: '600.00',  account_last_5: '11111' };
const tx3: TxInput = { id: 'tx3', amount: '9999.00', account_last_5: '00000' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeMatch – Rule 1 (exact: amount + last-5)', () => {
  it('single candidate → matched, confidence=1.00', () => {
    // o1: amount=1200, last5="34567" ✓
    // o5: amount=1200, last5="99999" ✗ (not null, not "34567")
    const r = computeMatch(tx1, ordersPool);
    expect(r.match_status).toBe('matched');
    expect(r.confidence).toBe('1.00');
    expect(r.order_id).toBe('o1');
    expect(r.candidates).toBeNull();
  });

  it('multi_candidate when two orders satisfy Rule 1', () => {
    const poolMC: OrderCandidate[] = [
      { id: 'm1', total_amount: '1200.00', bank_last_5: '34567' }, // exact last5
      { id: 'm2', total_amount: '1200.00', bank_last_5: null    }, // null bank_last5 also passes Rule 1
    ];
    const r = computeMatch(tx1, poolMC);
    expect(r.match_status).toBe('multi_candidate');
    expect(r.confidence).toBe('0.50');
    expect(r.order_id).toBeNull();
    expect(r.candidates).toEqual(expect.arrayContaining(['m1', 'm2']));
  });
});

describe('computeMatch – Rule 2 (amount-only)', () => {
  it('single candidate → matched, confidence=0.80', () => {
    // tx2 last5="11111"; o2 has last5="22222" → Rule 1 fails → Rule 2 hits o2
    const r = computeMatch(tx2, ordersPool);
    expect(r.match_status).toBe('matched');
    expect(r.confidence).toBe('0.80');
    expect(r.order_id).toBe('o2');
  });

  it('multi_candidate when two orders share the same amount', () => {
    const poolMC: OrderCandidate[] = [
      { id: 'r2a', total_amount: '600.00', bank_last_5: '22222' },
      { id: 'r2b', total_amount: '600.00', bank_last_5: '33333' },
    ];
    const r = computeMatch(tx2, poolMC);
    expect(r.match_status).toBe('multi_candidate');
    expect(r.confidence).toBe('0.50');
    expect(r.candidates).toEqual(expect.arrayContaining(['r2a', 'r2b']));
  });
});

describe('computeMatch – Rule 3 (amount ±10)', () => {
  it('close-amount candidate → amount_mismatch, confidence=0.30', () => {
    // tx3=9999, o3=9990 → diff=9 ≤ 10
    const r = computeMatch(tx3, ordersPool);
    expect(r.match_status).toBe('amount_mismatch');
    expect(r.confidence).toBe('0.30');
    expect(r.order_id).toBeNull();
    expect(r.candidates).toContain('o3');
  });
});

describe('computeMatch – unmatched', () => {
  it('no candidate in any rule → unmatched, confidence=0.00', () => {
    const txFar: TxInput = { id: 'tx-far', amount: '99999.00', account_last_5: null };
    const r = computeMatch(txFar, ordersPool);
    expect(r.match_status).toBe('unmatched');
    expect(r.confidence).toBe('0.00');
    expect(r.order_id).toBeNull();
    expect(r.candidates).toBeNull();
  });
});

describe('cross-farmer isolation', () => {
  it('only orders passed to computeMatch are considered', () => {
    // Simulate: farmer A's transaction should only see farmer A's orders.
    // runMatchEngine enforces this via WHERE farmer_id = farmerId in the DB query.
    const farmerAOrders: OrderCandidate[] = [
      { id: 'a1', total_amount: '1200.00', bank_last_5: null },
    ];
    const farmerBOrders: OrderCandidate[] = [
      { id: 'b1', total_amount: '9000.00', bank_last_5: null },
    ];

    const txA: TxInput = { id: 'txA', amount: '1200.00', account_last_5: null };

    // Farmer A's transaction matches farmer A's order
    const rA = computeMatch(txA, farmerAOrders);
    expect(rA.match_status).toBe('matched');
    expect(rA.order_id).toBe('a1');

    // If we only pass farmer B's unrelated orders, farmer A's transaction gets no match
    const rB = computeMatch(txA, farmerBOrders);
    expect(rB.match_status).toBe('unmatched');
  });
});

describe('payment_status not mutated', () => {
  it('computeMatch never touches order objects', () => {
    const order: OrderCandidate & { payment_status?: string } = {
      id: 'chk',
      total_amount: '1200.00',
      bank_last_5: null,
      payment_status: 'unpaid',
    };
    computeMatch(tx1, [order]);
    // payment_status must remain untouched
    expect(order.payment_status).toBe('unpaid');
  });
});
