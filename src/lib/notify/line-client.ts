const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const MAX_TEXT_LENGTH = 5000;

function splitText(text: string): string[] {
  if (text.length <= MAX_TEXT_LENGTH) return [text];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + MAX_TEXT_LENGTH));
    offset += MAX_TEXT_LENGTH;
  }
  return chunks;
}

export async function sendLinePushMessage(params: {
  channelAccessToken: string;
  toUserId: string;
  text: string;
}): Promise<{ messageId: string }> {
  const { channelAccessToken, toUserId, text } = params;
  const messages = splitText(text).map((t) => ({ type: 'text', text: t }));

  const res = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to: toUserId, messages }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`LINE push failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { sentMessages?: { id: string }[] };
  const messageId = data.sentMessages?.[0]?.id ?? 'unknown';
  return { messageId };
}
