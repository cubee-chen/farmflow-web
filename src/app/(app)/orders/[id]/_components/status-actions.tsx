'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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

type Action = 'confirm' | 'pay' | 'ship' | 'complete' | 'cancel';

const ACTION_LABEL: Record<Action, string> = {
  confirm: '確認訂單',
  pay: '標記已收款',
  ship: '標記已出貨',
  complete: '標記已完成',
  cancel: '取消訂單',
};

const ACTION_CONFIRM_MSG: Record<Action, string> = {
  confirm: '確認此訂單後將通知相關流程，確定嗎？',
  pay: '確認已收到款項？',
  ship: '確認已將商品出貨？',
  complete: '將訂單標記為已完成？',
  cancel: '確定要取消這筆訂單？此操作無法復原。',
};

interface Props {
  orderId: string;
  status: string;
  paymentStatus: string;
}

export function StatusActions({ orderId, status, paymentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<Action | null>(null);

  const actions: Action[] = [];
  if (status === 'draft') actions.push('confirm');
  if (status === 'confirmed') {
    if (paymentStatus !== 'paid') actions.push('pay');
    actions.push('ship');
  }
  if (status === 'packing') actions.push('ship');
  if (status === 'shipped') actions.push('complete');
  if (['draft', 'confirmed', 'packing', 'shipped'].includes(status)) actions.push('cancel');

  if (actions.length === 0) return null;

  async function handleConfirm() {
    if (!activeAction) return;
    startTransition(async () => {
      const result = await changeOrderStatus(orderId, activeAction!);
      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success(ACTION_LABEL[activeAction!] + ' 成功');
        router.refresh();
      }
      setActiveAction(null);
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            variant={action === 'cancel' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => setActiveAction(action)}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </div>

      <Dialog open={!!activeAction} onOpenChange={(open) => !open && setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAction ? ACTION_LABEL[activeAction] : ''}</DialogTitle>
            <DialogDescription>
              {activeAction ? ACTION_CONFIRM_MSG[activeAction] : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)} disabled={pending}>
              取消
            </Button>
            <Button
              variant={activeAction === 'cancel' ? 'destructive' : 'default'}
              onClick={handleConfirm}
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
