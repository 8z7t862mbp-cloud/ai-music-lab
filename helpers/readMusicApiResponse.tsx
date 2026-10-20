export async function readMusicApiResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}

  if (!data || typeof data !== 'object') {
    if (response.status === 504 || (/cloudflare/i.test(text) && /(504|gateway\s*time.?out)/i.test(text))) {
      throw new Error('ACE Music Cloud 逾時（Cloudflare 504）。閘道沒有及時收到回應；上游任務是否仍在執行目前無法確認。請先使用「找回後端音檔」檢查結果，避免立刻重送造成重複生成。');
    }
    const isHtml = /text\/html/i.test(response.headers.get('content-type') || '') || /^\s*<!doctype\s+html|^\s*<html/i.test(text);
    if (isHtml) throw new Error(`生成服務回傳錯誤頁面（HTTP ${response.status}），沒有收到歌曲音訊；請稍後再試。`);
    throw new Error(`生成服務回傳無法辨識的內容（HTTP ${response.status}），沒有收到歌曲音訊。`);
  }

  if (!response.ok) {
    const providerError = typeof data.error === 'string' ? data.error : '';
    if (response.status === 504 || (/cloudflare/i.test(providerError) && /(504|gateway\s*time.?out)/i.test(providerError))) {
      throw new Error('ACE Music Cloud 逾時（Cloudflare 504）。閘道沒有及時收到回應；上游任務是否仍在執行目前無法確認。請先使用「找回後端音檔」檢查結果，避免立刻重送造成重複生成。');
    }
    if (/<html|<!doctype\s+html/i.test(providerError)) {
      throw new Error(`生成服務回傳錯誤頁面（HTTP ${response.status}），沒有收到歌曲音訊；請稍後再試。`);
    }
    throw new Error(providerError || data.message || `生成服務請求失敗（HTTP ${response.status}）。`);
  }
  return data;
}
