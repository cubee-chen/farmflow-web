'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('請輸入有效的電子郵件'),
  password: z.string().min(6, '密碼至少 6 個字元'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/intake';

  const [failCount, setFailCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  async function onSubmit(values: FormValues) {
    setErrorMsg(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      const next = failCount + 1;
      setFailCount(next);
      setErrorMsg(
        next >= 3
          ? '帳號或密碼錯誤。若忘記密碼請聯繫管理員。'
          : '帳號或密碼錯誤'
      );
      return;
    }

    router.replace(redirect);
  }

  return (
    <div className="w-full max-w-sm mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🍅</div>
        <h1 className="text-xl font-bold text-zinc-900">FarmFlow</h1>
        <p className="text-sm text-zinc-500 mt-1">農友出貨系統</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">電子郵件</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="farmer@example.com"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">密碼</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {errorMsg}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登入中…
            </>
          ) : (
            '登入'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-400">
        忘記密碼？請聯繫管理員
      </p>
    </div>
  );
}
