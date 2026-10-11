import type {SupabaseClient} from '@supabase/supabase-js';

export type Method='email'|'phone';
export function normalizeIdentifier(method:Method,value:string){
 const cleaned=value.trim();
 if(method==='email'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)||cleaned.length>254)throw Error('Inserisci un indirizzo e-mail valido.');
  return cleaned.toLowerCase();
 }
 const phone=cleaned.replace(/[\s()-]/g,'');
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Inserisci il prefisso internazionale, per esempio +39 333 1234567.');
 return phone;
}
export function readableAuthError(error:{message?:string;code?:string}){
 if(['otp_expired','otp_disabled'].includes(error.code||''))return 'Il codice non è valido o è scaduto. Richiedine uno nuovo.';
 if((error.code||'').includes('rate_limit'))return 'Hai effettuato diversi tentativi. Attendi prima di riprovare.';
 if(error.code==='email_address_not_authorized')return 'L’invio delle e-mail deve essere attivato dal gestore di Emily.';
 if(error.code==='phone_provider_disabled')return 'L’accesso via SMS deve ancora essere attivato.';
 if(error.code==='invalid_credentials')return 'E-mail o password non corrette. Se accedevi con il codice, scegli “Ho già un account senza password”.';
 if(error.code==='email_not_confirmed')return 'Conferma prima l’e-mail con il codice di registrazione.';
 if(error.code==='weak_password')return 'Scegli una password più sicura, con almeno 8 caratteri, lettere, numeri e simboli.';
 if(error.code==='same_password')return 'Scegli una password diversa da quella attuale.';
 if(['reauthentication_needed','reauthentication_not_valid','session_not_found','refresh_token_not_found'].includes(error.code||''))return 'La sessione deve essere verificata di nuovo. Esci e usa “Password dimenticata?” per impostarla tramite e-mail.';
 if(error.code==='user_already_exists')return 'Questo indirizzo ha già un account. Accedi o imposta una password sul tuo account esistente.';
 return error.message||'Accesso non riuscito. Riprova.';
}

export function validateNewPassword(password:string,confirmation:string){
 // Passwords are never trimmed or normalized: spaces can be intentional.
 if(password.length<8)throw Error('Usa almeno 8 caratteri per la password.');
 if(password.length>128)throw Error('Usa al massimo 128 caratteri per la password.');
 if(password!==confirmation)throw Error('Le due password non coincidono.');
}
function validateCode(code:string){
 const token=code.trim();
 if(!/^\d{6,10}$/.test(token))throw Error('Inserisci il codice ricevuto via e-mail.');
 return token;
}

// All credentials go directly to Supabase Auth. No password is written to a
// profile, browser storage, contact record or application log.
export function createAuthActions(auth:SupabaseClient['auth'],redirectTo:string){
 return {
  async login(input:string,password:string){
   const email=normalizeIdentifier('email',input);
   if(!password)throw Error('Inserisci la password.');
   const {data,error}=await auth.signInWithPassword({email,password});
   if(error)throw error;
   if(!data.session)throw Error('Accesso non confermato. Riprova.');
   return data.session;
  },
  async register(input:string,password:string,confirmation:string){
   const email=normalizeIdentifier('email',input);
   validateNewPassword(password,confirmation);
   const {data,error}=await auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
   if(error)throw error;
   return {email,session:data.session};
  },
  async confirmEmail(input:string,code:string){
   const email=normalizeIdentifier('email',input),token=validateCode(code);
   const {data,error}=await auth.verifyOtp({email,token,type:'email'});
   if(error)throw error;
   if(!data.session)throw Error('Accesso non confermato. Richiedi un nuovo codice.');
   return data.session;
  },
  async resendConfirmation(input:string){
   const email=normalizeIdentifier('email',input);
   const {error}=await auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo}});
   if(error)throw error;
  },
  async beginActivation(input:string){
   const email=normalizeIdentifier('email',input);
   const {error}=await auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
   if(error)throw error;
   return email;
  },
  async requestRecovery(input:string){
   const email=normalizeIdentifier('email',input);
   const {error}=await auth.resetPasswordForEmail(email,{redirectTo});
   if(error)throw error;
  },
  async savePassword(userId:string,password:string,confirmation:string,currentPassword?:string){
   validateNewPassword(password,confirmation);
   const {data,error}=await auth.updateUser({password,...(currentPassword?{current_password:currentPassword}:{})});
   if(error)throw error;
   if(!data.user||data.user.id!==userId)throw Error('Impossibile confermare la modifica della password. Accedi di nuovo.');
  }
 };
}

export type AuthCallback={kind:'none'|'recovery'|'error';message?:string};
export function readAuthCallback(href:string):AuthCallback{
 const params=new URLSearchParams(new URL(href).hash.slice(1));
 // Never display a provider's raw URL error (it may contain personal data).
 if(params.has('error')||params.has('error_code')||params.has('error_description'))return {kind:'error',message:'Il link non è valido o è scaduto. Richiedi un nuovo link per la password.'};
 if(params.get('type')!=='recovery')return {kind:'none'};
 if(!params.get('access_token')||!params.get('refresh_token')||!params.get('expires_in')||!params.get('token_type'))return {kind:'error',message:'Il link per la password è incompleto. Richiedine uno nuovo.'};
 return {kind:'recovery'};
}

export type RecoveryStatus='none'|'pending'|'verified'|'invalid';
export function maySetRecoveryPassword(status:RecoveryStatus,sessionUserId:string|null){
 // A stored session alone must not turn an invalid callback into recovery.
 return status==='verified'&&!!sessionUserId;
}

const recoveryKey='emily-password-recovery-user';
export function recoveryOwner(){try{return sessionStorage.getItem(recoveryKey);}catch{return null;}}
export function rememberRecovery(userId:string|null){
 try{if(userId)sessionStorage.setItem(recoveryKey,userId);else sessionStorage.removeItem(recoveryKey);}catch{/* Storage may be unavailable in private browsing. */}
}
