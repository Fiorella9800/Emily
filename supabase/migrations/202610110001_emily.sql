create schema emily_private;
revoke all on schema emily_private from public, anon;
grant usage on schema emily_private to authenticated;
-- Apply to a NEW Supabase project. Existing Sites D1/R2 data is not modified.
create table public.emily_contacts (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, version integer not null default 1,
 updated timestamptz not null default now()
);
create index emily_contacts_owner on public.emily_contacts(owner);
create table public.emily_profiles (
 owner uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb, version integer not null default 0,
 updated timestamptz not null default now()
);
create table public.emily_shares (
 token text primary key check(token ~ '^[a-f0-9]{64}$'),
 owner uuid not null references auth.users(id) on delete cascade,
 data jsonb not null, source_photo text not null default '',
 has_photo boolean not null default false, published boolean not null default false,
 created timestamptz not null default now(), expires timestamptz not null default now()+interval '30 days',
 revoked boolean not null default false
);
create index emily_shares_owner on public.emily_shares(owner);
alter table public.emily_contacts enable row level security;
alter table public.emily_profiles enable row level security;
alter table public.emily_shares enable row level security;
revoke all on public.emily_contacts,public.emily_profiles,public.emily_shares from anon,authenticated;
grant select on public.emily_contacts,public.emily_profiles,public.emily_shares to authenticated;
create policy emily_contacts_read on public.emily_contacts for select to authenticated using(owner=(select auth.uid()));
create policy emily_profiles_read on public.emily_profiles for select to authenticated using(owner=(select auth.uid()));
create policy emily_shares_read on public.emily_shares for select to authenticated using(owner=(select auth.uid()));

create function emily_private.emily_basic(p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('first',coalesce(p->>'first',''),'last',coalesce(p->>'last',''),'role',coalesce(p->>'role',''),'company',coalesce(p->>'company',''),'phone',coalesce(p->>'phone',''),'email',coalesce(p->>'email',''),'city',coalesce(p->>'city',''),'country',coalesce(p->>'country',''),'linkedin',coalesce(p->>'linkedin',''),'instagram',coalesce(p->>'instagram',''),'other',coalesce(p->>'other',''),'photo',coalesce(p->>'photo',''));
$$;
-- Validate and canonicalize on the server; client-side validation is supplementary.
create function emily_private.emily_validate(p jsonb, only_basic boolean default false) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare result jsonb; k text; maxlen integer; val text; rel jsonb;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>50000 then raise exception 'Scheda non valida.'; end if;
 for k,maxlen in select * from (values ('first',120),('last',120),('role',300),('company',300),('phone',100),('email',254),('city',200),('country',200),('linkedin',2000),('instagram',2000),('other',2000),('photo',100),('place',500),('date',10),('notes',10000),('usefulness',5000),('addressMode',3),('sectors',1000)) f(key,lim) loop
  if p ? k and jsonb_typeof(p->k) <> 'string' then raise exception 'Campo non valido: %',k; end if;
  val=btrim(coalesce(p->>k,''));
  if length(val)>maxlen then raise exception 'Campo troppo lungo: %',k; end if;
  p=jsonb_set(p,array[k],to_jsonb(val));
 end loop;
 if p->>'first'='' then raise exception 'Aggiungi il nome.'; end if;
 if p->>'email'<>'' and p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail non valida.'; end if;
 foreach k in array array['linkedin','instagram','other'] loop
  if p->>k<>'' and p->>k !~* '^https?://' then raise exception 'Usa link completi https://'; end if;
 end loop;
 if p->>'addressMode' not in ('','Tu','Lei') then raise exception 'Scegli Tu o Lei.'; end if;
 if p->>'photo'<>'' then
  if p->>'photo' !~ '^[a-f0-9-]{36}$' or not exists(select 1 from storage.objects where bucket_id='emily-photos' and name=auth.uid()::text||'/'||(p->>'photo')) then raise exception 'Foto non disponibile nel tuo account.'; end if;
 end if;
 result=emily_private.emily_basic(p);
 if only_basic then return result; end if;
 if p ? 'relations' then
  if jsonb_typeof(p->'relations')<>'array' then raise exception 'Collegamenti non validi.'; end if;
  if jsonb_array_length(p->'relations')>100 then raise exception 'Troppi collegamenti.'; end if;
 else p=jsonb_set(p,'{relations}','[]'::jsonb); end if;
 for rel in select value from jsonb_array_elements(p->'relations') loop
  if jsonb_typeof(rel)<>'object' or coalesce(rel->>'id','') !~ '^[a-f0-9-]{36}$' or jsonb_typeof(rel->'label') is distinct from 'string' or length(btrim(rel->>'label')) not between 1 and 120 then raise exception 'Collegamento non valido.'; end if;
  if not exists(select 1 from public.emily_contacts where id=(rel->>'id')::uuid and owner=auth.uid()) then raise exception 'Puoi collegare soltanto i tuoi contatti.'; end if;
 end loop;
 return result||jsonb_build_object('place',p->>'place','date',p->>'date','notes',p->>'notes','usefulness',p->>'usefulness','addressMode',p->>'addressMode','sectors',p->>'sectors','relations',p->'relations');
end $$;

create function emily_private.emily_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.emily_profiles(owner) values(new.id);return new;end $$;
create trigger emily_user_created after insert on auth.users for each row execute function emily_private.emily_new_user();
insert into public.emily_profiles(owner) select id from auth.users on conflict do nothing;

create function emily_private.emily_save_contact(p jsonb, contact_id uuid default null, expected_version integer default 0) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare saved public.emily_contacts; canonical jsonb;
begin
 canonical=emily_private.emily_validate(p);
 if contact_id is null then
  insert into public.emily_contacts(owner,data) values(auth.uid(),canonical) returning * into saved;
 else
  if exists(select 1 from jsonb_array_elements(canonical->'relations') r where r->>'id'=contact_id::text) then raise exception 'Non puoi collegare una persona a se stessa.'; end if;
  update public.emily_contacts set data=canonical,version=version+1,updated=now() where id=contact_id and owner=auth.uid() and version=expected_version returning * into saved;
  if saved.id is null then raise exception 'Scheda modificata o non disponibile. Aggiorna la rubrica prima di salvare.'; end if;
 end if;
 return jsonb_build_object('id',saved.id,'version',saved.version);
end $$;
create function emily_private.emily_delete_contact(contact_id uuid,expected_version integer) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare deleted public.emily_contacts;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 delete from public.emily_contacts where id=contact_id and owner=auth.uid() and version=expected_version returning * into deleted;
 if deleted.id is null then raise exception 'Scheda modificata o non disponibile. Aggiorna la rubrica.'; end if;
 return jsonb_build_object('photo',deleted.data->>'photo');
end $$;
create function emily_private.emily_save_profile(p jsonb,expected_version integer default 0) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare saved public.emily_profiles;canonical jsonb;
begin
 canonical=emily_private.emily_validate(p,true);
 insert into public.emily_profiles(owner) values(auth.uid()) on conflict do nothing;
 update public.emily_profiles set data=canonical,version=version+1,updated=now() where owner=auth.uid() and version=expected_version returning * into saved;
 if saved.owner is null then raise exception 'Profilo modificato. Aggiorna prima di salvare.'; end if;
 return jsonb_build_object('version',saved.version);
end $$;

create function emily_private.emily_begin_share(contact_id uuid default null,own_profile boolean default false) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare p jsonb;t text;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 -- Serialize share creation for this account, including pending shares.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.emily_shares where owner=auth.uid() and not revoked and expires>now())>=100 then raise exception 'Revoca una condivisione prima di crearne un’altra.'; end if;
 if own_profile then select data into p from public.emily_profiles where owner=auth.uid() and version>0;
 else select data into p from public.emily_contacts where id=contact_id and owner=auth.uid();end if;
 if p is null then raise exception 'Salva prima il profilo o la scheda.'; end if;
 t=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.emily_shares(token,owner,data,source_photo) values(t,auth.uid(),jsonb_set(emily_private.emily_basic(p),'{photo}','""'),coalesce(p->>'photo',''));
 return jsonb_build_object('token',t,'photo',p->>'photo');
end $$;
create function emily_private.emily_publish_share(share_token text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare s public.emily_shares;
begin
 select * into s from public.emily_shares where token=share_token and owner=auth.uid() and not revoked and not published and expires>now() for update;
 if s.token is null then raise exception 'Condivisione non disponibile.'; end if;
 if s.source_photo<>'' and not exists(select 1 from storage.objects where bucket_id='emily-photos' and name='shared/'||s.token) then raise exception 'Attendi il caricamento della foto.';end if;
 update public.emily_shares set published=true,has_photo=(source_photo<>'') where token=share_token;
 return jsonb_build_object('token',s.token,'person',s.data,'expires',s.expires,'hasPhoto',s.source_photo<>'');
end $$;
create function emily_private.emily_get_share(share_token text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare s public.emily_shares;duplicate_id uuid;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 select * into s from public.emily_shares where token=share_token and published and not revoked and expires>now();
 if s.token is null then raise exception 'La condivisione è scaduta o è stata revocata.'; end if;
 select id into duplicate_id from public.emily_contacts where owner=auth.uid() and (
 (s.data->>'email'<>'' and lower(data->>'email')=lower(s.data->>'email')) or
 (s.data->>'linkedin'<>'' and data->>'linkedin'=s.data->>'linkedin') or
 (s.data->>'email'='' and s.data->>'linkedin'='' and lower(data->>'first')=lower(s.data->>'first') and lower(data->>'last')=lower(s.data->>'last') and lower(data->>'company')=lower(s.data->>'company'))
 ) limit 1;
 return jsonb_build_object('person',s.data,'expires',s.expires,'hasPhoto',s.has_photo,'duplicateId',duplicate_id);
end $$;
create function emily_private.emily_import_share(share_token text,imported_photo text default '') returns jsonb
 language plpgsql security definer set search_path='' as $$
declare preview jsonb;p jsonb;new_id uuid;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 preview=emily_private.emily_get_share(share_token);
 if preview->>'duplicateId' is not null then return jsonb_build_object('id',preview->>'duplicateId','duplicate',true);end if;
 p=preview->'person';p=jsonb_set(p,'{photo}',to_jsonb(imported_photo));
 p=emily_private.emily_validate(p);
 insert into public.emily_contacts(owner,data) values(auth.uid(),p) returning id into new_id;
 return jsonb_build_object('id',new_id,'duplicate',false);
end $$;
create function emily_private.emily_revoke_share(share_token text) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 update public.emily_shares set revoked=true where token=share_token and owner=auth.uid();
 if not found then raise exception 'Condivisione non disponibile.'; end if;
 return jsonb_build_object('ok',true);
end $$;

-- Shared snapshots are private objects accessible only to signed-in recipients
-- possessing a random token. Owner pictures cannot be listed by other users.
create function emily_private.emily_shared_photo_read(object_name text) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.emily_shares where left(object_name,7)='shared/' and token=substring(object_name from 8) and published and has_photo and not revoked and expires>now());
$$;
create function emily_private.emily_shared_photo_write(object_name text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.emily_shares where left(object_name,7)='shared/' and token=substring(object_name from 8) and owner=auth.uid() and not published and not revoked and expires>now());
$$;
create function emily_private.emily_shared_photo_owner(object_name text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.emily_shares where left(object_name,7)='shared/' and token=substring(object_name from 8) and owner=auth.uid());
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('emily-photos','emily-photos',false,2097152,array['image/jpeg']);
create policy emily_photo_read on storage.objects for select to authenticated using(bucket_id='emily-photos' and ((storage.foldername(name))[1]=(select auth.uid()::text) or emily_private.emily_shared_photo_read(name) or emily_private.emily_shared_photo_owner(name)));
create policy emily_photo_insert on storage.objects for insert to authenticated with check(bucket_id='emily-photos' and ((storage.foldername(name))[1]=(select auth.uid()::text) or emily_private.emily_shared_photo_write(name)));
create policy emily_photo_delete on storage.objects for delete to authenticated using(bucket_id='emily-photos' and ((storage.foldername(name))[1]=(select auth.uid()::text) or emily_private.emily_shared_photo_owner(name)));
-- No UPDATE/upsert policy: snapshots and uploaded photos are immutable.

-- PostgreSQL grants EXECUTE to PUBLIC by default; narrow every new function.
revoke all on function emily_private.emily_basic(jsonb),emily_private.emily_validate(jsonb,boolean),emily_private.emily_new_user(),emily_private.emily_save_contact(jsonb,uuid,integer),emily_private.emily_delete_contact(uuid,integer),emily_private.emily_save_profile(jsonb,integer),emily_private.emily_begin_share(uuid,boolean),emily_private.emily_publish_share(text),emily_private.emily_get_share(text),emily_private.emily_import_share(text,text),emily_private.emily_revoke_share(text),emily_private.emily_shared_photo_read(text),emily_private.emily_shared_photo_write(text),emily_private.emily_shared_photo_owner(text) from public,anon,authenticated;
grant execute on function emily_private.emily_save_contact(jsonb,uuid,integer),emily_private.emily_delete_contact(uuid,integer),emily_private.emily_save_profile(jsonb,integer),emily_private.emily_begin_share(uuid,boolean),emily_private.emily_publish_share(text),emily_private.emily_get_share(text),emily_private.emily_import_share(text,text),emily_private.emily_revoke_share(text),emily_private.emily_shared_photo_read(text),emily_private.emily_shared_photo_write(text),emily_private.emily_shared_photo_owner(text) to authenticated;

create function public.emily_save_contact(p jsonb, contact_id uuid default null, expected_version integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_save_contact(p,contact_id,expected_version); $$;
revoke all on function public.emily_save_contact(jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.emily_save_contact(jsonb,uuid,integer) to authenticated;

create function public.emily_delete_contact(contact_id uuid,expected_version integer) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_delete_contact(contact_id,expected_version); $$;
revoke all on function public.emily_delete_contact(uuid,integer) from public,anon,authenticated;
grant execute on function public.emily_delete_contact(uuid,integer) to authenticated;

create function public.emily_save_profile(p jsonb,expected_version integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_save_profile(p,expected_version); $$;
revoke all on function public.emily_save_profile(jsonb,integer) from public,anon,authenticated;
grant execute on function public.emily_save_profile(jsonb,integer) to authenticated;

create function public.emily_begin_share(contact_id uuid default null,own_profile boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_begin_share(contact_id,own_profile); $$;
revoke all on function public.emily_begin_share(uuid,boolean) from public,anon,authenticated;
grant execute on function public.emily_begin_share(uuid,boolean) to authenticated;

create function public.emily_publish_share(share_token text) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_publish_share(share_token); $$;
revoke all on function public.emily_publish_share(text) from public,anon,authenticated;
grant execute on function public.emily_publish_share(text) to authenticated;

create function public.emily_get_share(share_token text) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_get_share(share_token); $$;
revoke all on function public.emily_get_share(text) from public,anon,authenticated;
grant execute on function public.emily_get_share(text) to authenticated;

create function public.emily_import_share(share_token text,imported_photo text default '') returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_import_share(share_token,imported_photo); $$;
revoke all on function public.emily_import_share(text,text) from public,anon,authenticated;
grant execute on function public.emily_import_share(text,text) to authenticated;

create function public.emily_revoke_share(share_token text) returns jsonb language sql security invoker set search_path='' as $$ select emily_private.emily_revoke_share(share_token); $$;
revoke all on function public.emily_revoke_share(text) from public,anon,authenticated;
grant execute on function public.emily_revoke_share(text) to authenticated;

notify pgrst, 'reload schema';
