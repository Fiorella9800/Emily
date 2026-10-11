import {english} from './translations';

export type Language='it'|'en';
export type Theme='light'|'dark';
export type Preferences={language:Language;theme:Theme};
export type PreferenceStorage=Pick<Storage,'getItem'|'setItem'>;
export const defaultPreferences:Preferences={language:'it',theme:'light'};
export const preferenceKey=(owner:string|null)=>'emily.preferences.'+(owner||'device');
export function readPreferences(storage:PreferenceStorage|null,owner:string|null,fallback:Preferences=defaultPreferences):Preferences{
 try{
  const value=JSON.parse(storage?.getItem(preferenceKey(owner))||'null');
  return {language:value?.language==='en'?'en':value?.language==='it'?'it':fallback.language,theme:value?.theme==='dark'?'dark':value?.theme==='light'?'light':fallback.theme};
 }catch{return {...fallback};}
}
export function savePreferences(storage:PreferenceStorage|null,owner:string|null,preferences:Preferences){
 if(!storage)return false;
 try{const data=JSON.stringify({language:preferences.language,theme:preferences.theme});storage.setItem(preferenceKey(owner),data);if(owner)storage.setItem(preferenceKey(null),data);return true;}catch{return false;}
}
const italian=Object.fromEntries(Object.entries(english).map(([it,en])=>[en,it]));
export function createTranslator(language:Language){
 return (source:string,values:Record<string,string|number>={})=>{
  const dictionary=language==='en'?english:italian;
  const text=Object.hasOwn(dictionary,source)?dictionary[source]:source;
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
 };
}
