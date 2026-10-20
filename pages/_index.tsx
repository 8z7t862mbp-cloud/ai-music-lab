import { useMemo, useState } from 'react';
import { Download, Music2, RefreshCw, Search, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Slider } from '../components/Slider';
import { Textarea } from '../components/Textarea';
import { buildRandomLyrics } from '../helpers/buildRandomLyrics';
import { readMusicApiResponse } from '../helpers/readMusicApiResponse';
import styles from './_index.module.css';
const genres = ['華語流行','抒情情歌','黑色電影','東方都市懸疑','復古爵士與古典管弦','華語懸疑電影','古典偵探說唱（夜的第七章取向）','電影感','電影感懸疑流行','復古 Disco','電子流行','搖滾','R&B','Lo-fi','城市流行','民謠木吉他','爵士','藍調','放克 Funk','Synthwave','嘻哈 Hip-Hop','雷鬼 Reggae','Bossa Nova','古風','華語搖滾抒情','舞曲 EDM'];
const keys = ['C','Cm','C#','C#m','D','Dm','D#','D#m','E','Em','F','Fm','F#','F#m','G','Gm','G#','G#m','A','Am','A#','A#m','B','Bm'];
const reworkSections = ['主歌 1','預副歌','副歌','間奏','主歌 2','橋段','最後副歌','尾奏'];
const voices = ['男聲','女聲','純音樂'];
const timbres: Record<string,string[]> = { 女聲:['清亮女聲','溫柔女聲','成熟女聲','磁性女聲'], 男聲:['清爽男聲','溫暖男聲','成熟男聲','低沉男聲'] };
const emotions = ['自然','深情','壓抑','溫柔','心碎','冷淡','爆發','慵懶','敘事'];
const deliveries = ['自然演唱','輕唱','氣聲','敘事口吻','強烈爆發','低語感','現場感'];
const quality = ['標準','高品質','錄音室級'];
const lyricCraft = ['電影敘事與場景調度','古典意象與工整押韻','細膩心理與留白','現代口語與對話感','黑色電影與懸疑敘事','都市寫實與生活細節','浪漫抒情與溫柔留白','詩性意象與隱喻','哲思寓言與人生感','強烈副歌與金句記憶點','故事推進與人物視角','復古華語情歌筆觸'];
const NO_STYLE = '不設定曲風';
const INSTRUCTION_STYLE = '依照指令創作';
const SONG_INSTRUCTION_STYLE = '依歌曲指令';
const isInstructionStyle = (value:string) => value===NO_STYLE || value===INSTRUCTION_STYLE || value===SONG_INSTRUCTION_STYLE;
type HistoryItem = { id:string; title:string; audioUrl:string; downloadUrl?:string; lyrics:string; lyricStyle:string; style:string; bpm:number; key:string; voice:string; timbre:string; emotion:string; delivery:string; duration:number; structure?:string[]; arrangement:string; production:string; excludeStyles?:string; weirdness?:number; styleInfluence?:number; variety?:string; qualityControl?:string; singerReference?:string; songReference?:string; rework?:string; instruction?:string; };
export default function Index() {
  const [lyrics,setLyrics] = useState('');
  const [instruction,setInstruction] = useState('');
  const [lyricStyle,setLyricStyle] = useState('電影敘事與場景調度');
  const [production,setProduction] = useState('');
  const [style,setStyle] = useState(NO_STYLE);
  const [voice,setVoice] = useState('女聲');
  const [timbre,setTimbre] = useState('溫柔女聲');
  const [emotion,setEmotion] = useState('自然');
  const [delivery,setDelivery] = useState('自然演唱');
  const [bpm,setBpm] = useState(96);
  const [musicKey,setMusicKey] = useState('C');
  const [duration,setDuration] = useState('240');
  const [qualityControl,setQualityControl] = useState('高品質');
  const [arrangement,setArrangement] = useState('');
  const [reference,setReference] = useState('');
  const [songReference,setSongReference] = useState('');
  const [rework,setRework] = useState('副歌');
  const [excludeStyles,setExcludeStyles] = useState('');
  const [weirdness,setWeirdness] = useState(30);
  const [styleInfluence,setStyleInfluence] = useState(70);
  const [variety,setVariety] = useState('Normal');
  const [audioUrl,setAudioUrl] = useState('');
  const [audioDownloadUrl,setAudioDownloadUrl] = useState('');
  const [status,setStatus] = useState('準備就緒');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [history,setHistory] = useState<HistoryItem[]>(()=>{ try{return JSON.parse(localStorage.getItem('ai-music-lab-independent')||'[]')}catch{return []} });
  const [recovering,setRecovering] = useState(false);
  const spec = useMemo(()=>`${isInstructionStyle(style)?style:style} · ${bpm} BPM · ${musicKey} · ${voice}${voice==='純音樂'?'':`／${timbre} · ${emotion}`}`,[style,bpm,musicKey,voice,timbre,emotion]);
  function saveHistory(url:string,downloadUrl:string,lyricsSnapshot=lyrics) {
    const item:HistoryItem={id:String(Date.now()),title:instruction.trim()||`${style} ${musicKey} ${bpm}BPM`,audioUrl:url,downloadUrl,lyrics:lyricsSnapshot,lyricStyle,style,bpm,key:musicKey,voice,timbre,emotion,delivery,duration:Number(duration),arrangement,production,excludeStyles,weirdness,styleInfluence,variety,qualityControl,singerReference:reference,songReference,rework,instruction};
    const next=[item,...history].slice(0,30); setHistory(next); try{localStorage.setItem('ai-music-lab-independent',JSON.stringify(next))}catch{}
  }
  function setVoiceAndTimbre(next:string){setVoice(next);if(next==='女聲')setTimbre('溫柔女聲');else if(next==='男聲')setTimbre('成熟男聲');}
  function randomize(){const result=buildRandomLyrics(isInstructionStyle(style)?'':style,instruction,Number(duration),lyricStyle);setLyrics(result);setStatus('已生成一套新的原創歌詞');setError('')}
  async function generate(){
    if(busy)return;
    const finalLyrics=voice==='純音樂'?'':(lyrics.trim()||buildRandomLyrics(style===NO_STYLE||style===INSTRUCTION_STYLE?'':style,instruction,Number(duration),lyricStyle));
    if(voice!=='純音樂'&&!finalLyrics.trim()){setError('請輸入歌詞，或先輸入創作指令。');return}
    if(voice!=='純音樂'&&!lyrics.trim())setLyrics(finalLyrics);
    setBusy(true);setError('');setStatus(audioUrl?'正在嘗試生成新歌曲；上一首成功的歌曲會保留…':'正在送出 ACE-Step 任務…');
    try{
      const res=await fetch('/_api/music_generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lyrics:finalLyrics,creative_instruction:instruction,lyric_style:lyricStyle,duration:Number(duration),style:isInstructionStyle(style)?'':style,voice,vocal_gender:voice,timbre,bpm,key:musicKey,vocal_emotion:emotion,vocal_delivery:delivery,arrangement_note:arrangement,music_production_instruction:[production,arrangement].filter(Boolean).join('；'),singer_reference:reference,song_reference:songReference,qualityControl,regenerate_section:rework,exclude_styles:excludeStyles,weirdness,style_influence:styleInfluence,variety})});
      const data=await readMusicApiResponse(res);
      if(data.status==='succeeded'&&data.audio_url){
        const downloadUrl=data.download_url||'/_api/music_download?path='+encodeURIComponent(data.audio_url);
        setAudioUrl(data.audio_url);setAudioDownloadUrl(downloadUrl);setStatus('完成！MP3 已實體儲存，可直接下載。');saveHistory(data.audio_url,downloadUrl,finalLyrics);return;
      }
      if(!data.task_id)throw new Error('ACE-Step 沒有回傳完成音訊或任務編號');
      setStatus(data.queue_position?'已排入 ACE-Step 佇列（第 '+data.queue_position+' 位），生成中…':'ACE-Step 已接收任務，生成中…');
      for(let attempt=0;attempt<180;attempt++){
        await new Promise(r=>setTimeout(r,5000));
        let statusData:any=null; let statusError:unknown=null;
        for(let retry=0;retry<3;retry++){
          try{
            const statusRes=await fetch('/_api/music_generate_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:data.task_id})});
            statusData=await readMusicApiResponse(statusRes); statusError=null; break;
          }catch(e){
            statusError=e;
            const message=e instanceof Error?e.message:String(e);
            const transient=/504|502|503|逾時|timeout|timed out|Failed to fetch|NetworkError|fetch failed/i.test(message);
            if(!transient||retry===2)break;
            setStatus('狀態查詢暫時中斷，正在自動重試…');
            await new Promise(r=>setTimeout(r,2000*(retry+1)));
          }
        }
        if(statusError)throw statusError;
        if(statusData.status==='processing'){setStatus('ACE-Step 正在生成歌曲…（已等待 '+Math.round((attempt+1)*5/60)+' 分鐘）');continue}
        if(statusData.status==='failed')throw new Error(statusData.error||'ACE-Step 生成失敗');
        if(statusData.status==='succeeded'&&statusData.audio_url){
          const downloadUrl=statusData.download_url||'/_api/music_download?path='+encodeURIComponent(statusData.audio_url);
          setAudioUrl(statusData.audio_url);setAudioDownloadUrl(downloadUrl);setStatus('完成！MP3 已實體儲存，可直接下載。');saveHistory(statusData.audio_url,downloadUrl,finalLyrics);return;
        }
      }
      throw new Error('歌曲生成時間超過 15 分鐘，請重新送出任務。');
    }catch(e){const message=e instanceof Error?e.message:'目前無法生成歌曲。';const uncertain=/逾時|504|502|503|Failed to fetch|NetworkError|fetch failed|timeout/i.test(message);setStatus(uncertain?(audioUrl?'新歌曲回應中斷；已保留上一首歌曲，請先確認後端音檔':'生成回應中斷；結果尚未確認'):(audioUrl?'新歌曲生成失敗；已保留上一首歌曲':'生成失敗'));setError(message)}
    finally{setBusy(false)}
  }
  function load(item:HistoryItem){
    const loadedVoice=item.voice==='純音樂'?'純音樂':item.voice==='男聲'?'男聲':'女聲'; const validTimbres=loadedVoice==='男聲'?timbres['男聲']:timbres['女聲']; const loadedTimbre=loadedVoice==='純音樂'?'成熟男聲':validTimbres.includes(item.timbre)?item.timbre:(loadedVoice==='男聲'?'成熟男聲':'溫柔女聲'); setLyrics(item.lyrics);setInstruction(item.instruction||'');setLyricStyle(item.lyricStyle||'電影敘事與場景調度');setStyle(item.style);setBpm(item.bpm);setMusicKey(item.key);setVoice(loadedVoice);setTimbre(loadedTimbre);setEmotion(item.emotion);setDelivery(item.delivery);setDuration(String(item.duration));setArrangement(item.arrangement||'');setProduction(item.production||'');setExcludeStyles(item.excludeStyles||'');setWeirdness(item.weirdness??30);setStyleInfluence(item.styleInfluence??70);setVariety(item.variety||'Normal');setQualityControl(item.qualityControl||'高品質');setReference(item.singerReference||'');setSongReference(item.songReference||'');setRework(item.rework||'副歌');setAudioUrl(item.audioUrl);setAudioDownloadUrl(item.downloadUrl||`/_api/music_download?path=${encodeURIComponent(item.audioUrl)}`);setStatus('已載入歌曲版本');setError('')
  }
  async function download(){
    if(!audioDownloadUrl&&!audioUrl)return;
    const target=audioDownloadUrl||`/_api/music_download?path=${encodeURIComponent(audioUrl)}`;
    try{
      setStatus('正在準備 MP3 下載…');
      const response=await fetch(target);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      if(blob.size<1000)throw new Error('MP3 檔案內容異常');
      const file=new File([blob],`AI-Music-${Date.now()}.mp3`,{type:'audio/mpeg'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'AI Music Lab MP3'});setStatus('MP3 已準備完成，請在分享選單選「儲存到檔案」');return}
      const objectUrl=URL.createObjectURL(blob);const a=document.createElement('a');a.href=objectUrl;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);setStatus('MP3 下載已開始');
    }catch(e){setError(`MP3 下載失敗：${e instanceof Error?e.message:'請重新產生歌曲後再試。'}`)}
  }
  async function recoverBackendSongs(){
    if(recovering)return;
    setRecovering(true);setError('');setStatus('正在查詢後端已儲存的音檔…');
    try{
      const response=await fetch('/_api/music_recover',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||`查詢失敗（HTTP ${response.status}）`);
      const existing=new Set(history.map(item=>item.audioUrl));
      const recovered:HistoryItem[]=(Array.isArray(data.files)?data.files:[])
        .filter((file:{audio_url?:string})=>typeof file.audio_url==='string'&&!existing.has(file.audio_url))
        .map((file:{id:string;title:string;audio_url:string;download_url:string;created_at:number})=>({
          id:String(file.created_at||file.id),title:file.title,audioUrl:file.audio_url,downloadUrl:file.download_url,
          lyrics:'',lyricStyle:'電影敘事與場景調度',style:'後端找回',bpm:96,key:'C',voice:'女聲',timbre:'溫柔女聲',emotion:'自然',delivery:'自然演唱',duration:240,arrangement:'',production:''
        }));
      const next=[...recovered,...history].slice(0,100);
      setHistory(next);try{localStorage.setItem('ai-music-lab-independent',JSON.stringify(next))}catch{}
      setStatus(recovered.length?`已找回 ${recovered.length} 個後端音檔，已加入歌曲清單。`:`查詢完成：沒有發現尚未加入清單的新音檔（後端共回傳 ${(Array.isArray(data.files)?data.files.length:0)} 個檔案）。`);
    }catch(e){setStatus('後端音檔查詢失敗');setError(e instanceof Error?e.message:'目前無法查詢後端音檔。')}
    finally{setRecovering(false)}
  }
  return <main className={styles.page}>
    <header className={styles.hero}><div className={styles.brand}><span className={styles.logo}><Music2 size={20}/></span><span>AI MUSIC LAB</span><span className={styles.independent}>獨立版</span></div><h1>把一個念頭，<em>做成完整的歌。</em></h1><p>以完整歌曲製作流程為核心：創作方向、曲風、人聲、編曲、聲音質感與混音目標。</p></header>
    <section className={styles.card}>
      <div className={styles.field}><label>歌詞</label><Textarea value={lyrics} onChange={e=>setLyrics(e.target.value)} placeholder="可直接貼完整歌詞；也可以只寫創作指令，系統自動生成原創歌詞。" /></div>
      <div className={styles.panel}><div className={styles.label}>🎨 歌曲創作方向</div><small>控制「這首歌要表達什麼」：主題、故事、情緒、氛圍、畫面與創意。不是編曲設定。</small><Input value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="中文、英文或中英混合都可以，例如：dark cinematic mood, 72 BPM, piano + cello"/><small>指令不限語言：中文、English、或中英混合皆可，系統會直接參考你的創作要求。</small><div className={styles.quick}>{['輕快風','Rap風','中國風','神秘緊張感','失戀苦澀感','浪漫甜蜜感','深夜孤獨感','電影史詩感'].map(x=><Button key={x} size="sm" variant="outline" onClick={()=>setInstruction(x)}>{x}</Button>)}</div></div>
      <div className={styles.panel}><div className={styles.label}>✍️ 詞作質感</div><Select value={lyricStyle} onValueChange={setLyricStyle}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{lyricCraft.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><small><strong>真正會影響歌詞寫法。</strong> 使用「隨機生成歌詞」時，會依這個選項套用對應的敘事、押韻、意象、心理描寫與副歌金句規則；如果你已經手動貼上歌詞，系統不會擅自改寫你的文字，但會把這個質感作為演唱與段落詮釋參考。</small></div>
      <div className={styles.panel}><div className={styles.panelHead}><div><strong>🎼 音樂製作指令</strong><span>支援中文、英文或中英混合。控制樂器、節奏、段落層次、聲音質感與混音方向。</span></div></div><Textarea value={production} maxLength={1000} onChange={e=>setProduction(e.target.value)} placeholder="例如：72 BPM、Dm；主歌鋼琴＋大提琴留白，副歌加入室內弦樂；不要搖滾、不要 EDM。" /><small>{production.length}/1000 字元。最多 1,000 字元會送入生成提示詞。</small></div>
      <div className={styles.panel}><div className={styles.panelHead}><div><strong>🎻 編曲補充指令（新增）</strong><span>選填。適合指定主奏樂器、配器分工、演奏技巧、段落對比與樂器音量；會與音樂製作指令一起送入後端。</span></div></div><Textarea value={arrangement} maxLength={1000} onChange={e=>setArrangement(e.target.value)} placeholder="例如：獨奏小提琴在前景；第一、第二小提琴與中提琴交錯對答；大提琴與低音提琴支撐低音；大鍵琴負責通奏低音；慢板使用清楚的撥奏伴奏。" /><small>{arrangement.length}/1000 字元。這是補充欄位，不填也可以生成。</small></div>
      <div className={styles.actions}><Button variant="outline" onClick={randomize}><Sparkles size={16}/> 隨機生成歌詞</Button><span>依曲風、指令與歌曲長度生成完整故事結構。</span></div>
      <div className={styles.panel}><div className={styles.label}>曲風</div><div className={styles.chips}><Button size="sm" variant={style===INSTRUCTION_STYLE?'secondary':'outline'} onClick={()=>setStyle(INSTRUCTION_STYLE)}>依照指令創作</Button><Button size="sm" variant={style===SONG_INSTRUCTION_STYLE?'secondary':'outline'} onClick={()=>setStyle(SONG_INSTRUCTION_STYLE)}>依歌曲指令</Button><Button size="sm" variant={style===NO_STYLE?'secondary':'outline'} onClick={()=>setStyle(NO_STYLE)}>不設定曲風</Button>{genres.map(x=><Button key={x} size="sm" variant={style===x?'secondary':'outline'} onClick={()=>setStyle(x)}>{x}</Button>)}</div><small>「依照指令創作」與「依歌曲指令」都不套用預設曲風，主要依你的歌曲創作方向與音樂製作指令生成。</small></div>
      <div className={styles.grid2}><div className={styles.panel}><div className={styles.panelHead}><strong>BPM</strong><b>{bpm}</b></div><Slider min={55} max={160} step={1} value={[bpm]} onValueChange={v=>setBpm(v[0])}/></div><div className={styles.panel}><div className={styles.label}>Key 調性</div><Select value={musicKey} onValueChange={setMusicKey}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{keys.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div></div>
      <div className={styles.panel}><div className={styles.panelTitle}>🎛️ 進階生成控制</div><small>以下設定都會實際影響歌曲生成。所有文字指令欄位均支援<strong>中文或英文</strong>，可混合輸入。</small><div className={styles.advancedGrid}>
        <div className={styles.controlBox}><label>排除風格／聲音</label><Input value={excludeStyles} onChange={e=>setExcludeStyles(e.target.value)} placeholder="中文或英文皆可，例如：搖滾、EDM、長笛、二胡"/><small>會同時加入生成提示與負向控制，實際排除指定風格／聲音。</small></div>
        <div className={styles.controlBox}><label>演唱方式</label><div className={styles.segmented}>{voices.map(v=><button type="button" key={v} className={voice===v?styles.segActive:styles.segBtn} onClick={()=>setVoiceAndTimbre(v)}>{v}</button>)}</div><small>{voice==='純音樂'?'不生成任何人聲，直接製作純伴奏。':'會同步鎖定人聲性別設定，並送入後端。'}</small></div>
        <div className={styles.controlBox}><div className={styles.controlHead}><label>音樂創意度</label><b>{weirdness}%</b></div><Slider min={0} max={100} step={1} value={[weirdness]} onValueChange={v=>setWeirdness(v[0])}/><small>控制旋律與音樂的探索程度；越高越有變化，越低越保守。</small></div>
        <div className={styles.controlBox}><div className={styles.controlHead}><label>指令影響力</label><b>{styleInfluence}%</b></div><Slider min={0} max={100} step={1} value={[styleInfluence]} onValueChange={v=>setStyleInfluence(v[0])}/><small>控制曲風與創作指令對最終歌曲的影響強度。</small></div>
        <div className={styles.controlBox}><label>歌曲變化度</label><Select value={variety} onValueChange={setVariety}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Low">低變化</SelectItem><SelectItem value="Normal">正常</SelectItem><SelectItem value="High">高變化</SelectItem></SelectContent></Select><small>控制同一首歌內旋律、配器與段落發展的變化量。</small></div>
      </div></div>
      <div className={styles.panel}><div className={styles.panelTitle}>🎤 人聲製作</div><div className={styles.grid4}><FieldSelect label="演唱方式" value={voice} onChange={setVoiceAndTimbre} items={voices}/>{voice!=='純音樂'&&<><FieldSelect label="音色" value={timbre} onChange={setTimbre} items={timbres[voice]}/><FieldSelect label="情緒" value={emotion} onChange={setEmotion} items={emotions}/><FieldSelect label="唱法" value={delivery} onChange={setDelivery} items={deliveries}/></>}</div>{voice==='純音樂'&&<small>純音樂模式會略過歌詞與人聲設定，依照曲風、創作指令及編曲指令生成器樂作品。</small>}</div>
      <div className={styles.panel}><div className={styles.panelTitle}>🎚️ 歌曲長度與品質控制</div><div className={styles.grid3}><FieldSelect label="長度" value={duration} onChange={setDuration} items={[['210','約 3:30'],['240','約 4:00'],['300','約 5:00'],['360','約 6:00']]}/><FieldSelect label="品質控制" value={qualityControl} onChange={setQualityControl} items={quality}/><div><label>目前規格</label><div className={styles.spec}>{spec}</div></div></div></div>
      <div className={styles.grid2}><div className={styles.panel}><div className={styles.label}>歌手聲音參考</div><Input value={reference} onChange={e=>setReference(e.target.value)} placeholder="例如：成熟低沉男聲、廣義聲線特徵"/><small>只轉成廣義聲線特徵，不複製特定人物原聲。</small></div><div className={styles.panel}><div className={styles.label}>曲風參考歌曲</div><Input value={songReference} onChange={e=>setSongReference(e.target.value)} placeholder="輸入歌名作為廣義風格參考"/><small>只取曲風、情緒、編曲方向，不複製旋律、歌詞或 hook。</small></div></div>
      <div className={styles.panel}><div className={styles.panelHead}><div><strong>🎛️ 段落重製</strong><span>整首重新生成，指定一個段落作為主要改善目標。</span></div><div className={styles.rework}><FieldSelect label="重製段落" value={rework} onChange={setRework} items={reworkSections}/><Button variant="outline" onClick={()=>setProduction(`${production} 主要改善「${rework}」：提高旋律記憶點、情緒張力與編曲層次，保留其他段落故事與整體風格。`.trim())}>套用</Button></div></div></div>
      <Button size="lg" className={styles.generate} disabled={busy} onClick={generate}><Wand2 size={20}/>{busy?'AI 正在生成…':'開始生成歌曲'}</Button>
      <div className={styles.status}><span className={status.includes('失敗')?styles.bad:styles.ok}/>{status}</div>{error&&<div className={styles.error}>{error}</div>}
      {audioUrl&&<div className={styles.result}><div><strong>你的歌曲完成了</strong><span>{spec}</span></div><audio controls src={audioUrl}/><Button variant="outline" onClick={download}><Download size={17}/> 下載 MP3</Button></div>}
      <div className={styles.history}><div className={styles.panelHead}><strong>我的歌曲與版本（{history.length}）</strong><div className={styles.quick}><Button size="sm" variant="outline" disabled={recovering} onClick={recoverBackendSongs}><Search size={15}/>{recovering?'查詢中…':'找回後端音檔'}</Button><Button size="sm" variant="outline" onClick={()=>window.location.reload()}><RefreshCw size={15}/> 重新整理頁面</Button></div></div><small>「找回後端音檔」會直接查詢已儲存的音檔，不只查看本機清單。找回的檔案可播放與下載，但原始歌詞和生成設定不一定能還原。</small>{history.length===0?<span>成功生成後會自動保存。</span>:history.map(item=><div className={styles.historyItem} key={item.id}><div><b>{item.title}</b><span>{new Date(Number(item.id)).toLocaleString('zh-TW')} · {item.style} · {item.bpm} BPM · {item.key}</span></div><Button size="sm" variant="outline" onClick={()=>load(item)}>載入</Button></div>)}</div>
    </section><footer>AI Music Lab 獨立版 · ACE-Step 音樂生成 · 不依賴 AppDeploy 作為日常運行主機</footer>
  </main>;
}
function FieldSelect({label,value,onChange,items}:{label:string;value:string;onChange:(v:string)=>void;items:(string|string[])[]}){return <div><label>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{items.map(item=>{const v=Array.isArray(item)?item[0]:item;const text=Array.isArray(item)?item[1]:item;return <SelectItem key={v} value={v}>{text}</SelectItem>})}</SelectContent></Select></div>}
