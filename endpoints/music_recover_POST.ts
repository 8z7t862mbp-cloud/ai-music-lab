import { listFolder, getUrl } from '@floot/storage';

export async function handle() {
  try {
    const listed = await listFolder({ visibility: 'public', key: 'music/' });
    if (!listed.ok) return Response.json({ error: '無法讀取後端歌曲清單：' + listed.error.message }, { status: 502 });
    const candidates = listed.files
      .filter(file => /^public\/music\/ai-music-\d+\.(mp3|wav|ogg|audio)$/i.test(file.key))
      .map(file => ({ file, createdAt: Number(file.key.match(/ai-music-(\d+)/i)?.[1] || 0) }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
    const files = [];
    for (const item of candidates) {
      const filename = item.file.key.replace(/^public\//, '');
      const result = await getUrl({ visibility: 'public', filename });
      if (!result.ok) continue;
      files.push({
        id: String(item.createdAt),
        title: '後端音檔 ' + new Date(item.createdAt).toLocaleString('zh-TW'),
        audio_url: result.url,
        download_url: '/_api/music_download?path=' + encodeURIComponent(result.url),
        created_at: item.createdAt,
      });
    }
    return Response.json({ files });
  } catch (error) {
    console.error('Music recovery listing failed', error);
    return Response.json({ error: error instanceof Error ? error.message : '讀取後端歌曲清單失敗。' }, { status: 502 });
  }
}
