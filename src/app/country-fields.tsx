import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {ChevronDown,Check,X} from 'lucide-react';
import type {CountryCode} from 'libphonenumber-js';
import {usePreferences} from '@/preferences';
import {callingCode,countryName,joinPhoneNumber,phoneCountries,resolveCountry,searchCountries,splitPhoneNumber} from '@/lib/countries';
import './country-fields.css';

export function PhoneField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const {t,language}=usePreferences();
 const id=useId(),lastValue=useRef(value);
 const [parts,setParts]=useState(()=>splitPhoneNumber(value));
 const options=useMemo(()=>phoneCountries.map(code=>({code,label:countryName(code,language),prefix:callingCode(code)})).sort((a,b)=>a.label.localeCompare(b.label,language)),[language]);
 useEffect(()=>{if(value!==lastValue.current){lastValue.current=value;setParts(splitPhoneNumber(value));}},[value]);
 function emit(next:typeof parts,raw=joinPhoneNumber(next.country,next.national)){setParts(next);lastValue.current=raw;onChange(raw);}
 function numberChanged(raw:string){if(/^\+|^00/.test(raw.trim()))emit(splitPhoneNumber(raw),raw);else emit({...parts,national:raw});}
 return <div className="phone-field"><label htmlFor={id}>{t('Telefono')}</label><div className="phone-controls">
  <select aria-label={t('Prefisso telefonico')} value={parts.country} onChange={event=>{const country=event.target.value as CountryCode;emit({country,national:parts.country?parts.national:parts.national.replace(/^\+|^00/,'')});}}>
   {!parts.country&&<option value="" disabled>{t('Numero internazionale')}</option>}
   {options.map(option=><option value={option.code} key={option.code}>{option.prefix} · {option.label}</option>)}
  </select>
  <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" aria-label={t('Numero di telefono')} value={parts.national} maxLength={parts.country?100-callingCode(parts.country).length-1:100} placeholder={t('Es. 333 1234567')} onChange={event=>numberChanged(event.target.value)}/>
 </div></div>;
}

export function CountryField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const {t,language}=usePreferences();
 const id=useId(),listId=id+'-countries',root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const selected=resolveCountry(value),display=selected?countryName(selected,language):value;
 const options=useMemo(()=>searchCountries(query,language),[query,language]);
 const highlighted=Math.min(active,Math.max(0,options.length-1));
 function close(){setOpen(false);setQuery('');setActive(0);}
 function choose(index:number){const option=options[index];if(option){onChange(option.label);close();input.current?.focus();}}
 function finish(){if(query.trim()&&options.length)onChange(options[highlighted].label);close();}
 useEffect(()=>{
  if(!open)return;
  const outside=(event:Event)=>{if(!root.current?.contains(event.target as Node))finish();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('focusin',outside);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('focusin',outside);};
 },[open,query,highlighted,options,onChange]);
 useEffect(()=>{if(disabled)close();},[disabled]);
 useEffect(()=>{if(open)document.getElementById(listId+'-'+highlighted)?.scrollIntoView({block:'nearest'});},[open,highlighted,listId,options]);
 function keyboard(event:KeyboardEvent<HTMLInputElement>){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){setQuery('');setOpen(true);setActive(event.key==='ArrowDown'?0:searchCountries('',language).length-1);}else if(options.length)setActive((highlighted+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
  else if(event.key==='Enter'&&open){event.preventDefault();choose(highlighted);}
  else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}
  else if(event.key==='Tab'&&open)finish();
 }
 return <div className="country-field" ref={root}><label htmlFor={id}>{t('Paese')}</label>
  <div className="country-input-row"><input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open&&options.length?listId+'-'+highlighted:undefined} autoComplete="off" disabled={disabled} value={open?query:display} placeholder={t('Cerca o scegli un paese')} onFocus={()=>{if(!disabled&&!open){setQuery('');setActive(0);setOpen(true);}}} onChange={event=>{setQuery(event.target.value);setActive(0);setOpen(true);}} onKeyDown={keyboard} maxLength={200}/>
   {value&&<button className="country-clear" type="button" aria-label={t('Cancella paese')} disabled={disabled} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange('');close();}}><X size={15} aria-hidden="true"/></button>}
   <button className="country-toggle" type="button" aria-label={t(open?'Chiudi elenco dei paesi':'Apri elenco dei paesi')} aria-expanded={open} aria-controls={open?listId:undefined} disabled={disabled} onMouseDown={event=>event.preventDefault()} onClick={()=>{if(open)close();else{setQuery('');setActive(0);setOpen(true);input.current?.focus();}}}><ChevronDown size={18} aria-hidden="true"/></button>
  </div>
  {open&&<><div id={listId} className="country-options" role="listbox" aria-label={t('Paesi')}>
   {options.map((option,index)=><button type="button" role="option" id={listId+'-'+index} key={option.code} tabIndex={-1} aria-selected={index===highlighted} className={index===highlighted?'highlighted':''} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}><span>{option.label}</span>{selected===option.code&&<Check size={16} aria-hidden="true"/>}</button>)}
   {!options.length&&<p className="country-no-results">{t('Nessun paese trovato')}</p>}
  </div><span className="sr-only" role="status">{options.length?t('Paesi trovati: {count}',{count:options.length}):t('Nessun paese trovato')}</span></>}
 </div>;
}
