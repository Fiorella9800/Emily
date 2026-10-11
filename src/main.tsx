import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {Mail,Phone,ArrowRight,LockKeyhole} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from './components/ui/dialog';
import {createServices} from './services';
import {supabase,phoneEnabled} from './supabase';
import {normalizeIdentifier,readableAuthError,type Method} from './auth';
import './app/globals.css';
import './auth.css';
import {appPath} from './routes';
const Contacts=lazy(()=>import('./app/contacts'));

function AccountAccess({session}:{session:Session}){
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[sentTo,setSentTo]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const method:Method=session.user.email?'phone':'email';
 const alreadyLinked=!!session.user.email&&!!session.user.phone;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');
  try{
   if(sentTo){
    if(!/^\d{6,10}$/.test(code))throw Error('Inserisci il codice ricevuto.');
    const {error}=await supabase.auth.verifyOtp(method==='phone'?{phone:sentTo,token:code,type:'phone_change'}:{email:sentTo,token:code,type:'email_change'});
    if(error)throw error;setDone(true);
   }else{
    const identifier=normalizeIdentifier(method,input);
    if(method==='phone'&&!phoneEnabled)throw Error('L’accesso via SMS deve ancora essere attivato.');
    const {error}=await supabase.auth.updateUser(method==='phone'?{phone:identifier}:{email:identifier});if(error)throw error;setSentTo(identifier);
   }
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 return <><button onClick={()=>{setOpen(true);setInput('');setSentTo('');setCode('');setError('');setDone(false);}}>Gestisci accesso</button><Dialog open={open} onOpenChange={o=>{if(!busy)setOpen(o);}}><DialogContent className="qr-dialog"><DialogTitle>Il tuo account Emily</DialogTitle><DialogDescription>E-mail e telefono possono aprire lo stesso profilo, dopo la verifica.</DialogDescription><p className="photo-tip">E-mail: {session.user.email||'Non collegata'}<br/>Telefono: {session.user.phone||'Non collegato'}</p>{done||alreadyLinked?<p className="privacy-note">{done?'Metodo verificato. Al prossimo accesso potrai usarlo per ritrovare questa rubrica.':'Entrambi i metodi sono collegati al tuo account.'}</p>:method==='phone'&&!phoneEnabled?<p className="privacy-note">Potrai collegare il telefono quando l’accesso via SMS sarà attivato.</p>:<form className="fields" onSubmit={submit}><h3>{sentTo?'Verifica il nuovo metodo':method==='phone'?'Collega il telefono':'Collega l’e-mail'}</h3><p className="field-hint">Aggiungilo qui per continuare a usare lo stesso profilo. Un accesso separato con un recapito non collegato crea un altro account.</p><label>{sentTo?`Codice ricevuto su ${sentTo}`:method==='phone'?'Telefono con prefisso internazionale':'E-mail'}<input required disabled={busy} type={sentTo?'text':method==='phone'?'tel':'email'} inputMode={sentTo?'numeric':undefined} autoComplete={sentTo?'one-time-code':method==='phone'?'tel':'email'} maxLength={sentTo?10:254} value={sentTo?code:input} onChange={e=>sentTo?setCode(e.target.value.replace(/\D/g,'')):setInput(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Verifica in corso…':sentTo?'Verifica e collega':'Ricevi il codice'}</button>{sentTo&&<button className="text-button" type="button" disabled={busy} onClick={()=>{setSentTo('');setCode('');}}>Cambia recapito o richiedi un nuovo codice</button>}</form>}{error&&<p className="error" role="alert">{error}</p>}</DialogContent></Dialog></>;
}

function Login(){
 const [method,setMethod]=useState<Method>('email'),[input,setInput]=useState(''),[sentTo,setSentTo]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 const remaining=Math.max(0,Math.ceil((retryAt-now)/1000));
 async function send(e?:React.FormEvent){
  e?.preventDefault();if(!supabase||busy||remaining)return;
  setBusy(true);setError('');
  try{
   const identifier=normalizeIdentifier(method,sentTo||input);
   if(method==='phone'&&!phoneEnabled)throw Error('L’accesso via SMS deve ancora essere attivato.');
   const {error}=await supabase.auth.signInWithOtp(method==='email'?{email:identifier,options:{shouldCreateUser:true}}:{phone:identifier,options:{shouldCreateUser:true}});
   if(error)throw error;
   setSentTo(identifier);setCode('');setRetryAt(Date.now()+60000);
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 async function verify(e:React.FormEvent){
  e.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');
  try{
   if(!/^\d{6,10}$/.test(code.trim()))throw Error('Inserisci il codice ricevuto.');
   const {data,error}=await supabase.auth.verifyOtp(method==='email'?{email:sentTo,token:code.trim(),type:'email'}:{phone:sentTo,token:code.trim(),type:'sms'});
   if(error)throw error;if(!data.session)throw Error('Accesso non confermato. Richiedi un nuovo codice.');
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 function change(next:Method){if(busy)return;setMethod(next);setInput('');setSentTo('');setCode('');setError('');}
 return <div className="auth-layout"><section className="auth-story"><a href={appPath} className="brand">Emily<span>.</span></a><p className="eyebrow">YOUR PERSONAL NETWORK</p><h1>Le persone giuste.<br/><em>Nel tuo mondo.</em></h1><p>Un volto, una conversazione, una nuova possibilità. Dai un posto alle persone che incontri.</p><div className="auth-private"><LockKeyhole size={17}/> Una rubrica personale, con le tue connessioni.</div></section><main className="auth-panel"><div className="auth-card"><p className="eyebrow">IL TUO SPAZIO EMILY</p><h2>{sentTo?'Controlla il tuo codice':'Entra nel tuo network'}</h2><p>{sentTo?`Abbiamo inviato un codice a ${sentTo}.`:'Accedi o crea il tuo account con un codice. Senza password da ricordare.'}</p>
 {!supabase?<div className="error" role="status">L’accesso sarà disponibile dopo l’attivazione del servizio account di Emily.</div>:<>{!sentTo?<><div className="auth-tabs" role="group" aria-label="Metodo di accesso"><button className={method==='email'?'active':''} onClick={()=>change('email')} disabled={busy}><Mail size={16}/> E-mail</button><button className={method==='phone'?'active':''} onClick={()=>change('phone')} disabled={busy||!phoneEnabled}><Phone size={16}/> Telefono</button></div>{!phoneEnabled&&<p className="auth-note">L’accesso via SMS sarà disponibile prossimamente.</p>}<form className="fields" onSubmit={send}><label>{method==='email'?'Indirizzo e-mail':'Numero di telefono'}<input required type={method==='email'?'email':'tel'} autoComplete={method==='email'?'email':'tel'} maxLength={method==='email'?254:30} placeholder={method==='email'?'nome@esempio.it':'+39 333 1234567'} value={input} onChange={e=>setInput(e.target.value)} disabled={busy}/></label><button className="primary auth-submit" disabled={busy||remaining>0}>{busy?'Invio in corso…':remaining?`Riprova tra ${remaining}s`:'Ricevi il codice'}<ArrowRight size={17}/></button></form></>:<form className="fields" onSubmit={verify}><label>Codice di accesso<input autoFocus required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} disabled={busy}/></label><button className="primary auth-submit" disabled={busy}>{busy?'Verifica in corso…':'Accedi a Emily'}<ArrowRight size={17}/></button><button className="text-button" type="button" disabled={busy||remaining>0} onClick={()=>send()}>{remaining?`Invia un nuovo codice tra ${remaining}s`:'Invia un nuovo codice'}</button><button className="text-button" type="button" disabled={busy} onClick={()=>{setSentTo('');setCode('');setError('');}}>Cambia {method==='email'?'indirizzo e-mail':'numero'}</button></form>}</>}
 {error&&<div className="error" role="alert">{error}</div>}<p className="auth-note">Al primo accesso creiamo il tuo spazio personale. Puoi condividere una scheda quando lo decidi tu.</p></div></main></div>;
}
function App(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(!!supabase),[error,setError]=useState('');
 useEffect(()=>{
  if(!supabase)return;let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false);}});
  supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(readableAuthError(error));setSession(data.session);setLoading(false);}}).catch(()=>{if(active){setError('Impossibile verificare la sessione. Riprova.');setLoading(false);}});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 const services=useMemo(()=>session&&supabase?createServices(supabase,session.user.id,async()=>{const {error}=await supabase!.auth.signOut({scope:'local'});if(error)setError(readableAuthError(error));}):null,[session?.user.id]);
 useEffect(()=>()=>services?.dispose(),[services]);
 if(loading)return <main className="auth-loading" role="status">Apertura del tuo spazio Emily…</main>;
 if(!session||!services)return <>{error&&<p className="error" role="alert">{error}</p>}<Login/></>;
 const token=new URL(window.location.href).searchParams.get('share');
 return <>{error&&<p className="error" role="alert">{error}</p>}<div className="account-strip"><span>Account: {session.user.email||session.user.phone}</span><AccountAccess session={session}/></div><Suspense fallback={<main className="auth-loading" role="status">Apertura della tua rubrica…</main>}><Contacts key={session.user.id} services={services} initialShare={token&&/^[a-f0-9]{64}$/.test(token)?token:undefined}/></Suspense></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
