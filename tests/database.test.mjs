import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

let db;const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
async function user(id,role='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id||''}',false);set role ${role};`);}
async function rpc(name,args=[]){const parameters=args.map((_,i)=>'$'+(i+1)).join(',');const {rows}=await db.query(`select public.${name}(${parameters}) as result`,args);return rows[0].result;}
async function admin(query,params=[]){await db.exec('reset role');return db.query(query,params);}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant usage on schema auth,storage,public to anon,authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 `);
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(migrations)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
 await db.query('insert into auth.users values($1),($2)',[alice,bob]);
});
after(async()=>db?.close());

test('named links are validated, saved and shared without including private context',async()=>{
 await user(alice);
 const saved=await rpc('emily_save_contact',[{first:'Named link',other:'https://example.com/facebook',otherLabel:'  Facebook  ',notes:'Private note'},null,0]);
 const row=(await db.query('select data from emily_contacts where id=$1',[saved.id])).rows[0].data;
 assert.equal(row.otherLabel,'Facebook');
 const pending=await rpc('emily_begin_share',[saved.id,false]);await rpc('emily_publish_share',[pending.token]);
 await user(bob);
 const preview=await rpc('emily_get_share',[pending.token]);assert.equal(preview.person.otherLabel,'Facebook');assert.equal(preview.person.other,'https://example.com/facebook');assert.equal(preview.person.notes,undefined);
 const imported=await rpc('emily_import_share',[pending.token,'']);assert.equal((await db.query('select data from emily_contacts where id=$1',[imported.id])).rows[0].data.otherLabel,'Facebook');await rpc('emily_delete_contact',[imported.id,1]);
 await user(alice);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Too long',otherLabel:'x'.repeat(121)},null,0]),/troppo lungo/);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Wrong type',otherLabel:{label:'Facebook'}},null,0]),/Campo non valido/);
 const legacy=await rpc('emily_save_contact',[{first:'Old card',other:'https://example.com'},null,0]);assert.equal((await db.query('select data from emily_contacts where id=$1',[legacy.id])).rows[0].data.otherLabel,'');
 await rpc('emily_revoke_share',[pending.token]);await rpc('emily_delete_contact',[saved.id,1]);await rpc('emily_delete_contact',[legacy.id,1]);
});

test('anonymous visitors cannot read or mutate contacts or inspect shared data',async()=>{
 await user(null,'anon');
 await assert.rejects(()=>db.query('select * from public.emily_contacts'),/permission denied/);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'No'}]),/permission denied/);
 await assert.rejects(()=>rpc('emily_get_share',['a'.repeat(64)]),/permission denied/);
});

test('signup creates a personal profile; RLS and RPCs isolate contacts and versions',async()=>{
 await user(alice);
 assert.equal((await db.query('select * from emily_profiles')).rows.length,1);
 const created=await rpc('emily_save_contact',[{first:'Giulia',last:'Rossi',notes:'Nota solo mia',usefulness:'Collaborazione',company:'Acme'},null,0]);
 const changed=await rpc('emily_save_contact',[{first:'Giulia',last:'Rossi',notes:'Nota aggiornata'},created.id,1]);
 assert.equal(changed.version,2);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Stale'},created.id,1]),/Aggiorna/);
 await assert.rejects(()=>db.query("update emily_contacts set data='{}'"),/permission denied/);
 await user(bob);
 assert.equal((await db.query('select * from emily_contacts')).rows.length,0);
 await assert.rejects(()=>rpc('emily_delete_contact',[created.id,2]),/non disponibile/);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Attack'},created.id,2]),/non disponibile/);
 await user(alice);await rpc('emily_delete_contact',[created.id,2]);
});

test('profile ownership and personal/private fields are enforced on the server',async()=>{
 await user(alice);
 await rpc('emily_save_profile',[{first:'Fiorella',notes:'Non condividere',usefulness:'Privato',email:'fiorella@example.com'},0]);
 const row=(await db.query('select data,version from emily_profiles')).rows[0];
 assert.equal(row.data.first,'Fiorella');assert.equal(row.data.notes,undefined);assert.equal(row.version,1);
 await assert.rejects(()=>rpc('emily_save_profile',[{first:'Stale'},0]),/Aggiorna/);
 await user(bob);
 const second=(await db.query('select data,version from emily_profiles')).rows[0];
 assert.equal(second.version,0);assert.deepEqual(second.data,{});
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Invalid',linkedin:'javascript:alert(1)'},null,0]),/https/);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Invalid',relations:[{id:alice,label:'wrong'}]},null,0]),/tuoi contatti/);
});

test('private photos cannot be listed, borrowed or overwritten by another account',async()=>{
 const photo='33333333-3333-4333-8333-333333333333';
 await user(alice);
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['emily-photos',alice+'/'+photo]);
 assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await user(bob);
 assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['emily-photos',alice+'/evil']),/row-level security/);
 await assert.rejects(()=>rpc('emily_save_contact',[{first:'Borrowed',photo},null,0]),/Foto non disponibile/);
 await assert.rejects(()=>db.query('update storage.objects set name=$1',['evil']),/permission denied/);
});

test('QR shares contain only essentials; recipients import isolated copies; revoke and expiry work',async()=>{
 await user(alice);
 const saved=await rpc('emily_save_contact',[{first:'Sara',last:'Verdi',email:'sara@example.com',phone:'+393331234567',notes:'Privato',usefulness:'Privato',addressMode:'Lei',sectors:'AI',place:'Evento privato'},null,0]);
 const pending=await rpc('emily_begin_share',[saved.id,false]);
 await user(bob);await assert.rejects(()=>rpc('emily_get_share',[pending.token]),/revocata/);
 await user(alice);await rpc('emily_publish_share',[pending.token]);
 await user(bob);
 assert.equal((await db.query('select * from emily_shares')).rows.length,0);
 const preview=await rpc('emily_get_share',[pending.token]);
 assert.equal(preview.person.email,'sara@example.com');
 for(const key of ['notes','usefulness','addressMode','sectors','place','relations'])assert.equal(preview.person[key],undefined);
 const copy=await rpc('emily_import_share',[pending.token,'']);
 const copied=(await db.query('select data from emily_contacts where id=$1',[copy.id])).rows[0].data;
 assert.equal(copied.notes,'');assert.deepEqual(copied.relations,[]);
 const repeat=await rpc('emily_import_share',[pending.token,'']);assert.equal(repeat.duplicate,true);assert.equal(repeat.id,copy.id);
 await assert.rejects(()=>rpc('emily_revoke_share',[pending.token]),/non disponibile/);
 await user(alice);await rpc('emily_revoke_share',[pending.token]);
 await user(bob);await assert.rejects(()=>rpc('emily_get_share',[pending.token]),/revocata/);
 assert.equal((await db.query('select * from emily_contacts where id=$1',[copy.id])).rows.length,1);
 await user(alice);const expired=await rpc('emily_begin_share',[saved.id,false]);await rpc('emily_publish_share',[expired.token]);
 await admin("update emily_shares set expires=now()-interval '1 day' where token=$1",[expired.token]);
 await user(bob);await assert.rejects(()=>rpc('emily_get_share',[expired.token]),/scaduta/);
});

test('shared photo snapshots stay immutable and imported photos remain private after revocation',async()=>{
 const source='33333333-3333-4333-8333-333333333333',imported='44444444-4444-4444-8444-444444444444';
 await user(alice);const saved=await rpc('emily_save_contact',[{first:'Photo',photo:source},null,0]);
 const pending=await rpc('emily_begin_share',[saved.id,false]);
 await assert.rejects(()=>rpc('emily_publish_share',[pending.token]),/caricamento/);
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['emily-photos','shared/'+pending.token]);
 await rpc('emily_publish_share',[pending.token]);
 await user(bob);
 assert.equal((await db.query('select * from storage.objects where name=$1',['shared/'+pending.token])).rows.length,1);
 assert.equal((await db.query('select * from storage.objects where name=$1',[alice+'/'+source])).rows.length,0);
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['emily-photos','shared/'+pending.token]),/row-level security/);
 // Storage service copy creates an object in the recipient's own folder.
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['emily-photos',bob+'/'+imported]);
 const copy=await rpc('emily_import_share',[pending.token,imported]);
 await user(alice);await rpc('emily_revoke_share',[pending.token]);
 await user(bob);
 assert.equal((await db.query('select * from storage.objects where name=$1',['shared/'+pending.token])).rows.length,0);
 assert.equal((await db.query('select * from storage.objects where name=$1',[bob+'/'+imported])).rows.length,1);
 assert.equal((await db.query('select data from emily_contacts where id=$1',[copy.id])).rows[0].data.photo,imported);
});
