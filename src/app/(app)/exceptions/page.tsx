import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getCurrentFarmer } from '@/lib/auth/require-farmer';
import { getExceptionData } from '@/lib/queries/exceptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FailedNotifySection } from './_components/failed-notify-section';

export default async function ExceptionsPage() {
  const farmer = await getCurrentFarmer();
  const { reconciliationAnomalies, failedNotifyLogs, lowConfidenceOrders } =
    await getExceptionData(farmer.id);

  const totalCount =
    reconciliationAnomalies.reduce((s, r) => s + r.anomalyCount, 0) +
    failedNotifyLogs.length +
    lowConfidenceOrders.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">待處理異常</h1>
        {totalCount > 0 ? (
          <Badge className="bg-red-100 text-red-700">{totalCount}</Badge>
        ) : (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="size-4" /> 全部清空
          </span>
        )}
      </div>

      {/* 1. Reconciliation anomalies */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            對帳異常
            {reconciliationAnomalies.length > 0 && (
              <Badge className="bg-orange-100 text-orange-700 text-xs">
                {reconciliationAnomalies.reduce((s, r) => s + r.anomalyCount, 0)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {reconciliationAnomalies.length === 0 ? (
            <p className="text-sm text-zinc-400">無待處理對帳異常</p>
          ) : (
            <div className="space-y-2">
              {reconciliationAnomalies.map((batch) => (
                <Link
                  key={batch.batchId}
                  href={`/reconciliation/${batch.batchId}`}
                  className="flex items-center justify-between rounded-md border border-orange-100 bg-orange-50 px-3 py-2.5 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-orange-500 shrink-0" />
                    <span className="text-sm text-zinc-700">
                      {batch.filename ?? '未命名批次'}
                    </span>
                  </div>
                  <Badge className="bg-orange-200 text-orange-800 text-xs">
                    {batch.anomalyCount} 筆待處理
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Failed notifications */}
      <FailedNotifySection logs={failedNotifyLogs} />

      {/* 3. Low-confidence orders */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            解析低信心訂單
            {lowConfidenceOrders.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                {lowConfidenceOrders.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {lowConfidenceOrders.length === 0 ? (
            <p className="text-sm text-zinc-400">無低信心草稿訂單</p>
          ) : (
            <div className="space-y-2">
              {lowConfidenceOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-md border border-yellow-100 bg-yellow-50 px-3 py-2.5 hover:bg-yellow-100 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-zinc-700 truncate block">
                      {order.orderNumber ?? '（草稿）'} · {order.recipientName}
                    </span>
                  </div>
                  <Badge className="bg-yellow-200 text-yellow-800 text-xs shrink-0 ml-2">
                    信心 {Math.round(Number(order.parseConfidence ?? 0) * 100)}%
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
