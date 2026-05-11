import 'server-only';

interface LineProfile {
  displayName: string | null;
  pictureUrl: string | null;
}

export async function fetchLineProfile(
  userId: string,
  channelAccessToken: string,
): Promise<LineProfile> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });
    if (!res.ok) {
      console.error(`[line-profile] ${res.status}`, await res.text().catch(() => ''));
      return { displayName: null, pictureUrl: null };
    }
    const data = (await res.json()) as { displayName?: string; pictureUrl?: string };
    return {
      displayName: data.displayName ?? null,
      pictureUrl: data.pictureUrl ?? null,
    };
  } catch (err) {
    console.error('[line-profile] fetch failed:', err);
    return { displayName: null, pictureUrl: null };
  }
}
