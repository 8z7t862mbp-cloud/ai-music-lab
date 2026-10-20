import { upload } from '@floot/storage';
import superjson from 'superjson';
import { schema } from './music_generate_status_POST.schema';

const SPACE_BASE = 'https://ace-step-ace-step-v1-5.hf.space';

export async function handle(request: Request) {
  try {
    const raw = await request.text();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = superjson.parse(raw); }
    const { task_id } = schema.parse(parsed);
    if (!task_id.startsWith('hfgradio:')) {
      return Response.json({ status: 'failed', task_id, error: '這個任務不是目前免費 ACE-Step Space 的任務格式。請重新提交生成；既有已儲存歌曲不受影響。' }, { status: 400 });
    }

    const eventId = task_id.slice('hfgradio:'.length);
    if (!/^[a-zA-Z0-9_-]{8,160}$/.test(eventId)) {
      return Response.json({ status: 'failed', task_id, error: 'ACE-Step 任務編號格式不正確。' }, { status: 400 });
    }

    let eventResponse: Response;
    try {
      eventResponse = await fetch(SPACE_BASE + '/gradio_api/call/generation_wrapper/' + encodeURIComponent(eventId), {
        headers: { Accept: 'text/event-stream' },
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        return Response.json({ status: 'processing', task_id, provider: 'huggingface-ace-step' });
      }
      throw error;
    }
    if (!eventResponse.ok) {
      return Response.json({ status: 'failed', task_id, error: '免費 ACE-Step Space 狀態查詢失敗（HTTP ' + eventResponse.status + '）。請稍後再試。' }, { status: 502 });
    }

    let eventText = '';
    try {
      eventText = await eventResponse.text();
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        return Response.json({ status: 'processing', task_id, provider: 'huggingface-ace-step' });
      }
      throw error;
    }

    const events = eventText.replace(/\r\n/g, '\n').split('\n\n').filter(Boolean);
    let completed: unknown = null;
    let providerError = false;
    for (const event of events) {
      const eventName = event.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
      const dataText = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (eventName === 'error') providerError = true;
      if (eventName === 'complete' && dataText) {
        try { completed = JSON.parse(dataText); } catch { providerError = true; }
      }
    }

    if (providerError) {
      return Response.json({ status: 'failed', task_id, error: '免費 ACE-Step Space 已回報生成錯誤，沒有取得音檔。Space 可能忙碌或模型初始化失敗；原有歌曲不受影響。' });
    }
    if (completed === null) {
      return Response.json({ status: 'processing', task_id, provider: 'huggingface-ace-step' });
    }

    const outputs = Array.isArray(completed) ? completed : [];
    const audio = outputs[0] && typeof outputs[0] === 'object' ? outputs[0] as Record<string, unknown> : null;
    const remotePath = typeof audio?.url === 'string' ? audio.url : typeof audio?.path === 'string' ? audio.path : '';
    if (!remotePath) {
      return Response.json({ status: 'failed', task_id, error: 'ACE-Step 回報任務完成，但沒有回傳可讀取的音檔路徑。' });
    }

    const audioUrl = new URL(remotePath, SPACE_BASE).toString();
    if (new URL(audioUrl).origin !== SPACE_BASE) {
      return Response.json({ status: 'failed', task_id, error: 'ACE-Step 回傳的音檔網址不在官方 Space 網域，已停止下載。' });
    }
    const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(60000) });
    if (!audioResponse.ok) {
      return Response.json({ status: 'failed', task_id, error: '歌曲已生成，但從免費 Space 下載音訊失敗（HTTP ' + audioResponse.status + '）。' }, { status: 502 });
    }

    const audioBuffer = new Uint8Array(await audioResponse.arrayBuffer());
    if (audioBuffer.byteLength < 1000) {
      return Response.json({ status: 'failed', task_id, error: '免費 ACE-Step Space 回傳的音訊檔案太小或內容異常。' });
    }
    const contentType = String(audio?.mime_type || audioResponse.headers.get('content-type') || 'audio/mpeg').split(';')[0];
    const ext = contentType.includes('wav') ? 'wav' : contentType.includes('flac') ? 'flac' : contentType.includes('ogg') ? 'ogg' : 'mp3';
    const stored = await upload({
      visibility: 'public',
      filename: 'music/ai-music-' + Date.now() + '.' + ext,
      sizeBytes: audioBuffer.byteLength,
      contentType,
    });
    if (!stored.ok || !stored.presignedUrl || !stored.url) {
      return Response.json({ status: 'failed', task_id, error: '歌曲已生成，但後端音檔儲存授權失敗。' }, { status: 502 });
    }
    const put = await fetch(stored.presignedUrl, { method: 'PUT', headers: stored.headers, body: audioBuffer });
    if (!put.ok) {
      return Response.json({ status: 'failed', task_id, error: '歌曲已生成，但後端音檔儲存失敗（HTTP ' + put.status + '）。' }, { status: 502 });
    }
    return Response.json({
      status: 'succeeded',
      task_id,
      audio_url: stored.url,
      download_url: '/_api/music_download?path=' + encodeURIComponent(stored.url),
      provider: 'huggingface-ace-step',
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return Response.json({ status: 'processing', error: '免費 ACE-Step Space 暫時沒有回覆，請稍後自動重查。' });
    }
    return Response.json({ status: 'failed', error: error instanceof Error ? error.message : '查詢歌曲生成狀態失敗。' }, { status: 502 });
  }
}
