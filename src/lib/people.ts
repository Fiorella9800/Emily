import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).default('');
const link = text(2000).refine(v => !v || /^https?:\/\//i.test(v), 'Usa un link completo https://');
export const fields = z.object({
  first: z.string().trim().min(1).max(120), last: text(120), role: text(300), company: text(300),
  phone: text(100), email: text(254).refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),
  city: text(200), country: text(200), place: text(500), date: text(10), notes: text(10000),
  usefulness: text(5000), addressMode: z.enum(['','Tu','Lei']).default(''), sectors: text(1000),
  linkedin: link, instagram: link, other: link, photo: text(100).refine(v => /^[a-zA-Z0-9-]*$/.test(v)),
  relations: z.array(z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(120)})).max(100).default([]),
});
export type Person = z.infer<typeof fields> & { id?: string; version?: number; updated?: string };
export type BasicPerson = Pick<Person,'first'|'last'|'role'|'company'|'phone'|'email'|'city'|'country'|'linkedin'|'instagram'|'other'|'photo'>;
export function blank(): Person { return {first:'',last:'',role:'',company:'',phone:'',email:'',city:'',country:'',place:'',date:'',notes:'',usefulness:'',addressMode:'',sectors:'',linkedin:'',instagram:'',other:'',photo:'',relations:[]}; }
// This is the complete allowlist for sharing, deliberately independent of private fields.
export function basic(p: Person): BasicPerson {
  return {first:p.first,last:p.last,role:p.role,company:p.company,phone:p.phone,email:p.email,city:p.city,country:p.country,linkedin:p.linkedin,instagram:p.instagram,other:p.other,photo:p.photo};
}
export const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const name = (p: Pick<Person,'first'|'last'>) => [p.first,p.last].filter(Boolean).join(' ');
export const location = (p: Pick<Person,'city'|'country'>) => [p.city,p.country].filter(Boolean).join(', ');
export const photoUrl = (p: Pick<Person,'photo'>) => '/api/photo?id='+encodeURIComponent(p.photo);
export function groups(people: Person[], kind: string) {
  const entries = new Map<string,{id:string;label:string;members:Person[]}>();
  for(const p of people) {
    const values = kind==='company'?[p.company]:kind==='city'?[location(p)]:kind==='place'?[p.place]:p.sectors.split(',');
    for(const raw of values){const label=raw.trim(), id=normalized(label);if(!id)continue;const group=entries.get(id)||{id,label,members:[]};if(!group.members.some(x=>x.id===p.id))group.members.push(p);entries.set(id,group);}
  }
  return [...entries.values()].sort((a,b)=>b.members.length-a.members.length||a.label.localeCompare(b.label,'it'));
}
const unescapeCard = (s: string) => s.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
const splitCard = (s: string) => s.split(/(?<!\\);/).map(unescapeCard);
export function parseCard(input: string): { person?: Person; token?: string; info?: string; photoData?: string } {
  const raw=input.trim();if(raw.length>3000000)throw Error('Il contenuto del biglietto è troppo lungo.');
  if(/^https?:\/\//i.test(raw)){
    const u=new URL(raw);const token=u.searchParams.get('share');
    if(token && /^[a-f0-9]{64}$/.test(token))return {token};
    const p=blank();const host=u.hostname.toLowerCase();
    if(host==='linkedin.com'||host.endsWith('.linkedin.com'))p.linkedin=u.href;
    else if(host==='instagram.com'||host.endsWith('.instagram.com'))p.instagram=u.href;
    else p.other=u.href;
    return {person:p,info:'Questo QR contiene un link. Lo trovi nella scheda; aggiungi il nome e gli altri dati disponibili sul sito.'};
  }
  const p=blank();
  if(/^BEGIN:VCARD/i.test(raw)){
    const lines=raw.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);let fn='',photoData='';
    for(const line of lines){const idx=line.indexOf(':');if(idx<0)continue;const key=line.slice(0,idx).split(';')[0].replace(/^item\d+\./i,'').toUpperCase();const value=line.slice(idx+1);const v=unescapeCard(value);
      if(key==='N'){const a=splitCard(value);p.last=a[0]||'';p.first=a[1]||'';}
      if(key==='FN')fn=v;if(key==='ORG')p.company=splitCard(value).filter(Boolean).join(' · ');
      if(key==='TITLE')p.role=v;if(key==='TEL'&&!p.phone)p.phone=v.replace(/^tel:/i,'');
      if(key==='EMAIL'&&!p.email)p.email=v.replace(/^mailto:/i,'');
      if(key==='ADR'){const a=splitCard(value);p.city=a[3]||'';p.country=a[6]||'';}
      if(key==='PHOTO'){
        if(/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value))photoData=value;
        else if(/;ENCODING=(b|base64)(;|$)/i.test(line.slice(0,idx))&&/^[a-z0-9+/=]+$/i.test(value)){
          const mime=/;TYPE=PNG(;|$)/i.test(line.slice(0,idx))?'png':/;TYPE=WEBP(;|$)/i.test(line.slice(0,idx))?'webp':'jpeg';
          photoData='data:image/'+mime+';base64,'+value;
        }
      }
      if((key==='URL'||key==='X-SOCIALPROFILE')&&/^https?:\/\//i.test(v)){const parsed=parseCard(v).person;if(parsed)for(const k of ['linkedin','instagram','other'] as const)if(parsed[k]&&!p[k])p[k]=parsed[k];}
    }
    if(!p.first&&fn){const a=fn.split(/\s+/);p.first=a.shift()||'';if(!p.last)p.last=a.join(' ');}
    return {person:p,photoData:photoData||undefined,info:'Dati del biglietto importati. Controlla la scheda prima di salvarla.'};
  }
  if(/^MECARD:/i.test(raw)){
    for(const part of raw.slice(7).split(/(?<!\\);/)){const idx=part.indexOf(':');if(idx<0)continue;const key=part.slice(0,idx).toUpperCase(),v=unescapeCard(part.slice(idx+1));
      if(key==='N'){const a=v.split(',');if(a.length>1){p.last=a[0];p.first=a.slice(1).join(' ');}else p.first=v;}
      if(key==='TEL'&&!p.phone)p.phone=v;if(key==='EMAIL'&&!p.email)p.email=v;if(key==='ORG')p.company=v;
      if(key==='URL'&&/^https?:\/\//i.test(v))p.other=v;
    }return {person:p,info:'Dati MECARD importati. Controlla il nome e completa ciò che manca.'};
  }
  if(/^mailto:/i.test(raw)){p.email=decodeURIComponent(raw.slice(7).split('?')[0]);return {person:p};}
  if(/^tel:/i.test(raw)){p.phone=raw.slice(4);return {person:p};}
  throw Error('QR non riconosciuto. Sono supportati vCard, MECARD, link, e-mail, telefono e QR di Emily.');
}
export function vcard(p:BasicPerson,photoBase64=''){
  const e=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const out=['BEGIN:VCARD','VERSION:3.0',`N:${e(p.last)};${e(p.first)};;;`,`FN:${e(name(p))}`];
  if(p.role)out.push('TITLE:'+e(p.role));if(p.company)out.push('ORG:'+e(p.company));
  if(p.phone)out.push('TEL;TYPE=CELL:'+e(p.phone));if(p.email)out.push('EMAIL:'+e(p.email));
  if(p.city||p.country)out.push(`ADR:;;;${e(p.city)};;;${e(p.country)}`);
  for(const key of ['linkedin','instagram','other'] as const)if(p[key])out.push('URL:'+p[key]);
  if(photoBase64)out.push('PHOTO;ENCODING=b;TYPE=JPEG:'+photoBase64);out.push('END:VCARD');
  return out.join('\r\n');
}
