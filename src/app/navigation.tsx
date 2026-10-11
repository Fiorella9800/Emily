import {useRef,useState,type RefObject} from 'react';
import {Menu,BookUser,Network,UserRound,Share2,HelpCircle,Settings,LogOut,ChevronRight} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {usePreferences} from '@/preferences';
import {name,type Person} from '@/lib/people';

export default function Navigation({profile,photoUrl,accountLabel,view,count,onNavigate,onHelp,onLogout,menuRef}:{profile:Person;photoUrl:(profile:Person)=>string;accountLabel:string;view:string;count:number;onNavigate:(view:string)=>void;onHelp:()=>void;onLogout:()=>void;menuRef:RefObject<HTMLButtonElement|null>}){
 const [open,setOpen]=useState(false);
 const openingHelp=useRef(false);
 const {t}=usePreferences();
 function navigate(next:string){setOpen(false);onNavigate(next);}
 const sections=[{id:'people',label:'Le tue persone',Icon:BookUser},{id:'map',label:'Connessioni',Icon:Network},{id:'shares',label:'Condivisioni',Icon:Share2}];
 return <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild><button ref={menuRef} type="button" className="menu-toggle" aria-label={t('Apri menu')} aria-expanded={open}><Menu size={22} aria-hidden="true"/><span>{t('Menu')}</span></button></DialogTrigger>
  <DialogContent className="navigation-drawer" aria-describedby="navigation-description" onCloseAutoFocus={event=>{if(openingHelp.current){event.preventDefault();openingHelp.current=false;}}}>
   <div className="drawer-heading"><DialogTitle>{t('Il tuo menu Emily')}</DialogTitle><DialogDescription id="navigation-description" className="sr-only">{t('Scegli una sezione del tuo spazio personale.')}</DialogDescription></div>
   <button type="button" className="drawer-profile" onClick={()=>navigate('profile')} aria-label={t('Il tuo profilo')} aria-current={view==='profile'?'page':undefined}>
    <span className="drawer-avatar">{profile.photo&&photoUrl(profile)?<img src={photoUrl(profile)} alt=""/>:<UserRound size={25} aria-hidden="true"/>}</span>
    <span><span className="drawer-profile-label">{t('Profilo')}</span><strong>{name(profile)||t('Il tuo profilo')}</strong><small>{accountLabel}</small></span><ChevronRight size={17} aria-hidden="true"/>
   </button>
   <nav className="drawer-links" aria-label={t('Sezioni di Emily')}>
    {sections.map(({id,label,Icon})=><button type="button" key={id} aria-current={view===id?'page':undefined} className={view===id?'active':''} onClick={()=>navigate(id)}><Icon size={20} aria-hidden="true"/><span>{t(label)}</span>{id==='people'&&<small>{count}</small>}</button>)}
    <div className="drawer-divider"/>
    <button type="button" onClick={()=>{openingHelp.current=true;setOpen(false);onHelp();}}><HelpCircle size={20} aria-hidden="true"/><span>{t('Come funziona')}</span></button>
    <button type="button" className={view==='settings'?'active':''} aria-current={view==='settings'?'page':undefined} onClick={()=>navigate('settings')}><Settings size={20} aria-hidden="true"/><span>{t('Impostazioni')}</span></button>
   </nav>
   <div className="drawer-bottom"><button type="button" className="signout" aria-label={t('Esci dal tuo account Emily')} onClick={()=>{setOpen(false);onLogout();}}><LogOut size={16} aria-hidden="true"/> {t('Esci')}</button></div>
  </DialogContent>
 </Dialog>;
}
