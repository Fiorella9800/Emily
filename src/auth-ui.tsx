import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {ArrowRight,Eye,EyeOff,LockKeyhole} from 'lucide-react';
import {supabase,phoneEnabled} from './supabase';
import {createAuthActions,normalizeIdentifier,readableAuthError,rememberRecovery} from './auth';
import {appPath} from './routes';
import EmilyBrand from './components/emily-brand';

const redirectTo=window.location.origin+appPath;
const actions=supabase?createAuthActions(supabase.auth,redirectTo):null;
type Mode='login'|'signup'|'activate'|'recover'|'phone';
type PendingCode={email:string;kind:'signup'|'activate'|'phone'};

export function AuthLayout({children}:{children:ReactNode}){
 return <div className="auth-layout"><section className="auth-story"><EmilyBrand/><p className="eyebrow">YOUR PERSONAL NETWORK</p><h1>Le persone giuste.<br/><em>Nel tuo mondo.</em></h1><p>Un volto, una conversazione, una nuova possibilità. Dai un posto alle persone che incontri.</p><div className="auth-private"><LockKeyhole size={17}/> Una rubrica personale, con le tue connessioni.</div></section><main className="auth-panel"><div className="auth-card"><p className="eyebrow">IL TUO SPAZIO EMILY</p>{children}</div></main></div>;
}

function PasswordField({label,value,onChange,disabled,autoComplete='new-password',required=true}:{label:string;value:string;onChange:(value:string)=>void;disabled:boolean;autoComplete?:'new-password'|'current-password';required?:boolean}){
 const [visible,setVisible]=useState(false);
 return <label>{label}<span className="password-field"><input type={visible?'text':'password'} required={required} disabled={disabled} autoComplete={autoComplete} maxLength={128} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" className="password-toggle" aria-label={visible?'Nascondi password':'Mostra password'} aria-pressed={visible} onClick={()=>setVisible(!visible)} disabled={disabled}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>;
}

export function PasswordForm({session,onSaved,onBusyChange,allowCurrentPassword=false}:{session:Session;onSaved:()=>void;onBusyChange?:(busy:boolean)=>void;allowCurrentPassword?:boolean}){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){
  e.preventDefault();if(!actions||busy)return;
  setBusy(true);onBusyChange?.(true);setError('');
  try{
   await actions.savePassword(session.user.id,password,confirmation,currentPassword);
   setPassword('');setConfirmation('');setCurrentPassword('');onSaved();
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);onBusyChange?.(false);}
 }
 return <form className="fields" onSubmit={submit}>
  {allowCurrentPassword&&<details className="password-current"><summary>Hai già una password? Inserisci quella attuale</summary><PasswordField label="Password attuale" value={currentPassword} onChange={setCurrentPassword} disabled={busy} required={false} autoComplete="current-password"/></details>}
  <PasswordField label="Nuova password" value={password} onChange={setPassword} disabled={busy}/>
  <p className="field-hint">Almeno 8 caratteri. Scegli una password unica; puoi usare una frase lunga.</p>
  <PasswordField label="Ripeti la nuova password" value={confirmation} onChange={setConfirmation} disabled={busy}/>
  <button className="primary auth-submit" disabled={busy}>{busy?'Salvataggio in corso…':'Salva password'}<ArrowRight size={17}/></button>
  {error&&<p className="error" role="alert">{error}</p>}
 </form>;
}

export function Login({onRequirePassword,initialMode='login'}:{onRequirePassword:(required:boolean)=>void;initialMode?:Mode}){
 const [mode,setMode]=useState<Mode>(initialMode),[input,setInput]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[pending,setPending]=useState<PendingCode|null>(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recoverySent,setRecoverySent]=useState(false),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const remaining=Math.max(0,Math.ceil((retryAt-now)/1000));
 function change(next:Mode){
  if(busy)return;setMode(next);setPending(null);setCode('');setPassword('');setConfirmation('');setError('');setRecoverySent(false);onRequirePassword(false);
 }
 function sent(email:string,kind:PendingCode['kind']){setPending({email,kind});setCode('');setPassword('');setConfirmation('');setRetryAt(Date.now()+60000);}
 async function submit(e:FormEvent){
  e.preventDefault();if(!actions||!supabase||busy)return;
  if(['activate','recover','phone'].includes(mode)&&remaining)return;
  setBusy(true);setError('');
  try{
   if(mode==='login')await actions.login(input,password);
   else if(mode==='signup'){
    const result=await actions.register(input,password,confirmation);
    if(!result.session)sent(result.email,'signup');
    else{setPassword('');setConfirmation('');}
   }else if(mode==='activate')sent(await actions.beginActivation(input),'activate');
   else if(mode==='recover'){
    await actions.requestRecovery(input);setRecoverySent(true);setRetryAt(Date.now()+60000);
   }else{
    const phone=normalizeIdentifier('phone',input);
    if(!phoneEnabled)throw Error('L’accesso via SMS deve ancora essere attivato.');
    const {error}=await supabase.auth.signInWithOtp({phone,options:{shouldCreateUser:true}});
    if(error)throw error;sent(phone,'phone');
   }
  }catch(e){
   const failure=e as Error&{code?:string};
   if(mode==='login'&&failure.code==='email_not_confirmed'){setPending({email:normalizeIdentifier('email',input),kind:'signup'});setPassword('');}
   setError(readableAuthError(failure));
  }finally{setBusy(false);}
 }
 async function verify(e:FormEvent){
  e.preventDefault();if(!actions||!supabase||!pending||busy)return;
  setBusy(true);setError('');
  // Gate the contact screen before the SDK emits its sign-in event.
  if(pending.kind==='activate')onRequirePassword(true);
  try{
   if(pending.kind==='phone'){
    if(!/^\d{6,10}$/.test(code.trim()))throw Error('Inserisci il codice ricevuto.');
    const {data,error}=await supabase.auth.verifyOtp({phone:pending.email,token:code.trim(),type:'sms'});
    if(error)throw error;if(!data.session)throw Error('Accesso non confermato. Richiedi un nuovo codice.');
   }else{
    const session=await actions.confirmEmail(pending.email,code);
    if(pending.kind==='activate')rememberRecovery(session.user.id);
   }
   setCode('');
  }catch(e){onRequirePassword(false);setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 async function resend(){
  if(!actions||!supabase||!pending||busy||remaining)return;setBusy(true);setError('');
  try{
   if(pending.kind==='signup')await actions.resendConfirmation(pending.email);
   else if(pending.kind==='activate')await actions.beginActivation(pending.email);
   else{const {error}=await supabase.auth.signInWithOtp({phone:pending.email,options:{shouldCreateUser:true}});if(error)throw error;}
   setCode('');setRetryAt(Date.now()+60000);
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 const title=pending?'Conferma il tuo codice':mode==='signup'?'Crea il tuo account':mode==='activate'?'Aggiungi una password':mode==='recover'?'Ritrova il tuo accesso':'Entra nel tuo network';
 const description=pending?`Inserisci il codice inviato a ${pending.email}.`:mode==='signup'?'Scegli la password. Verificheremo la tua e-mail con un codice una sola volta.':mode==='activate'?'Usa l’e-mail del tuo account Emily. Un ultimo codice ti permetterà di creare la password e ritrovare la stessa rubrica.':mode==='recover'?'Ti invieremo un link per scegliere una nuova password.':'Accedi con e-mail e password al tuo spazio personale.';
 return <AuthLayout><h2>{title}</h2><p>{description}</p>
  {!actions?<div className="error" role="status">Il servizio account di Emily non è disponibile.</div>:<>
   {!pending&&['login','signup'].includes(mode)&&<div className="auth-tabs" role="group" aria-label="Accedi o registrati"><button className={mode==='login'?'active':''} disabled={busy} onClick={()=>change('login')}>Accedi</button><button className={mode==='signup'?'active':''} disabled={busy} onClick={()=>change('signup')}>Crea account</button></div>}
   {pending?<form className="fields" onSubmit={verify}>
    <label>Codice di verifica<input autoFocus required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} disabled={busy}/></label>
    <button className="primary auth-submit" disabled={busy}>{busy?'Verifica in corso…':pending.kind==='activate'?'Verifica e imposta la password':'Conferma e accedi'}<ArrowRight size={17}/></button>
    <button className="text-button" type="button" disabled={busy||remaining>0} onClick={resend}>{remaining?`Nuovo codice tra ${remaining}s`:'Invia un nuovo codice'}</button>
    <button className="text-button" type="button" disabled={busy} onClick={()=>change(pending.kind==='signup'?'signup':pending.kind==='activate'?'activate':'phone')}>Cambia indirizzo o torna indietro</button>
    {pending.kind==='signup'&&<p className="auth-note">Hai già un account? Torna ad Accedi o scegli “Ho già un account senza password”.</p>}
   </form>:<form className="fields" onSubmit={submit}>
    <label>{mode==='phone'?'Telefono con prefisso internazionale':'Indirizzo e-mail'}<input required type={mode==='phone'?'tel':'email'} autoComplete={mode==='phone'?'tel':'username'} maxLength={mode==='phone'?30:254} placeholder={mode==='phone'?'+39 333 1234567':'nome@esempio.it'} value={input} onChange={e=>{setInput(e.target.value);setRecoverySent(false);}} disabled={busy}/></label>
    {['login','signup'].includes(mode)&&<PasswordField label="Password" value={password} onChange={setPassword} disabled={busy} autoComplete={mode==='login'?'current-password':'new-password'}/>}
    {mode==='signup'&&<><p className="field-hint">Almeno 8 caratteri. Ti consigliamo una password unica o una frase lunga.</p><PasswordField label="Ripeti la password" value={confirmation} onChange={setConfirmation} disabled={busy}/></>}
    {recoverySent&&<p className="privacy-note" role="status">Se questo indirizzo ha un account Emily, riceverai un’e-mail con il link per impostare la password. Controlla anche la cartella spam.</p>}
    <button className="primary auth-submit" disabled={busy||(['activate','recover','phone'].includes(mode)&&remaining>0)}>{busy?'Operazione in corso…':mode==='login'?'Accedi a Emily':mode==='signup'?'Crea account e ricevi il codice':remaining?`Riprova tra ${remaining}s`:mode==='recover'?'Invia link per la password':'Ricevi il codice'}<ArrowRight size={17}/></button>
   </form>}
   {!pending&&mode==='login'&&<div className="auth-help"><button className="text-button" disabled={busy} onClick={()=>change('recover')}>Password dimenticata?</button><button className="text-button" disabled={busy} onClick={()=>change('activate')}>Ho già un account senza password</button>{phoneEnabled&&<button className="text-button" disabled={busy} onClick={()=>change('phone')}>Accedi con il telefono</button>}</div>}
   {(!['login','signup'].includes(mode)||pending)&&<button className="text-button auth-back" disabled={busy} onClick={()=>change('login')}>Torna ad Accedi</button>}
  </>}
  {error&&<div className="error" role="alert">{error}</div>}
  <p className="auth-note">La tua rubrica è personale. Condividi le schede quando lo decidi tu.</p>
 </AuthLayout>;
}
