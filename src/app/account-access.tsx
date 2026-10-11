import {usePreferences} from '@/preferences';
import {useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {LockKeyhole} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {supabase,phoneEnabled} from '@/supabase';
import {normalizeIdentifier,readableAuthError,type Method} from '@/auth';
import {PasswordForm} from '@/auth-ui';

export default function AccountAccess({session}:{session:Session}){
 const {t}=usePreferences();
 const [open,setOpen]=useState(false),[section,setSection]=useState<'password'|'link'>('password'),[input,setInput]=useState(''),[sentTo,setSentTo]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[passwordSaved,setPasswordSaved]=useState(false);
 const method:Method=session.user.email?'phone':'email';
 const alreadyLinked=!!session.user.email&&!!session.user.phone;
 async function submit(e:FormEvent){
  e.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');
  try{
   if(sentTo){
    if(!/^\d{6,10}$/.test(code))throw Error(t("Inserisci il codice ricevuto."));
    const {error}=await supabase.auth.verifyOtp(method==='phone'?{phone:sentTo,token:code,type:'phone_change'}:{email:sentTo,token:code,type:'email_change'});
    if(error)throw error;setDone(true);
   }else{
    const identifier=normalizeIdentifier(method,input);
    if(method==='phone'&&!phoneEnabled)throw Error(t("L’accesso via SMS deve ancora essere attivato."));
    const {error}=await supabase.auth.updateUser(method==='phone'?{phone:identifier}:{email:identifier});if(error)throw error;setSentTo(identifier);
   }
  }catch(e){setError(readableAuthError(e as Error));}finally{setBusy(false);}
 }
 return <><button type="button" className="secondary" onClick={()=>{setOpen(true);setSection('password');setInput('');setSentTo('');setCode('');setError('');setDone(false);setPasswordSaved(false);}}><LockKeyhole size={16} aria-hidden="true"/> {t("Gestisci accesso")}</button>
  <Dialog open={open} onOpenChange={o=>{if(!busy)setOpen(o);}}><DialogContent className="qr-dialog">
   <DialogTitle>{t("Il tuo account Emily")}</DialogTitle><DialogDescription>{t("Imposta la password per accedere allo stesso profilo e alla tua rubrica.")}</DialogDescription>
   <p className="photo-tip">{t("E-mail:")} {session.user.email||t("Non collegata")}<br/>{t("Telefono:")} {session.user.phone||t("Non collegato")}</p>
   <div className="auth-tabs" role="group" aria-label={t("Gestisci accesso")}><button className={section==='password'?'active':''} disabled={busy} onClick={()=>setSection('password')}>{t("Imposta password")}</button><button className={section==='link'?'active':''} disabled={busy} onClick={()=>setSection('link')}>{t("Recapiti")}</button></div>
   {section==='password'?session.user.email?passwordSaved?<p className="privacy-note" role="status">{t("Password salvata. Dal prossimo accesso usa questa e-mail e la password, senza richiedere un codice.")}</p>:<PasswordForm session={session} allowCurrentPassword onBusyChange={setBusy} onSaved={()=>setPasswordSaved(true)}/>:<p className="privacy-note">{t("Collega prima l’e-mail nella sezione Recapiti, poi imposta la password.")}</p>:
    done||alreadyLinked?<p className="privacy-note">{done?t("Metodo verificato. Al prossimo accesso potrai usarlo per ritrovare questa rubrica."):t("Entrambi i metodi sono collegati al tuo account.")}</p>:method==='phone'&&!phoneEnabled?<p className="privacy-note">{t("Potrai collegare il telefono quando l’accesso via SMS sarà attivato.")}</p>:
    <form className="fields" onSubmit={submit}><h3>{sentTo?t("Verifica il nuovo metodo"):method==='phone'?t("Collega il telefono"):t("Collega l’e-mail")}</h3><p className="field-hint">{t("Aggiungilo qui per continuare a usare lo stesso profilo. Un accesso separato con un recapito non collegato crea un altro account.")}</p><label>{sentTo?t("Codice ricevuto su ")+sentTo:method==='phone'?t("Telefono con prefisso internazionale"):t("E-mail")}<input required disabled={busy} type={sentTo?'text':method==='phone'?'tel':'email'} inputMode={sentTo?'numeric':undefined} autoComplete={sentTo?'one-time-code':method==='phone'?'tel':'email'} maxLength={sentTo?10:254} value={sentTo?code:input} onChange={e=>sentTo?setCode(e.target.value.replace(/\D/g,'')):setInput(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?t("Verifica in corso…"):sentTo?t("Verifica e collega"):t("Ricevi il codice")}</button>{sentTo&&<button className="text-button" type="button" disabled={busy} onClick={()=>{setSentTo('');setCode('');}}>{t("Cambia recapito o richiedi un nuovo codice")}</button>}</form>}
   {error&&<p className="error" role="alert">{t(error)}</p>}
  </DialogContent></Dialog>
 </>;
}

