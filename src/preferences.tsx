import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {createTranslator,readPreferences,savePreferences,preferenceKey,type Preferences} from './preferences-core';

function storage(){try{return window.localStorage;}catch{return null;}}
type PreferenceContext=Preferences&{locale:string;persisted:boolean;t:ReturnType<typeof createTranslator>;selectOwner:(owner:string|null)=>void;update:(patch:Partial<Preferences>)=>void};
const Context=createContext<PreferenceContext|null>(null);
export function PreferencesProvider({children}:{children:ReactNode}){
 const [state,setState]=useState(()=>({owner:null as string|null,...readPreferences(storage(),null)}));
 const [persisted,setPersisted]=useState(true);
 const selectOwner=useCallback((owner:string|null)=>setState(previous=>previous.owner===owner?previous:{owner,...readPreferences(storage(),owner,readPreferences(storage(),null))}),[]);
 const update=useCallback((patch:Partial<Preferences>)=>setState(previous=>({...previous,...patch})),[]);
 useEffect(()=>{
  document.documentElement.lang=state.language;
  document.documentElement.dataset.theme=state.theme;
  document.documentElement.classList.toggle('dark',state.theme==='dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.theme==='dark'?'#191719':'#a6152b');
  setPersisted(savePreferences(storage(),state.owner,state));
 },[state]);
 useEffect(()=>{const receive=(event:StorageEvent)=>{if(event.key===preferenceKey(state.owner))setState(previous=>({...previous,...readPreferences(storage(),previous.owner)}));};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[state.owner]);
 const value=useMemo(()=>({...state,persisted,locale:state.language==='en'?'en-GB':'it-IT',t:createTranslator(state.language),selectOwner,update}),[state,persisted,selectOwner,update]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences(){const value=useContext(Context);if(!value)throw Error('Preferences provider is missing');return value;}
