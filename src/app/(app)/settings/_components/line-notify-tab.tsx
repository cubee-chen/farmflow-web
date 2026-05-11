'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveLineCredentials, testLinePush } from '../line-actions';

function MaskedInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-700"
        tabIndex={-1}
        aria-label={visible ? '隱藏' : '顯示'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

interface Props {
  initialSecret: string;
  initialToken: string;
}

export function LineNotifyTab({ initialSecret, initialToken }: Props) {
  const [secret, setSecret] = useState(initialSecret);
  const [token, setToken] = useState(initialToken);
  const [savedSecret, setSavedSecret] = useState(initialSecret);
  const [savedToken, setSavedToken] = useState(initialToken);
  const [testUserId, setTestUserId] = useState('');

  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();

  const isDirty = secret !== savedSecret || token !== savedToken;

  function handleSave() {
    startSave(async () => {
      const result = await saveLineCredentials(secret, token);
      if ('error' in result) {
        toast.error(result.error);
      } else {
        setSavedSecret(secret);
        setSavedToken(token);
        toast.success('已儲存');
      }
    });
  }

  function handleTest() {
    startTest(async () => {
      const result = await testLinePush(testUserId);
      if ('error' in result) {
        toast.error(`推播失敗：${result.error}`);
      } else {
        toast.success(`推播成功！Message ID: ${result.messageId}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">LINE Messaging API 設定</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="line-secret">Channel Secret</Label>
            <MaskedInput
              id="line-secret"
              value={secret}
              onChange={setSecret}
              placeholder="32 位英數字"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-token">Channel Access Token</Label>
            <MaskedInput
              id="line-token"
              value={token}
              onChange={setToken}
              placeholder="長效 Token（186 個字元）"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? '儲存中…' : '儲存'}
            </Button>
            <a
              href="/docs/p1-line-setup.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="size-3" />
              設定教學
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">測試推播</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-user-id">測試用 LINE userId</Label>
            <Input
              id="test-user-id"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="font-mono text-sm"
            />
            <p className="text-xs text-zinc-400">
              如何取得 userId → 參考上方設定教學
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !testUserId.trim() || !savedToken}
          >
            {isTesting ? '傳送中…' : '測試推播'}
          </Button>
          {!savedToken && (
            <p className="text-xs text-amber-600">請先儲存 Channel Access Token 再測試</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
