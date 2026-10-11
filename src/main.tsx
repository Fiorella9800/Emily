import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {createServices} from './services';
import {supabase,initialAuthCallback} from './supabase';
import {readableAuthError,maySetRecoveryPassword,recoveryOwner,rememberRecovery,type RecoveryStatus} from './auth';
import {AuthLayout,Login,PasswordForm} from './auth-ui';
import './app/globals.css';
import './auth.css';
import {PreferencesProvider,usePreferences} from './preferences';
import AccountAccess from './app/account-access';
import './app/navigation.css';
import './app/theme.css';
const Contacts=lazy(()=>import('./app/contacts'));


function App(){
 const {selectOwner,t}=usePreferences();
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(!!supabase),[error,setError]=useState('');
 const [recovery,setRecovery]=useState<RecoveryStatus>(initialAuthCallback.kind==='recovery'?'pending':initialAuthCallback.kind==='error'?'invalid':'none');
 const [passwordSetup,setPasswordSetup]=useState(false),[passwordBusy,setPasswordBusy]=useState(false),[loginMode,setLoginMode]=useState<'login'|'recover'>('login');
 useEffect(()=>selectOwner(session?.user.id??null),[session?.user.id,selectOwner]);
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
    if(!active)return;setError(t("Impossibile verificare la sessione. Riprova."));setLoading(false);
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
 if(loading||recovery==='pending')return <main className="auth-loading" role="status">{recovery==='pending'?t("Verifica del link per la password…"):t("Apertura del tuo spazio Emily…")}</main>;
 if(recovery==='invalid'||(recovery==='verified'&&!maySetRecoveryPassword(recovery,session?.user.id??null)))return <AuthLayout><h2>{t("Richiedi un nuovo link")}</h2><p role="alert">{t(initialAuthCallback.message||'')||t("Il link per la password non è valido o la sessione è scaduta. Puoi richiederne un altro via e-mail.")}</p><button className="primary auth-submit" disabled={passwordBusy} onClick={()=>returnToLogin('recover')}>{t("Richiedi un nuovo link")}</button>{error&&<p className="error" role="alert">{t(error)}</p>}</AuthLayout>;
 if(!session||!services)return <>{error&&<p className="error" role="alert">{t(error)}</p>}<Login key={loginMode} initialMode={loginMode} onRequirePassword={setPasswordSetup}/></>;
 if(recovery==='verified'||passwordSetup)return <AuthLayout><h2>{t("Imposta la tua password")}</h2><p>{t('Account: {email}. Scegli la password per i prossimi accessi. Il tuo profilo e la tua rubrica restano gli stessi.',{email:session.user.email||''})}</p><PasswordForm session={session} onSaved={finishPassword} onBusyChange={setPasswordBusy}/><button className="text-button auth-back" disabled={passwordBusy} onClick={()=>returnToLogin('login')}>{t("Esci e torna all’accesso")}</button></AuthLayout>;
 const token=new URL(window.location.href).searchParams.get('share');
 return <>{error&&<p className="error" role="alert">{t(error)}</p>}<Suspense fallback={<main className="auth-loading" role="status">{t("Apertura della tua rubrica…")}</main>}><Contacts key={session.user.id} services={services} accountLabel={session.user.email||session.user.phone||''} accountAccess={<AccountAccess session={session}/>} initialShare={token&&/^[a-f0-9]{64}$/.test(token)?token:undefined}/></Suspense></>;
}
createRoot(document.getElementById('root')!).render(<PreferencesProvider><App/></PreferencesProvider>);
