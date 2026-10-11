import type {BasicPerson} from './people';

export function socialLinks(person:Pick<BasicPerson,'linkedin'|'instagram'|'other'|'otherLabel'>){
 const candidates=[
  {key:'linkedin',label:'LinkedIn',href:person.linkedin,custom:false},
  {key:'instagram',label:'Instagram',href:person.instagram,custom:false},
  {key:'other',label:person.otherLabel?.trim()||'Sito / altro profilo',href:person.other,custom:!!person.otherLabel?.trim()},
 ];
 return candidates.filter(link=>{if(!link.href)return false;try{return ['http:','https:'].includes(new URL(link.href).protocol);}catch{return false;}});
}
