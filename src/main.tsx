import {lazy,Suspense,useEffect,useMemo,useState,type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from './components/ui/dialog';
import {createServices} from './services';
import {supabase,phoneEnabled,initialAuthCallback} from './supabase';
import {normalizeIdentifier,readableAuthError,maySetRecoveryPassword,recoveryOwner,rememberRecovery,type Method,type RecoveryStatus} from './auth';
import {AuthLayout,Login,PasswordForm} from './auth-ui';
import './app/globals.css';
import './auth.css';
const Contacts=lazy(()=>import('./app/contacts'));

function AccountAccess({session}:{session:Session}){
 const [open,setOpen]=useState(false),[section,setSection]=useState<'password'|'link'>('password'),[input,setInput]=useState(''),[sentTo,setSentTo]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[passwordSaved,setPasswordSaved]=useState(false);
 const method:Method=session.user.email?'phone':'email';
 const alreadyLinked=!!session.user.email&&!!session.user.phone;
 async function submit(e:FormEvent){
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
 return <><button onClick={()=>{setOpen(true);setSection('password');setInput('');setSentTo('');setCode('');setError('');setDone(false);setPasswordSaved(false);}}>Gestisci accesso</button>
  <Dialog open={open} onOpenChange={o=>{if(!busy)setOpen(o);}}><DialogContent className="qr-dialog">
   <DialogTitle>Il tuo account Emily</DialogTitle><DialogDescription>Imposta la password per accedere allo stesso profilo e alla tua rubrica.</DialogDescription>
   <p className="photo-tip">E-mail: {session.user.email||'Non collegata'}<br/>Telefono: {session.user.phone||'Non collegato'}</p>
   <div className="auth-tabs" role="group" aria-label="Gestisci accesso"><button className={section==='password'?'active':''} disabled={busy} onClick={()=>setSection('password')}>Imposta password</button><button className={section==='link'?'active':''} disabled={busy} onClick={()=>setSection('link')}>Recapiti</button></div>
   {section==='password'?session.user.email?passwordSaved?<p className="privacy-note" role="status">Password salvata. Dal prossimo accesso usa questa e-mail e la password, senza richiedere un codice.</p>:<PasswordForm session={session} allowCurrentPassword onBusyChange={setBusy} onSaved={()=>setPasswordSaved(true)}/>:<p className="privacy-note">Collega prima l’e-mail nella sezione Recapiti, poi imposta la password.</p>:
    done||alreadyLinked?<p className="privacy-note">{done?'Metodo verificato. Al prossimo accesso potrai usarlo per ritrovare questa rubrica.':'Entrambi i metodi sono collegati al tuo account.'}</p>:method==='phone'&&!phoneEnabled?<p className="privacy-note">Potrai collegare il telefono quando l’accesso via SMS sarà attivato.</p>:
    <form className="fields" onSubmit={submit}><h3>{sentTo?'Verifica il nuovo metodo':method==='phone'?'Collega il telefono':'Collega l’e-mail'}</h3><p className="field-hint">Aggiungilo qui per continuare a usare lo stesso profilo. Un accesso separato con un recapito non collegato crea un altro account.</p><label>{sentTo?'Codice ricevuto su '+sentTo:method==='phone'?'Telefono con prefisso internazionale':'E-mail'}<input required disabled={busy} type={sentTo?'text':method==='phone'?'tel':'email'} inputMode={sentTo?'numeric':undefined} autoComplete={sentTo?'one-time-code':method==='phone'?'tel':'email'} maxLength={sentTo?10:254} value={sentTo?code:input} onChange={e=>sentTo?setCode(e.target.value.replace(/\D/g,'')):setInput(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Verifica in corso…':sentTo?'Verifica e collega':'Ricevi il codice'}</button>{sentTo&&<button className="text-button" type="button" disabled={busy} onClick={()=>{setSentTo('');setCode('');}}>Cambia recapito o richiedi un nuovo codice</button>}</form>}
   {error&&<p className="error" role="alert">{error}</p>}
  </DialogContent></Dialog>
 </>;
}

function App(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(!!supabase),[error,setError]=useState('');
 const [recovery,setRecovery]=useState<RecoveryStatus>(initialAuthCallback.kind==='recovery'?'pending':initialAuthCallback.kind==='error'?'invalid':'none');
 const [passwordSetup,setPasswordSetup]=useState(false),[passwordBusy,setPasswordBusy]=useState(false),[loginMode,setLoginMode]=useState<'login'|'recover'>('login');
 function finishPassword(){rememberRecovery(null);setRecovery('none');setPasswordSetup(false);setError('');}
 useEffect(()=>{
  if(!supabase)return;let active=true;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
   if(!active)return;
   setSession(next);setLoading(false);
   if(event==='PASSWORD_RECOVERY'&&next){rememberRecovery(next.user.id);setRecovery('verified');setError('');}
   else if(event==='SIGNED_OUT'){rememberRecovery(null);setPasswordSetup(false);setRecovery(previous=>previous==='pending'||previous==='invalid'?previous:'none');}
   else if(initialAuthCallback.kind==='none'&&next&&recoveryOwner()===next.user.id)setRecovery('verified');
  });
  (async()=>{
   try{
    const {error:initializationError}=await supabase!.auth.initialize();
    if(!active)return;
    if(initialAuthCallback.kind==='recovery'&&initializationError){rememberRecovery(null);setRecovery('invalid');}
    const {data,error}=await supabase!.auth.getSession();
    if(!active)return;
    if(error)setError(readableAuthError(error));
    setSession(data.session);setLoading(false);
    if(initialAuthCallback.kind==='none'&&data.session&&recoveryOwner()===data.session.user.id)setRecovery('verified');
   }catch{
    if(!active)return;setError('Impossibile verificare la sessione. Riprova.');setLoading(false);
    if(initialAuthCallback.kind==='recovery')setRecovery('invalid');
   }
  })();
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 const services=useMemo(()=>session&&supabase?createServices(supabase,session.user.id,async()=>{const {error}=await supabase!.auth.signOut({scope:'local'});if(error)setError(readableAuthError(error));}):null,[session?.user.id]);
 useEffect(()=>()=>services?.dispose(),[services]);
 async function returnToLogin(mode:'login'|'recover'){
  if(!supabase||passwordBusy)return;
  setPasswordBusy(true);setLoginMode(mode);
  try{
   const {error}=await supabase.auth.signOut({scope:'local'});
   if(error){setError(readableAuthError(error));return;}
   const address=new URL(window.location.href);address.hash='';window.history.replaceState(null,'',address);
   rememberRecovery(null);setSession(null);setRecovery('none');setPasswordSetup(false);setError('');
  }finally{setPasswordBusy(false);}
 }
 if(loading||recovery==='pending')return <main className="auth-loading" role="status">{recovery==='pending'?'Verifica del link per la password…':'Apertura del tuo spazio Emily…'}</main>;
 if(recovery==='invalid'||(recovery==='verified'&&!maySetRecoveryPassword(recovery,session?.user.id??null)))return <AuthLayout><h2>Richiedi un nuovo link</h2><p role="alert">{initialAuthCallback.message||'Il link per la password non è valido o la sessione è scaduta. Puoi richiederne un altro via e-mail.'}</p><button className="primary auth-submit" disabled={passwordBusy} onClick={()=>returnToLogin('recover')}>Richiedi un nuovo link</button>{error&&<p className="error" role="alert">{error}</p>}</AuthLayout>;
 if(!session||!services)return <>{error&&<p className="error" role="alert">{error}</p>}<Login key={loginMode} initialMode={loginMode} onRequirePassword={setPasswordSetup}/></>;
 if(recovery==='verified'||passwordSetup)return <AuthLayout><h2>Imposta la tua password</h2><p>Account: {session.user.email}. Scegli la password per i prossimi accessi. Il tuo profilo e la tua rubrica restano gli stessi.</p><PasswordForm session={session} onSaved={finishPassword} onBusyChange={setPasswordBusy}/><button className="text-button auth-back" disabled={passwordBusy} onClick={()=>returnToLogin('login')}>Esci e torna all’accesso</button></AuthLayout>;
 const token=new URL(window.location.href).searchParams.get('share');
 return <>{error&&<p className="error" role="alert">{error}</p>}<div className="account-strip"><span>Account: {session.user.email||session.user.phone}</span><AccountAccess session={session}/></div><Suspense fallback={<main className="auth-loading" role="status">Apertura della tua rubrica…</main>}><Contacts key={session.user.id} services={services} initialShare={token&&/^[a-f0-9]{64}$/.test(token)?token:undefined}/></Suspense></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
