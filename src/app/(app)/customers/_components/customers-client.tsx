'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, MessageCircleOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Customer } from '@/lib/db/schema';

type Filter = 'all' | 'linked' | 'unlinked';

interface Props {
  customers: Customer[];
}

export function CustomersClient({ customers }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const displayed = customers.filter((c) => {
    if (filter === 'linked') return !!c.line_user_id;
    if (filter === 'unlinked') return !c.line_user_id;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'linked', 'unlinked'] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {{ all: '全部', linked: '已綁 LINE', unlinked: '未綁 LINE' }[f]}
          </Button>
        ))}
        <span className="ml-auto text-sm text-zinc-400 self-center">
          共 {displayed.length} 位
        </span>
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">沒有符合的客戶</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((c) => (
            <Card key={c.id} className="relative hover:shadow-sm transition-shadow">
              <Link href={`/customers/${c.id}`} className="absolute inset-0" aria-label="查看客戶詳情" />
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* LINE status icon */}
                  <span className={c.line_user_id ? 'text-green-500' : 'text-zinc-300'}>
                    {c.line_user_id
                      ? <MessageCircle className="size-4" />
                      : <MessageCircleOff className="size-4" />
                    }
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {c.default_name ?? c.line_display_name ?? '（未命名）'}
                      </span>
                      {c.line_display_name && c.line_display_name !== c.default_name && (
                        <span className="text-xs text-zinc-400">{c.line_display_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {c.primary_phone || '—'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-zinc-800">
                      NT${Number(c.total_amount ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-zinc-400">{c.total_orders ?? 0} 筆</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merge entry point lives on the customer detail page since it needs a source customer */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-zinc-500"
          onClick={() => toast.info('請進入客戶詳情頁，從「合併到其他客戶」啟動合併')}
        >
          合併客戶
        </Button>
      </div>
    </div>
  );
}
