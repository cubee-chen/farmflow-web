'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  CheckCircle2,
  Truck,
  Clock,
  PackageCheck,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { changeOrderStatus } from '@/app/(app)/orders/actions';

type Action = 'confirm' | 'pay' | 'ship' | 'complete' | 'cancel';

interface Props {
  orderId: string;
  status: string;
  paymentStatus: string;
}

interface ActionSpec {
  action: Action;
  label: string;
  confirmMsg: string;
  destructive?: boolean;
}

interface StepConfig {
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: ActionSpec;
  link?: { href: string; label: string };
  secondary?: ActionSpec[];
}

const CANCEL_ACTION: ActionSpec = {
  action: 'cancel',
  label: '取消訂單',
  confirmMsg: '確定要取消這筆訂單？此操作無法復原。',
  destructive: true,
};

// Map (status, payment_status) → recommended primary action plus a small set
// of secondary actions exposed under a "…" menu. Returning null hides the bar
// for terminal/cancelled orders.
function nextStep(status: string, paymentStatus: string): StepConfig | null {
  if (status === 'draft') {
    return {
      hint: '下一步：確認此筆訂單',
      icon: CheckCircle2,
      primary: {
        action: 'confirm',
        label: '確認訂單',
        confirmMsg: '確認此訂單後將自動推播 LINE 通知（若已綁定），確定嗎？',
      },
      secondary: [CANCEL_ACTION],
    };
  }
  if (status === 'confirmed' && paymentStatus !== 'paid') {
    return {
      hint: '下一步：等待客戶轉帳（對帳後會自動標記已收款）',
      icon: Clock,
      link: { href: '/reconciliation', label: '前往對帳' },
      secondary: [
        {
          action: 'pay',
          label: '手動標已收款',
          confirmMsg: '確認已收到款項？對帳工具未涵蓋的情境（如現金）才需手動。',
        },
        CANCEL_ACTION,
      ],
    };
  }
  if (status === 'confirmed' && paymentStatus === 'paid') {
    return {
      hint: '下一步：前往出貨管理下載黑貓 Excel',
      icon: Truck,
      link: { href: '/fulfillment', label: '前往出貨' },
      secondary: [CANCEL_ACTION],
    };
  }
  if (status === 'packing') {
    return {
      hint: '下一步：交貨給黑貓後標記為已出貨',
      icon: PackageCheck,
      primary: {
        action: 'ship',
        label: '標記已出貨',
        confirmMsg: '將此訂單標記為「已出貨」？系統會自動推播 LINE 出貨通知（若已綁定）。',
      },
      secondary: [CANCEL_ACTION],
    };
  }
  if (status === 'shipped') {
    return {
      hint: '下一步：客戶收到後標記為已完成',
      icon: CheckCircle2,
      primary: {
        action: 'complete',
        label: '標記已完成',
        confirmMsg: '將此訂單標記為「已完成」？',
      },
      secondary: [CANCEL_ACTION],
    };
  }
  return null;
}

export function NextStepBar({ orderId, status, paymentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeSpec, setActiveSpec] = useState<ActionSpec | null>(null);

  const step = nextStep(status, paymentStatus);
  if (!step) return null;

  const { hint, icon: Icon, primary, link, secondary } = step;

  function runAction(spec: ActionSpec) {
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, spec.action);
      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success(`${spec.label} 完成`);
        router.refresh();
      }
      setActiveSpec(null);
    });
  }

  return (
    <>
      <div className="fixed bottom-16 left-0 right-0 lg:left-56 lg:bottom-0 bg-emerald-50 border-t border-emerald-200 px-4 py-3 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Icon className="h-5 w-5 text-emerald-700 shrink-0" />
          <p className="text-sm text-emerald-900 flex-1 min-w-0">{hint}</p>

          {primary && (
            <Button size="sm" onClick={() => setActiveSpec(primary)} disabled={pending}>
              {primary.label}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {link && (
            <Button asChild size="sm" variant="default">
              <Link href={link.href}>
                {link.label}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}

          {secondary && secondary.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="px-2" aria-label="更多動作">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondary.map((spec) => (
                  <DropdownMenuItem
                    key={spec.action}
                    onSelect={() => setActiveSpec(spec)}
                    className={spec.destructive ? 'text-red-600 focus:text-red-600' : ''}
                  >
                    {spec.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={!!activeSpec} onOpenChange={(open) => !open && setActiveSpec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeSpec?.label}</DialogTitle>
            <DialogDescription>{activeSpec?.confirmMsg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveSpec(null)} disabled={pending}>
              取消
            </Button>
            <Button
              variant={activeSpec?.destructive ? 'destructive' : 'default'}
              onClick={() => activeSpec && runAction(activeSpec)}
              disabled={pending}
            >
              確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
