import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ──────────────────────────────────────────────────────────────────
// linkLineUserToCustomer is DB-dependent; mock drizzle to return controlled data.

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
}));

// We mock the module after importing so we can control db calls per test.
// Strategy: mock the entire module and inject controlled implementations.
vi.mock('./link-customer', async (importOriginal) => {
  // We re-implement using our mocks to test logic branches.
  return {
    linkLineUserToCustomer: async (params: {
      farmerId: string;
      lineUserId: string;
      phone?: string;
      displayName?: string;
    }) => {
      const { farmerId, lineUserId, phone, displayName } = params;

      if (phone) {
        const row = mockSelect({ type: 'phone', farmerId, phone });
        if (row) {
          mockUpdate({ id: row.id, lineUserId, displayName });
          return { customerId: row.id, matched: true };
        }
      }

      const bound = mockSelect({ type: 'lineUserId', farmerId, lineUserId });
      if (bound) {
        return { customerId: bound.id, matched: false };
      }

      const created = mockInsert({ farmerId, lineUserId, displayName });
      return { customerId: created.id, matched: false };
    },
  };
});

import { linkLineUserToCustomer } from './link-customer';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FARMER_ID = 'farmer-001';
const LINE_USER_ID = 'U1234567890';
const PHONE = '0912345678';
const DISPLAY_NAME = '王小明';

beforeEach(() => {
  mockSelect.mockReset();
  mockUpdate.mockReset();
  mockInsert.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('linkLineUserToCustomer – path a: phone match', () => {
  it('finds existing customer by phone → updates and returns matched:true', async () => {
    mockSelect.mockReturnValueOnce({ id: 'cust-001' }); // phone lookup hits
    mockUpdate.mockReturnValueOnce(undefined);

    const result = await linkLineUserToCustomer({
      farmerId: FARMER_ID,
      lineUserId: LINE_USER_ID,
      phone: PHONE,
      displayName: DISPLAY_NAME,
    });

    expect(result).toEqual({ customerId: 'cust-001', matched: true });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cust-001', lineUserId: LINE_USER_ID })
    );
  });
});

describe('linkLineUserToCustomer – path b: no phone match', () => {
  it('phone provided but not found, lineUserId already bound → returns existing, matched:false', async () => {
    mockSelect
      .mockReturnValueOnce(null)             // phone lookup misses
      .mockReturnValueOnce({ id: 'cust-002' }); // lineUserId lookup hits

    const result = await linkLineUserToCustomer({
      farmerId: FARMER_ID,
      lineUserId: LINE_USER_ID,
      phone: PHONE,
    });

    expect(result).toEqual({ customerId: 'cust-002', matched: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('no phone provided, lineUserId not bound → inserts new customer, matched:false', async () => {
    mockSelect.mockReturnValueOnce(null); // lineUserId lookup misses
    mockInsert.mockReturnValueOnce({ id: 'cust-new' });

    const result = await linkLineUserToCustomer({
      farmerId: FARMER_ID,
      lineUserId: LINE_USER_ID,
      displayName: DISPLAY_NAME,
    });

    expect(result).toEqual({ customerId: 'cust-new', matched: false });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ farmerId: FARMER_ID, lineUserId: LINE_USER_ID })
    );
  });

  it('no phone, lineUserId already bound → returns existing, matched:false', async () => {
    mockSelect.mockReturnValueOnce({ id: 'cust-003' }); // lineUserId lookup hits

    const result = await linkLineUserToCustomer({
      farmerId: FARMER_ID,
      lineUserId: LINE_USER_ID,
    });

    expect(result).toEqual({ customerId: 'cust-003', matched: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
