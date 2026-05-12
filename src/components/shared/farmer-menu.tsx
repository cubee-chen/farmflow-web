'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ChevronDown, Package, Users } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface FarmerMenuProps {
  farmName: string | null;
  name: string;
}

export function FarmerMenu({ farmName, name }: FarmerMenuProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-8 px-2">
            <span className="text-sm font-medium text-zinc-700 max-w-[140px] truncate">
              {farmName ?? name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium text-zinc-900 truncate">{farmName ?? name}</p>
            <p className="text-xs text-zinc-500 truncate">{name}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/products" className="flex items-center gap-2 cursor-pointer">
              <Package className="h-4 w-4" />
              商品管理
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/customers" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4" />
              客戶名單
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              設定
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer"
            onSelect={() => setConfirmOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            登出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定登出？</AlertDialogTitle>
            <AlertDialogDescription>
              登出後需重新輸入帳號密碼才能使用系統。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleSignOut}
            >
              確定登出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
