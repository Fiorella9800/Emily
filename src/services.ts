import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {blank,fields,type Person} from './lib/people';
import {url,key} from './supabase';
import type {ContactServices} from './app/contacts';

export function createServices(authClient:SupabaseClient,owner:string,logout:()=>Promise<void>):ContactServices&{dispose:()=>void}{
 // Each storage/database request takes a JWT for this exact account. A session
 // change cannot turn an in-flight editor for Alice into a write for Bob.
 const client=createClient(url,key,{accessToken:async()=>{
  const {data,error}=await authClient.auth.getSession();
  if(error||data.session?.user.id!==owner)throw Error('La sessione è cambiata. Accedi nuovamente.');
  return data.session.access_token;
 }});
 const photos=new Map<string,string>();let disposed=false;
 function check<T>(result:{data:T;error:{message:string}|null}):NonNullable<T>{if(result.error)throw Error(result.error.message);if(disposed)throw Error('Sessione terminata.');if(result.data==null)throw Error('Dati non disponibili. Riprova.');return result.data;}
 async function rpc(name:string,args:Record<string,unknown>={}){return check(await client.rpc(name,args));}
 async function photo(path:string){
  if(photos.has(path))return photos.get(path)!;
  // Keep images in memory only, discard them on logout. No public bucket/URLs.
  const blob=check(await client.storage.from('emily-photos').download(path));
  const object=URL.createObjectURL(blob);if(disposed){URL.revokeObjectURL(object);throw Error('Sessione terminata.');}photos.set(path,object);return object;
 }
 async function loadPhotos(list:Person[]){await Promise.all(list.filter(p=>p.photo).map(p=>photo(owner+'/'+p.photo).catch(()=>'')));}
 async function upload(body:BodyInit|null|undefined){
  if(!(body instanceof Blob)||body.type!=='image/jpeg'||body.size>2*1024*1024)throw Error('Carica una foto JPG fino a 2 MB.');
  const bytes=new Uint8Array(await body.slice(0,3).arrayBuffer());if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Foto JPG non valida.');
  const id=crypto.randomUUID();check(await client.storage.from('emily-photos').upload(owner+'/'+id,body,{contentType:'image/jpeg',upsert:false}));await photo(owner+'/'+id);return {id};
 }
 async function removePhoto(id:string){if(!id)return;const path=owner+'/'+id;check(await client.storage.from('emily-photos').remove([path]));const cached=photos.get(path);if(cached)URL.revokeObjectURL(cached);photos.delete(path);}
 async function getShare(token:string){
  const result=await rpc('emily_get_share',{share_token:token});
  if(result.hasPhoto)await photo('shared/'+token);return result;
 }
 async function request(path:string,options:RequestInit={}){
  if(disposed)throw Error('Sessione terminata.');
  const endpoint=new URL(path,window.location.origin),method=options.method||'GET';
  const p=typeof options.body==='string'?JSON.parse(options.body):{};
  if(endpoint.pathname==='/api/photo'&&method==='POST')return upload(options.body);
  if(endpoint.pathname==='/api/contacts'){
   if(method==='GET'){
    const rows=check(await client.from('emily_contacts').select('id,data,version,updated').eq('owner',owner).order('updated',{ascending:false}));
    const contacts=rows.map(r=>({...blank(),...r.data,id:r.id,version:r.version,updated:r.updated}) as Person);await loadPhotos(contacts);return {contacts};
   }
   if(method==='POST'){const parsed=fields.safeParse(p);if(!parsed.success)throw Error('Controlla i dati della scheda.');return rpc('emily_save_contact',{p:parsed.data,contact_id:p.id||null,expected_version:p.version||0});}
   if(method==='DELETE'){const result=await rpc('emily_delete_contact',{contact_id:p.id,expected_version:p.version});if(result.photo)await removePhoto(result.photo).catch(()=>{});return {ok:true};}
  }
  if(endpoint.pathname==='/api/profile'){
   if(method==='GET'){
    const row=check(await client.from('emily_profiles').select('data,version,updated').eq('owner',owner).maybeSingle());
    const profile={...blank(),...row?.data,version:row?.version||0,updated:row?.updated} as Person;await loadPhotos([profile]);return {profile};
   }
   if(method==='POST'){const parsed=fields.safeParse(p);if(!parsed.success)throw Error('Controlla i dati del profilo.');return rpc('emily_save_profile',{p:parsed.data,expected_version:p.version||0});}
  }
  if(endpoint.pathname==='/api/share'){
   if(method==='GET'){
    const token=endpoint.searchParams.get('token');if(token)return getShare(token);
    const rows=check(await client.from('emily_shares').select('token,data,created,expires').eq('owner',owner).eq('published',true).eq('revoked',false).gt('expires',new Date().toISOString()).order('created',{ascending:false}));
    return {shares:rows.map(s=>({token:s.token,first:s.data.first,last:s.data.last,created:s.created,expires:s.expires}))};
   }
   if(method==='DELETE'){
    const result=await rpc('emily_revoke_share',{share_token:p.token});await client.storage.from('emily-photos').remove(['shared/'+p.token]);
    const cached=photos.get('shared/'+p.token);if(cached)URL.revokeObjectURL(cached);photos.delete('shared/'+p.token);return result;
   }
   if(method==='POST'&&p.action==='import'){
    const preview=await getShare(p.token);if(preview.duplicateId)return {id:preview.duplicateId,duplicate:true};
    let id='';try{
     if(preview.hasPhoto){id=crypto.randomUUID();check(await client.storage.from('emily-photos').copy('shared/'+p.token,owner+'/'+id));}
     const result=await rpc('emily_import_share',{share_token:p.token,imported_photo:id});if(result.duplicate&&id)await removePhoto(id).catch(()=>{});return result;
    }catch(e){if(id)await removePhoto(id).catch(()=>{});throw e;}
   }
   if(method==='POST'){
    const pending=await rpc('emily_begin_share',{contact_id:p.id||null,own_profile:!!p.profile});
    try{
     if(pending.photo)check(await client.storage.from('emily-photos').copy(owner+'/'+pending.photo,'shared/'+pending.token));
     const result=await rpc('emily_publish_share',{share_token:pending.token});if(result.hasPhoto)await photo('shared/'+pending.token);return result;
    }catch(e){await rpc('emily_revoke_share',{share_token:pending.token}).catch(()=>{});await client.storage.from('emily-photos').remove(['shared/'+pending.token]);throw e;}
   }
  }
  throw Error('Operazione non disponibile.');
 }
 function dispose(){disposed=true;photos.forEach(u=>URL.revokeObjectURL(u));photos.clear();}
 return {request,photoUrl:p=>photos.get(owner+'/'+p.photo)||'',sharedPhotoUrl:t=>photos.get('shared/'+t)||'',logout:()=>{dispose();void logout();},dispose};
}
