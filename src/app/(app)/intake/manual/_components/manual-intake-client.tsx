'use client';
import { useRouter } from 'next/navigation';
import { OrderDraftEditor } from '@/components/shared/order-draft-editor';
import type { Product } from '@/lib/db/schema';
import type { ParsedOrderDraft } from '@/lib/llm/types';

const EMPTY_DRAFT: ParsedOrderDraft = {
  items: [],
  recipient_name: null,
  recipient_phone: null,
  recipient_address: null,
  delivery_zip: null,
  delivery_preference: null,
  desired_arrival_date: null,
  bank_last_5: null,
  notes: null,
  confidence: 1.0,
  ambiguities: [],
};

export function ManualIntakeClient({ products }: { products: Product[] }) {
  const router = useRouter();
  return (
    <OrderDraftEditor
      draft={EMPTY_DRAFT}
      rawText=""
      products={products}
      onSaved={(orderId) => router.push(`/orders/${orderId}`)}
      onCancel={() => router.push('/intake')}
    />
  );
}
