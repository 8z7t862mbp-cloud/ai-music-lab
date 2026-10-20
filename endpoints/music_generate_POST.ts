import superjson from 'superjson';
import { upload } from '@floot/storage';
import { schema } from './music_generate_POST.schema';

function errMessage(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const o = value as Record<string, unknown>;
  if (typeof o.error === 'string') return o.error;
  if (o.error && typeof o.error === 'object' && typeof (o.error as Record<string, unknown>).message === 'string') return String((o.error as Record<string, unknown>).message);
  for (const k of ['detail', 'message']) if (typeof o[k] === 'string') return String(o[k]);
  return '';
}
function providerFailureMessage(status: number, contentType: string, text: string, data: unknown) {
  const isCloudflare504 = status === 504 || (/cloudflare/i.test(text) && /(504|gateway\s*time.?out)/i.test(text));
  if (isCloudflare504) return 'ACE Music Cloud 生成逾時（Cloudflare 504）。這是上游服務逾時，AI Music Lab 尚未收到歌曲音訊；請稍後再試。';
  const isHtml = /text\/html/i.test(contentType) || /^\s*<!doctype\s+html|^\s*<html/i.test(text);
  if (isHtml) return `ACE Music Cloud 回傳錯誤頁面（HTTP ${status}），沒有收到歌曲音訊；請稍後再試。`;
  return errMessage(data) || 'ACE-Step Cloud HTTP ' + status;
}
const styles: Record<string, string> = {
  '黑色電影': 'classic film noir fused with mature Mandarin pop; dark piano, upright bass, brushed drums, muted brass, chamber strings, minor and chromatic harmony',
  '東方都市懸疑': 'East Asian urban mystery soundtrack; dark piano, deep bass, restrained electronic pulse, low chamber strings, sophisticated pentatonic/chromatic suspense',
  '復古爵士與古典管弦': 'vintage jazz fused with classical orchestra; upright bass, brushed drums, jazz piano, muted brass, saxophone and warm chamber strings',
  '華語懸疑電影': 'Mandarin mystery film soundtrack; dark piano, cello, chamber strings, restrained low percussion, subtle atmospheric textures, sophisticated minor/modal harmony',
  '華語流行': 'modern polished Mandarin pop; piano, clean guitar, melodic bass, contemporary drums, tasteful synth pads and a memorable chorus',
  '古典偵探說唱（夜的第七章取向）': 'Mandarin classical-detective rap-pop; dark minor/modal piano motif, controlled rhythmic percussion, chamber strings, deep bass and restrained electronic pulse; rhythmic rap verses and a wide melodic chorus',
};
const quality: Record<string, string> = {
  '標準': 'balanced clear production, stable pitch and tempo, complete ending',
  '高品質': 'high-fidelity production, natural phrasing, clean centered vocal, controlled dynamics, clear low-end and complete ending; no humming',
  '錄音室級': 'studio-grade production, precise pitch, natural human phrasing, realistic vocal tone, balanced vocal/instrument levels, controlled dynamics, purposeful arrangement, clean mix and deliberate outro; no humming',
};
const lyricCraft: Record<string, string> = {
  '電影敘事與場景調度': 'cinematic songwriting with concrete locations, sensory details, character actions, scene continuity and a clear story arc',
  '古典意象與工整押韻': 'classical Chinese imagery, elegant metaphor, balanced phrasing and controlled rhyme; natural meaning, never forced rhyme',
  '細膩心理與留白': 'subtle psychology, emotional subtext, restrained metaphor, implication and meaningful silence',
  '現代口語與對話感': 'natural contemporary Mandarin, believable details, short singable lines and everyday observations',
  '黑色電影與懸疑敘事': 'noir clues, shadows, meaningful objects, withheld information, escalating suspicion and a reveal/payoff',
  '都市寫實與生活細節': 'realistic urban scenes, specific daily objects, believable relationships and concrete actions',
  '浪漫抒情與溫柔留白': 'tender romantic imagery, intimate details, warm progression and restrained declarations',
  '詩性意象與隱喻': 'coherent poetic imagery, extended metaphor, sensory language and recurring symbols',
  '哲思寓言與人生感': 'a clear life question, concrete story or metaphor, reflective progression and a final reframing line',
  '強烈副歌與金句記憶點': 'short memorable chorus lines, semantic contrast, repeatable hook wording and a clear emotional thesis',
  '故事推進與人物視角': 'close character viewpoint, cause-and-effect events, concrete conflict, escalating stakes and resolved emotional change',
  '復古華語情歌筆觸': 'elegant retro Mandarin-pop diction, concrete romantic imagery, restrained sentiment, balanced rhyme and polished singable chorus',
};
const compact = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);

function buildPrompt(body: Record<string, unknown>) {
  const lyrics = typeof body.lyrics === 'string' ? body.lyrics.trim() : '';
  const instruction = typeof body.creative_instruction === 'string' ? body.creative_instruction.trim() : '';
  const style = typeof body.style === 'string' ? body.style.trim() : '';
  const production = typeof body.music_production_instruction === 'string' ? body.music_production_instruction.trim() : '';
  const singerReference = typeof body.singer_reference === 'string' ? body.singer_reference.trim() : '';
  const songReference = typeof body.song_reference === 'string' ? body.song_reference.trim() : '';
  const weirdness = Math.min(100, Math.max(0, Number(body.weirdness ?? 30)));
  const styleInfluence = Math.min(100, Math.max(0, Number(body.style_influence ?? 70)));
  const variety = typeof body.variety === 'string' ? body.variety : 'Normal';
  const reworkSection = typeof body.regenerate_section === 'string' ? body.regenerate_section.trim() : '';
  const bpm = Math.min(Math.max(Number(body.bpm) || 96, 55), 160);
  const key = typeof body.key === 'string' ? body.key : 'C';
  const keyScaleForApi: Record<string, string> = {
    C:'C major', Cm:'C minor', 'C#':'C# major', 'C#m':'C# minor', D:'D major', Dm:'D minor',
    'D#':'D# major', 'D#m':'D# minor', E:'E major', Em:'E minor', F:'F major', Fm:'F minor',
    'F#':'F# major', 'F#m':'F# minor', G:'G major', Gm:'G minor', 'G#':'G# major', 'G#m':'G# minor',
    A:'A major', Am:'A minor', 'A#':'A# major', 'A#m':'A# minor', B:'B major', Bm:'B minor'
  };
  const requestedText = [instruction, production, style].join(' ');
  const timeSignatureMatch = requestedText.match(/(?:time\s*signature\s*[:=]?\s*)?\b(2\/4|3\/4|4\/4|5\/4|6\/8|7\/8|9\/8|12\/8)\b/i);
  const timeSignature = timeSignatureMatch?.[1] || '4/4';
  const voice = typeof body.vocal_gender === 'string' ? body.vocal_gender : '女聲';
  const instrumental = voice === '純音樂';
  const timbre = typeof body.timbre === 'string' ? body.timbre : (voice === '男聲' ? '成熟男聲' : '溫柔女聲');
  const emotion = typeof body.vocal_emotion === 'string' ? body.vocal_emotion : '自然';
  const delivery = typeof body.vocal_delivery === 'string' ? body.vocal_delivery : '自然演唱';
  const lyricStyle = typeof body.lyric_style === 'string' ? body.lyric_style : '電影敘事與場景調度';
  const exclude = typeof body.exclude_styles === 'string' ? body.exclude_styles.trim() : '';
  const styleText = style && style !== '不設定曲風' ? (styles[style] || style) : (instrumental ? 'original instrumental composition' : 'original Mandarin song');
  const classicalPianoRequest = instrumental && /piano|鋼琴|beethoven|貝多芬|sonata|奏鳴曲|classical|古典|moonlight|月光/i.test([instruction, production, style].join(' '));
  const genderLock = instrumental
    ? 'INSTRUMENTAL ONLY; absolutely no human voice, singing, speech, humming, choir, vocal samples or wordless vocals'
    : voice === '男聲'
      ? 'ONE adult male lead singer only; same male timbre and gender throughout; no female voice, female harmony, duet, androgynous voice or gender switching'
      : 'ONE adult female lead singer only; same female timbre and gender throughout; no male voice, male harmony, duet, androgynous voice or gender switching';
  const studio = instrumental
    ? 'professional instrumental composition; one clearly dominant lead melody; supporting parts must serve the same musical phrase and harmonic progression; stable tonal center and consistent tuning; deliberate voice leading; bass notes must support the current harmony; coordinated rhythm and phrase endings; accompaniment must not compete with the lead; use only instruments appropriate to the requested genre and named in the production brief; percussion only when explicitly requested or clearly appropriate; coherent section development, purposeful transitions and complete ending; natural instrument tone and balanced mix; no random instrument changes, unrelated melodic lines, unnecessary modulation, clashing sustained notes, unstable pitch or tempo, cheap presets, toy synths, genre switching, voice or vocal samples'
    : 'professional commercial record; natural human phrasing and intonation; stable pitch and rhythm; clear Mandarin diction; melody locked to harmony; believable instrument tone; deliberate bass and rhythm groove appropriate to the requested genre; dynamic verse-to-chorus build; memorable chorus hook; polished studio mix; clean vocal center; controlled low end; smooth highs; no cheap presets, toy synths, random instruments, genre switching, humming or wordless vocals';
  const compositionPlan = classicalPianoRequest
    ? 'CLASSICAL PIANO COMPOSITION RULES: compose an original, clearly organized Classical-era solo piano sonata. State a short, memorable melodic motif early and keep returning to recognizable versions of it. Build phrases in balanced 2- and 4-bar units with clear beginnings, responses, pauses and cadences. The right hand must carry a singable, clearly audible melody; the left hand must provide a steady, harmonically correct accompaniment and bass line. Change chords deliberately and resolve dominant tension to tonic. Use fast sixteenth-note runs only as brief transitions or developments of the established motif; do not fill every beat with unrelated notes. Keep a consistent pulse, coherent voice-leading and a clear tonal center. Create contrast between theme, development and return, then finish with a decisive, harmonically resolved coda. One acoustic concert grand piano only; no orchestral or cinematic arrangement.'
    : '';
  const creativityDirection = weirdness <= 20
    ? 'low creative variation: prioritize stable motifs, predictable phrasing and tonal consistency; avoid surprise changes'
    : weirdness <= 45
      ? 'moderate creative variation: introduce controlled melodic and harmonic development while preserving the main musical identity'
      : weirdness <= 70
        ? 'high creative variation: explore bolder development but preserve coherent rhythm, harmony and phrase structure'
        : 'very high creative variation: allow adventurous development without losing pulse, tonal logic or phrase continuity';
  const adherenceDirection = styleInfluence >= 80
    ? 'strictly follow the requested genre, instrumentation, mood and production instructions'
    : styleInfluence >= 55
      ? 'closely follow the requested style while allowing restrained musical interpretation'
      : styleInfluence >= 30
        ? 'use the requested style as a guide while allowing broader musical interpretation'
        : 'treat the requested style as a loose reference while keeping the result musically coherent';
  const varietyDirection = variety === 'Low'
    ? 'low section-to-section variation; maintain a consistent motif, accompaniment pattern and sound palette'
    : variety === 'High'
      ? 'strong but purposeful section-to-section variation; every change must grow from the main musical idea'
      : 'moderate section-to-section variation with clear continuity between sections';
  const negative = [genderLock, instrumental ? 'singing, spoken words, human voice, vocal chops, choir, vocal pads, humming' : 'humming, vocalise, wordless vocals, choir, vocal pads, random vocal fragments before lyrics', 'pitch drift, unstable intonation, out-of-tune notes, clashing harmonies, incompatible chord progressions, wrong bass notes, competing lead melodies, unrelated simultaneous melodies, uncontrolled counterpoint, random instrument changes, abrupt key changes, unrelated solos, clashing sustained notes, piercing squeaks or whistles', exclude].filter(Boolean).join(', ');
  const performance = instrumental ? 'instrumental only, no vocals' : timbre + '; ' + emotion + '; ' + delivery;
  // Keep the user's production brief intact. It must not be lost to the old 220-char
  // field cap or the old 512-char final-prompt cap.
  const prompt = [styleText, compact(instruction, 240), compact(production, 1000), creativityDirection, adherenceDirection, varietyDirection, compositionPlan, singerReference ? 'Broad vocal timbre reference: ' + compact(singerReference, 180) : '', songReference ? 'Broad musical reference traits only; create original melodies: ' + compact(songReference, 180) : '', reworkSection ? 'Primary improvement target: ' + compact(reworkSection, 60) + '; improve melodic identity, phrasing and arrangement.' : '', instrumental ? 'instrumental melody and arrangement with clear sections and a complete ending' : compact(lyricCraft[lyricStyle] || lyricCraft['電影敘事與場景調度'], 120), compact(quality[String(body.qualityControl) || '高品質'] || quality['高品質'], 150), studio, 'AUTHORITATIVE SETTINGS (override conflicting text above): tempo ' + bpm + ' BPM; key ' + (keyScaleForApi[key] || key) + '; time signature ' + timeSignature + '; ' + performance].filter(Boolean).join('; ');
  return { prompt: compact(prompt, 4000), negative, lyrics, bpm, key, keyScale: keyScaleForApi[key] || key, timeSignature, duration: Math.min(Math.max(Number(body.duration) || 240, 30), 600) };
}

export async function handle(request: Request) {
  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();
  try {
    const raw = await request.text();
    if (!raw.trim()) return Response.json({ error: '生成請求沒有收到資料，請重新按一次「開始生成歌曲」。' }, { status: 400 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { parsed = superjson.parse(raw); }
    const body = schema.parse(parsed) as Record<string, unknown>;
    const built = buildPrompt(body);
    const instrumental = body.vocal_gender === '純音樂' || body.voice === '純音樂';
    if (!instrumental && !built.lyrics && !String(body.creative_instruction || '').trim()) return Response.json({ error: '請輸入歌詞，或提供創作指令。' }, { status: 400 });
    // Use the official Hugging Face Space's documented Gradio queue API.
    // The Space publishes its live endpoint schema at /gradio_api/info; it does
    // not expose the REST /v1/music/generate or /v1/jobs routes used below.
    const freeApiBase = 'https://ace-step-ace-step-v1-5.hf.space';
    const infoResponse = await fetch(freeApiBase + '/gradio_api/info', {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000),
    });
    if (!infoResponse.ok) return Response.json({ error: '免費 ACE-Step Space 目前無法讀取 API 規格（HTTP ' + infoResponse.status + '），尚未提交生成任務。' }, { status: 503 });
    const info = await infoResponse.json() as { named_endpoints?: Record<string, { parameters?: unknown[] }> };
    const generationEndpoint = info.named_endpoints?.['/generation_wrapper'];
    if (!generationEndpoint || !Array.isArray(generationEndpoint.parameters) || generationEndpoint.parameters.length !== 49) {
      return Response.json({ error: '免費 ACE-Step Space 的生成介面已變更，與目前驗證過的 49 個參數規格不同；為避免錯誤生成，已停止提交。' }, { status: 503 });
    }
    // Official Space captions are limited to 512 characters and lyrics to 4096.
    const caption = built.prompt.slice(0, 512);
    const lyrics = instrumental ? '[Instrumental]' : built.lyrics.slice(0, 4096);
    const timeSignature = built.timeSignature.split('/')[0];
    const vocalLanguage = instrumental ? 'unknown' : 'zh';
    const gradioData = [
      'acestep-v15-turbo', 'custom', '', vocalLanguage, caption, lyrics,
      built.bpm, built.keyScale, timeSignature, vocalLanguage,
      8, 7, true, '-1', null, built.duration, 1, null, null,
      0, -1, 'Fill the audio semantic mask based on the given conditions:',
      1, 'text2music', false, 0, 1, 3, 'ode', '', 'mp3', 0.7, false,
      2, 0, 0.9, built.negative.slice(0, 1000), false, false, false,
      false, true, false, false, 0.5, 8, null, [], instrumental,
    ];
    const submitResponse = await fetch(freeApiBase + '/gradio_api/call/generation_wrapper', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: gradioData }), signal: AbortSignal.timeout(15000),
    });
    const submitText = await submitResponse.text();
    let submitData: unknown;
    try { submitData = JSON.parse(submitText); } catch { submitData = null; }
    const eventId = submitData && typeof submitData === 'object' ? (submitData as Record<string, unknown>).event_id : null;
    if (!submitResponse.ok || typeof eventId !== 'string' || !eventId) {
      console.error('Hugging Face Gradio submission failed', { requestId, status: submitResponse.status, response: submitText.slice(0, 500) });
      return Response.json({ error: '免費 ACE-Step Space 未能接收生成任務（HTTP ' + submitResponse.status + '）。沒有產生可用歌曲；請稍後再試。' }, { status: 502 });
    }
    return Response.json({
      status: 'processing', task_id: 'hfgradio:' + eventId,
      provider: 'huggingface-ace-step', style: String(body.style || ''),
      bpm: built.bpm, key: built.key, duration: built.duration,
      quality_control: String(body.qualityControl || ''),
      music_production_instruction: String(body.music_production_instruction || ''),
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : '目前無法提交歌曲生成任務。';
    console.error('ACE-Step generation request failed', { requestId, elapsedMs: Date.now() - requestStartedAt, name: e instanceof Error ? e.name : 'UnknownError', message });
    if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) return Response.json({ error: '免費 ACE-Step Space API 連線逾時；任務是否已被接收無法確認，請先使用「找回後端音檔」確認，再決定是否重試。', request_id: requestId }, { status: 504 });
    return Response.json({ error: message, request_id: requestId }, { status: 502 });
  }
}
