function isAllowedPath(value:string){try{const u=new URL(value);return u.pathname.startsWith('/_cdn/static/')||u.pathname.startsWith('/_cdn/')}catch{return false}}
function isAllowedAceUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&/(^|\\.)acemusic\\.ai$/i.test(u.hostname)}catch{return false}}

export async function handle(request:Request){
  try{
    const params=new URL(request.url).searchParams;
    const path=params.get('path')||'';
    let target='';
    if(path){
      const candidate=new URL(path,request.url).toString();
      if(!isAllowedPath(candidate))return new Response('Invalid audio path',{status:400});
      target=candidate;
    }else{
      const url=params.get('url')||'';
      if(!isAllowedAceUrl(url))return new Response('Invalid audio URL',{status:400});
      target=url;
    }
    const upstream=await fetch(target);
    if(!upstream.ok)return new Response('Audio is no longer available',{status:502});
    const headers=new Headers();
    headers.set('Content-Type','audio/mpeg');
    headers.set('Content-Disposition','attachment; filename="AI-Music.mp3"');
    headers.set('Cache-Control','private, max-age=0, no-store');
    const len=upstream.headers.get('content-length');
    if(len)headers.set('Content-Length',len);
    return new Response(upstream.body,{status:200,headers});
  }catch{return new Response('Download failed',{status:502})}
}
