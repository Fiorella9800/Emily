import {ArrowUpRight,BookUser,Building2,CalendarDays,Link2,LockKeyhole,Mail,MapPin,Pencil,Phone,Share2,UserRound} from 'lucide-react';
import {DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {usePreferences} from '@/preferences';
import {location,name,type Person} from '@/lib/people';
import {socialLinks} from '@/lib/social-links';
import './contact-view.css';

export default function ContactView({person,people,photoUrl,onEdit,onOpen,onShare,sharingBusy}:{person:Person;people:Person[];photoUrl:(p:Person)=>string;onEdit:()=>void;onOpen:(p:Person)=>void;onShare:()=>void;sharingBusy:boolean}){
 const {t,locale}=usePreferences();
 const links=socialLinks(person),where=location(person);
 const relations=person.relations.map(relation=>({person:people.find(p=>p.id===relation.id),label:relation.label}));
 const inbound=people.filter(p=>p.id!==person.id).flatMap(p=>p.relations.filter(r=>r.id===person.id).map(r=>({person:p,label:r.label})));
 const encounterDate=person.date?new Date(person.date+'T12:00:00'):null;
 const date=encounterDate&&!Number.isNaN(encounterDate.valueOf())?encounterDate.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'}):person.date;
 return <>
  <DialogTitle className="sr-only">{name(person)}</DialogTitle><DialogDescription className="sr-only">{t('Informazioni della persona. Premi Modifica per aggiornarle.')}</DialogDescription>
  <div className="contact-hero"><div className="contact-portrait">{person.photo&&photoUrl(person)?<img src={photoUrl(person)} alt={t('Foto di ')+name(person)}/>:<span>{person.first[0]}{person.last[0]}</span>}</div>
   <div className="contact-identity"><p className="eyebrow">{t('Scheda persona')}</p><h2>{name(person)}</h2>{person.role&&<p className="contact-role">{person.role}</p>}{person.company&&<p className="contact-meta"><Building2 size={16} aria-hidden="true"/>{person.company}</p>}{where&&<p className="contact-meta"><MapPin size={16} aria-hidden="true"/>{where}</p>}
    <div className="contact-buttons"><button type="button" className="primary" onClick={onEdit}><Pencil size={16} aria-hidden="true"/>{t('Modifica')}</button><button type="button" className="secondary" onClick={onShare} disabled={sharingBusy}><Share2 size={16} aria-hidden="true"/>{t('Condividi')}</button></div>
   </div>
  </div>
  <div className="contact-details"><section className="contact-section"><h3><BookUser size={18} aria-hidden="true"/>{t('Contatti e profili')}</h3>
   <div className="contact-channels">{person.phone&&<a href={'tel:'+person.phone.replace(/[^\d+]/g,'')}><Phone size={20} aria-hidden="true"/><span><small>{t('Telefono')}</small><strong>{person.phone}</strong></span><ArrowUpRight size={16} aria-hidden="true"/></a>}{person.email&&<a href={'mailto:'+person.email}><Mail size={20} aria-hidden="true"/><span><small>{t('E-mail')}</small><strong>{person.email}</strong></span><ArrowUpRight size={16} aria-hidden="true"/></a>}</div>
   {links.length>0&&<div className="contact-socials">{links.map(link=><a key={link.key} href={link.href} target="_blank" rel="noopener noreferrer"><Link2 size={16} aria-hidden="true"/><span>{link.custom?link.label:t(link.label)}</span><ArrowUpRight size={15} aria-hidden="true"/></a>)}</div>}
   {!person.phone&&!person.email&&!links.length&&<p className="contact-muted">{t('Non hai ancora aggiunto recapiti o profili social.')}</p>}
  </section>
  {where&&<section className="contact-section"><h3><MapPin size={18} aria-hidden="true"/>{t('Dove si trova')}</h3><p>{where}</p><a className="contact-map" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(where)} target="_blank" rel="noopener noreferrer">{t('Vedi la località sulla mappa')}<ArrowUpRight size={15} aria-hidden="true"/></a></section>}
  {person.usefulness&&<section className="contact-section contact-purpose"><h3><UserRound size={18} aria-hidden="true"/>{t('A cosa può servirmi questo contatto?')}</h3><p className="contact-prose">{person.usefulness}</p></section>}
  {(person.addressMode||person.sectors)&&<section className="contact-section"><h3>{t('Il tuo contesto personale')}</h3>{person.addressMode&&<p className="contact-formality">{t(person.addressMode==='Tu'?'Ci diamo del Tu':'Ci diamo del Lei')}</p>}{person.sectors&&<div className="contact-tags">{person.sectors.split(',').filter(value=>value.trim()).map((value,index)=><span key={index}>{value.trim()}</span>)}</div>}</section>}
  {(person.place||person.date)&&<section className="contact-section"><h3><CalendarDays size={18} aria-hidden="true"/>{t('Il primo incontro')}</h3>{person.place&&<p className="contact-prose">{person.place}</p>}{date&&<p className="contact-muted">{date}</p>}</section>}
  {person.notes&&<section className="contact-section"><h3>{t('Un dettaglio per ricordare')}</h3><p className="contact-prose">{person.notes}</p></section>}
  {(relations.length>0||inbound.length>0)&&<section className="contact-section"><h3><Link2 size={18} aria-hidden="true"/>{t('Collegamenti')}</h3><div className="contact-relations">{relations.map((relation,index)=><button type="button" key={'out-'+index} onClick={()=>relation.person&&onOpen(relation.person)} disabled={!relation.person}><span><strong>{relation.person?name(relation.person):t('Contatto rimosso')}</strong><small>{relation.label}</small></span><ArrowUpRight size={16} aria-hidden="true"/></button>)}{inbound.map((relation,index)=><button type="button" key={'in-'+index} onClick={()=>onOpen(relation.person)}><span><strong>{name(relation.person)}</strong><small>{relation.label} → {name(person)}</small></span><ArrowUpRight size={16} aria-hidden="true"/></button>)}</div></section>}
  </div><p className="contact-private"><LockKeyhole size={14} aria-hidden="true"/>{t('Note e contesto personale restano privati.')}</p>
 </>;
}
