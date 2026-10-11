import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createAuthActions,readAuthCallback,maySetRecoveryPassword,validateNewPassword} from '../src/auth.ts';

const redirect='https://fiorella9800.github.io/Emily/';
const uid='11111111-1111-4111-8111-111111111111';
const email='fiorella@example.com';
const password='Una frase di prova 42!';
const user={id:uid,email,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-11T00:00:00Z',created_at:'2026-10-11T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const jwt=()=>[{}, {sub:uid,exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session=()=>({access_token:jwt(),refresh_token:'test-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user});
let sequence=0;
function fixture({failPath,failCode='invalid_credentials',browser=false,storedSession=null}={}){
 const calls=[],values=new Map(),storageKey='emily-auth-test-'+(++sequence);
 if(storedSession)values.set(storageKey,JSON.stringify(storedSession));
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const client=createClient('https://auth-test.supabase.co','test-public-key',{
  auth:{storageKey,storage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:browser,flowType:'implicit'},
  global:{fetch:async(url,init)=>{
   const address=new URL(url),method=init?.method??'GET',body=init?.body?JSON.parse(init.body):null;
   calls.push({address,method,body});
   if(address.pathname.endsWith(failPath||'/never-fail'))return new Response(JSON.stringify({code:failCode,msg:'Rejected test request'}),{status:400,headers:{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}});
   const path=address.pathname.split('/').at(-1);
   const response=path==='signup'?{...user,email_confirmed_at:undefined}:path==='token'||path==='verify'?session():path==='user'?user:{};
   return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
  }}
 });
 return {client,actions:createAuthActions(client.auth,redirect),calls,values};
}

test('normal login uses the password grant and sends no OTP; credentials are not saved in application storage',async()=>{
 const f=fixture();
 try{
  const loggedIn=await f.actions.login(' FIORELLA@EXAMPLE.COM ',password);
  assert.equal(loggedIn.user.id,uid);
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].address.pathname,'/auth/v1/token');
  assert.equal(f.calls[0].address.searchParams.get('grant_type'),'password');
  assert.equal(f.calls[0].body.email,email);
  assert.equal(f.calls[0].body.password,password);
  assert.ok(![...f.values.values()].join('').includes(password));
 }finally{await f.client.auth.dispose();}
});

test('signup chooses a password but produces no session before email confirmation; resend preserves the password',async()=>{
 const f=fixture();
 try{
  const registered=await f.actions.register(email,password,password);
  assert.equal(registered.session,null);
  assert.equal((await f.client.auth.getSession()).data.session,null);
  await f.actions.resendConfirmation(email);
  assert.equal(f.calls[1].address.pathname,'/auth/v1/resend');
  assert.equal(f.calls[1].body.type,'signup');
  assert.equal(f.calls[1].body.password,undefined);
  assert.equal(f.calls[0].address.searchParams.get('redirect_to'),redirect);
  const verified=await f.actions.confirmEmail(email,'123456');
  assert.equal(verified.user.id,uid);
  assert.equal(f.calls[2].body.type,'email');
  assert.equal(f.calls[2].body.token,'123456');
 }finally{await f.client.auth.dispose();}
});

test('existing OTP users can create a password on the same account; activation does not create another user',async()=>{
 const f=fixture();
 try{
  await f.actions.beginActivation(email);
  assert.equal(f.calls[0].body.create_user,false);
  await f.actions.confirmEmail(email,'123456');
  await f.actions.savePassword(uid,password,password);
  const update=f.calls.find(call=>call.method==='PUT');
  assert.equal(update.address.pathname,'/auth/v1/user');
  assert.equal(update.body.password,password);
  assert.equal(update.body.email,undefined);
  assert.equal(update.body.data,undefined);
  assert.equal((await f.client.auth.getSession()).data.session.user.id,uid);
  assert.ok(!f.calls.some(call=>call.address.pathname.includes('/signup')));
  assert.ok(![...f.values.values()].join('').includes(password));
 }finally{await f.client.auth.dispose();}
});

test('password recovery uses the exact allowed root redirect and never creates an account',async()=>{
 const f=fixture();
 try{
  await f.actions.requestRecovery(email);
  assert.equal(f.calls[0].address.pathname,'/auth/v1/recover');
  assert.equal(f.calls[0].address.searchParams.get('redirect_to'),redirect);
  assert.equal((await f.client.auth.getSession()).data.session,null);
 }finally{await f.client.auth.dispose();}
});

test('wrong passwords and expired codes cannot create a session; mismatches stop before an API request',async()=>{
 for(const [failPath,failCode,operation] of [['/token','invalid_credentials',f=>f.actions.login(email,password)],['/verify','otp_expired',f=>f.actions.confirmEmail(email,'123456')]]){
  const f=fixture({failPath,failCode});
  try{
   await assert.rejects(()=>operation(f),error=>error.code===failCode);
   assert.equal((await f.client.auth.getSession()).data.session,null);
  }finally{await f.client.auth.dispose();}
 }
 const f=fixture();
 try{
  await assert.rejects(()=>f.actions.register(email,password,'different'),/coincidono/);
  await assert.rejects(()=>f.actions.confirmEmail(email,'not-a-code'),/codice/);
  assert.equal(f.calls.length,0);
  assert.throws(()=>validateNewPassword('short','short'),/8 caratteri/);
  assert.doesNotThrow(()=>validateNewPassword('  passphrase  ','  passphrase  '));
 }finally{await f.client.auth.dispose();}
});

test('callback errors are safe to display and stored sessions never authorize an invalid recovery link',()=>{
 assert.equal(readAuthCallback(redirect+'?share=abc').kind,'none');
 assert.equal(readAuthCallback(redirect+'#type=recovery').kind,'error');
 const error=readAuthCallback(redirect+'#error=access_denied&error_description=private-provider-detail');
 assert.equal(error.kind,'error');assert.ok(!error.message.includes('private-provider-detail'));
 assert.equal(maySetRecoveryPassword('pending',uid),false);
 assert.equal(maySetRecoveryPassword('invalid',uid),false);
 assert.equal(maySetRecoveryPassword('verified',null),false);
 assert.equal(maySetRecoveryPassword('verified',uid),true);
});

test('real SDK validates recovery callbacks, removes URL tokens and emits PASSWORD_RECOVERY; expired callbacks do not',async()=>{
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const valid=session();
 const fragment=new URLSearchParams({type:'recovery',access_token:valid.access_token,refresh_token:valid.refresh_token,expires_in:'3600',token_type:'bearer'});
 let f;
 try{
  globalThis.window={location:new URL(redirect+'#'+fragment),addEventListener(){},removeEventListener(){}};
  globalThis.document={visibilityState:'visible'};
  assert.equal(readAuthCallback(window.location.href).kind,'recovery');
  f=fixture({browser:true});
  const events=[];
  const recovered=new Promise(resolve=>f.client.auth.onAuthStateChange((event,next)=>{events.push(event);if(event==='PASSWORD_RECOVERY')resolve(next);}));
  const {error}=await f.client.auth.initialize();assert.equal(error,null);
  const confirmed=await Promise.race([recovered,new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing recovery event')),1000))]);
  assert.equal(confirmed.user.id,uid);assert.equal(window.location.hash,'');
  assert.ok(events.includes('PASSWORD_RECOVERY'));
  await f.client.auth.dispose();
  // The SDK intentionally preserves an old login when a callback fails.
  // The app must still block the recovery password form for that callback.
  globalThis.window.location=new URL(redirect+'#error=access_denied&error_code=otp_expired');
  f=fixture({browser:true,storedSession:valid});
  const failedEvents=[];
  f.client.auth.onAuthStateChange(event=>failedEvents.push(event));
  assert.ok((await f.client.auth.initialize()).error);
  assert.equal((await f.client.auth.getSession()).data.session.user.id,uid);
  assert.ok(!failedEvents.includes('PASSWORD_RECOVERY'));
  assert.equal(maySetRecoveryPassword('invalid',uid),false);
 }finally{
  await f?.client.auth.dispose();
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
});
