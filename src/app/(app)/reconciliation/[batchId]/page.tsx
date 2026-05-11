import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { BatchDetailClient } from './_components/batch-detail-client';

interface Props {
  params: Promise<{ batchId: string }>;
}

export default async function BatchDetailPage({ params }: Props) {
  const { batchId } = await params;
  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/reconciliation"
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
          aria-label="返回對帳列表"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">對帳批次詳情</h1>
      </div>
      <BatchDetailClient batchId={batchId} />
    </div>
  );
}
