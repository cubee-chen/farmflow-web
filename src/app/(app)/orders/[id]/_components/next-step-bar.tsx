'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Truck, Clock, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { changeOrderStatus } from '@/app/(app)/orders/actions';

type Action = 'confirm' | 'ship' | 'complete';

interface Props {
  orderId: string;
  status: string;
  paymentStatus: string;
}

interface StepConfig {
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: { kind: 'action'; action: Action; label: string; confirmMsg: string };
  link?: { href: string; label: string };
}

// Map of (status, payment) → recommended next step. Returning null hides the
// bar entirely (for terminal/cancelled orders or unhandled state combos).
function nextStep(status: string, paymentStatus: string): StepConfig | null {
  if (status === 'draft') {
    return {
      hint: '下一步：確認此筆訂單',
      icon: CheckCircle2,
      primary: {
        kind: 'action',
        action: 'confirm',
        label: '確認訂單',
        confirmMsg: '確認此訂單後將自動推播 LINE 通知（若已綁定），確定嗎？',
      },
    };
  }
  if (status === 'confirmed' && paymentStatus !== 'paid') {
    return {
      hint: '下一步：等待客戶轉帳完成（對帳後會自動標記已收款）',
      icon: Clock,
      link: { href: '/reconciliation', label: '前往對帳' },
    };
  }
  if (status === 'confirmed' && paymentStatus === 'paid') {
    return {
      hint: '下一步：前往出貨管理下載黑貓 Excel',
      icon: Truck,
      link: { href: '/fulfillment', label: '前往出貨' },
    };
  }
  if (status === 'packing') {
    return {
      hint: '下一步：交貨給黑貓後標記為已出貨',
      icon: PackageCheck,
      primary: {
        kind: 'action',
        action: 'ship',
        label: '標記已出貨',
        confirmMsg: '將此訂單標記為「已出貨」？系統會自動推播 LINE 出貨通知（若已綁定）。',
      },
    };
  }
  if (status === 'shipped') {
    return {
      hint: '下一步：客戶收到後標記為已完成',
      icon: CheckCircle2,
      primary: {
        kind: 'action',
        action: 'complete',
        label: '標記已完成',
        confirmMsg: '將此訂單標記為「已完成」？',
      },
    };
  }
  return null;
}

export function NextStepBar({ orderId, status, paymentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const step = nextStep(status, paymentStatus);
  if (!step) return null;

  const { hint, icon: Icon, primary, link } = step;

  function handleConfirm() {
    if (!primary) return;
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, primary.action);
      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success(`${primary.label} 完成`);
        router.refresh();
      }
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <div className="fixed bottom-16 left-0 right-0 lg:left-56 lg:bottom-0 bg-emerald-50 border-t border-emerald-200 px-4 py-3 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Icon className="h-5 w-5 text-emerald-700 shrink-0" />
          <p className="text-sm text-emerald-900 flex-1 min-w-0">{hint}</p>
          {primary && (
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}>
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
        </div>
      </div>

      {primary && (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{primary.label}</DialogTitle>
              <DialogDescription>{primary.confirmMsg}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                取消
              </Button>
              <Button onClick={handleConfirm} disabled={pending}>
                確定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
