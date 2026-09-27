import {NextRequest} from 'next/server';
const unavailable = () => Response.json({detail:'Server comparisons are not available yet. You can still explore the examples.'},{status:503,headers:{'Cache-Control':'no-store'}});
async function proxy(request:NextRequest,{params}:{params:Promise<{path:string[]}>}) {
 const path=(await params).path.join('/');
 if(!['session','auth/code','auth/verify','auth/logout','compare'].includes(path))return new Response(null,{status:404});
 if((request.method==='GET')!==(path==='session'))return new Response(null,{status:405});
 const base=process.env.CRASDI_API_URL,key=process.env.CRASDI_API_KEY;
 if(!base||!key){if(path==='session')return Response.json({available:false,verified:false,dailyLimit:20,remaining:20},{headers:{'Cache-Control':'no-store'}});return unavailable();}
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
 const headers=new Headers({'x-api-key':key,'content-type':'application/json','x-playground-client-ip':request.headers.get('cf-connecting-ip')||'unknown'});
 const cookie=request.cookies.get('__Host-playground');if(cookie)headers.set('cookie',`__Host-playground=${cookie.value}`);
 try {
  let body:Uint8Array|undefined;
  if(request.method==='POST'){
   const limit=path==='compare'?6*1024*1024:4096;
   if(Number(request.headers.get('content-length'))>limit)return new Response(null,{status:413});
   const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
   if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return Response.json({detail:'Request is too large.'},{status:413});}chunks.push(value);}}
   body=new Uint8Array(size);let at=0;for(const chunk of chunks){body.set(chunk,at);at+=chunk.length;}
  }
  const response=await fetch(`${base.replace(/\/$/,'')}/${path}`,{method:request.method,headers,body:body as BodyInit,redirect:'error',signal:AbortSignal.timeout(path==='compare'?140000:25000)});
  const out=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
  for(const name of ['set-cookie','retry-after']){const value=response.headers.get(name);if(value)out.set(name,value);}
  return new Response(response.body,{status:response.status,headers:out});
 }catch{return unavailable();}
}
export {proxy as GET,proxy as POST};
