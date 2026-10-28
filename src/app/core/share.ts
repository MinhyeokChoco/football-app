// 폰에서는 공유 시트(카톡 바로 고르기), 안 되면 클립보드로 복사한다.
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<ShareResult> {
  // url 을 따로 넘기면 iOS 공유 시트의 "복사"가 링크를 문구 맨 위에 붙인다.
  // 문구 끝에 직접 넣어서 어디로 보내든 "문구 → 링크" 순서가 되게 한다.
  const message = `${data.text}\n${data.url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: data.title, text: message });
      return 'shared';
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우. 복사로 넘어가지 않는다.
      if ((err as Error).name === 'AbortError') return 'cancelled';
    }
  }
  return copyText(message);
}

export async function copyText(text: string): Promise<ShareResult> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// 친구들에게 보내는 링크. 주최자 키는 절대 붙이지 않는다.
export const eventUrl = (eventId: string) => `${location.origin}/e/${eventId}`;

// 다른 기기에서 주최자가 되는 링크. 단톡방에 올리면 안 된다.
export const hostUrl = (eventId: string, key: string) => `${eventUrl(eventId)}?key=${key}`;
