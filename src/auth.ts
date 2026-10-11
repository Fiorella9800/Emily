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
 return error.message||'Accesso non riuscito. Riprova.';
}
