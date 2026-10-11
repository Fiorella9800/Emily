-- Add an optional display name for the existing other URL. Existing records stay intact.
CREATE OR REPLACE FUNCTION emily_private.emily_basic(p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('first',coalesce(p->>'first',''),'last',coalesce(p->>'last',''),'role',coalesce(p->>'role',''),'company',coalesce(p->>'company',''),'phone',coalesce(p->>'phone',''),'email',coalesce(p->>'email',''),'city',coalesce(p->>'city',''),'country',coalesce(p->>'country',''),'linkedin',coalesce(p->>'linkedin',''),'instagram',coalesce(p->>'instagram',''),'other',coalesce(p->>'other',''),'otherLabel',coalesce(p->>'otherLabel',''),'photo',coalesce(p->>'photo',''));
$function$;

CREATE OR REPLACE FUNCTION emily_private.emily_validate(p jsonb, only_basic boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; k text; maxlen integer; val text; rel jsonb;
begin
 if auth.uid() is null then raise exception 'Accedi a Emily.'; end if;
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>50000 then raise exception 'Scheda non valida.'; end if;
 for k,maxlen in select * from (values ('first',120),('last',120),('role',300),('company',300),('phone',100),('email',254),('city',200),('country',200),('linkedin',2000),('instagram',2000),('other',2000),('otherLabel',120),('photo',100),('place',500),('date',10),('notes',10000),('usefulness',5000),('addressMode',3),('sectors',1000)) f(key,lim) loop
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
end $function$;

