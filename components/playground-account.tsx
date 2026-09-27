'use client';
import {useCallback,useEffect,useState} from 'react';
import {InputOTP,InputOTPGroup,InputOTPSlot} from '@/components/ui/input-otp';
export type Account={available:boolean;verified:boolean;email?:string;remaining:number;dailyLimit:number};
export async function playgroundRequest<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(`/api/playground/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(path==='compare'?145000:30000)});
 const data=await response.json().catch(()=>({detail:'The service could not complete this request.'})) as {detail?:string};
 if(!response.ok)throw Error(data.detail||'Please try again later.');
 return data as T;
}
export function usePlaygroundAccount(){
 const [account,setAccount]=useState<Account|null>(null);
 const refresh=useCallback(async()=>{try{setAccount(await playgroundRequest<Account>('session'))}catch{setAccount({available:false,verified:false,remaining:0,dailyLimit:20})}},[]);
 useEffect(()=>{void refresh()},[refresh]);
 return {account,setAccount,refresh};
}
export function PlaygroundAccount({account,onChange,disabled}:{account:Account|null;onChange:(a:Account)=>void;disabled:boolean}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[working,setWorking]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(!cooldown)return;const t=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(t)},[cooldown]);
 async function send(){setWorking(true);setError('');try{const r=await playgroundRequest<{message:string}>('auth/code',{email});setSent(true);setCode('');setMessage(r.message);setCooldown(60)}catch(e){setError(e instanceof Error?e.message:'Could not send code.')}finally{setWorking(false)}}
 async function verify(){setWorking(true);setError('');try{onChange(await playgroundRequest<Account>('auth/verify',{email,code}));setCode('');setMessage('')}catch(e){setError(e instanceof Error?e.message:'Could not verify code.')}finally{setWorking(false)}}
 async function logout(){setWorking(true);setError('');try{await playgroundRequest('auth/logout',{});onChange({...account!,verified:false,email:undefined});setSent(false);setCode('');setMessage('')}catch{setError('Could not sign out. Please try again.')}finally{setWorking(false)}}
 return <section className="account-panel" aria-label="Playground access">
 {!account?<p role="status">Checking playground availability…</p>:!account.available?<><h3>Try the examples while the server is being connected.</h3><p>Custom comparisons will use email verification, with up to {account.dailyLimit} runs per day. Email sign-in and uploads to the server are not available yet.</p></>:account.verified?<><div className="account-heading"><div><h3>You’re signed in</h3><p>{account.email}</p></div><button className="text-link" disabled={disabled||working} onClick={logout}>Sign out</button></div><p><strong>{account.remaining} of {account.dailyLimit} runs remaining today.</strong> Your allowance resets at midnight UTC. Failed or timed-out calculations count toward it.</p></>:<><h3>Verify your email to compare your maps.</h3><p>No password needed. Up to {account.dailyLimit} runs per day; examples are always available without signing in.</p><form onSubmit={e=>{e.preventDefault();void(sent?verify():send())}}><label htmlFor="playground-email">Email address</label><div className="account-email"><input id="playground-email" type="email" autoComplete="email" required maxLength={254} className="number-input" value={email} disabled={working||sent} onChange={e=>setEmail(e.target.value)}/>{!sent&&<button className="button secondary" disabled={working||!email}>{working?'Sending…':'Send code'}</button>}</div>{sent&&<><label htmlFor="playground-code">Six-digit code</label><div className="account-code"><InputOTP id="playground-code" maxLength={6} pattern="[0-9]*" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} disabled={working}><InputOTPGroup>{Array.from({length:6},(_,i)=><InputOTPSlot key={i} index={i}/>)}</InputOTPGroup></InputOTP><button className="button" disabled={working||code.length!==6}>{working?'Verifying…':'Verify email'}</button></div><div className="account-links"><button type="button" disabled={working||cooldown>0} onClick={send}>{cooldown?`Resend in ${cooldown}s`:'Resend code'}</button><button type="button" disabled={working} onClick={()=>{setSent(false);setCode('');setMessage('');setError('')}}>Use another email</button></div></>}</form><p className="account-privacy">We use your email for sign-in and usage limits. Codes expire after 10 minutes; sign-in lasts up to 7 days. No mailing list.</p></>}
 {message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </section>
}
