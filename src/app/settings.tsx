import type {ReactNode} from 'react';
import {Settings,LockKeyhole,Languages,Sun,Moon} from 'lucide-react';
import {usePreferences} from '@/preferences';

export default function SettingsPage({accountAccess,accountLabel}:{accountAccess:ReactNode;accountLabel:string}){
 const {t,language,theme,update,persisted}=usePreferences();
 return <section className="settings-panel" aria-labelledby="settings-title">
  <div className="settings-heading"><Settings size={26} aria-hidden="true"/><div><p className="eyebrow">EMILY</p><h1 id="settings-title">{t('Impostazioni')}</h1><p>{t('Personalizza il tuo spazio Emily.')}</p></div></div>
  <div className="settings-card"><div className="settings-row"><LockKeyhole size={22} aria-hidden="true"/><div><h2>{t('Account')}</h2><p>{accountLabel}</p><p>{t('Password e recapiti per accedere al tuo account.')}</p></div></div>{accountAccess}</div>
  <div className="settings-card"><div className="settings-row"><Languages size={22} aria-hidden="true"/><div><h2>{t('Lingua')}</h2><p>{t('Scegli la lingua dell’interfaccia.')}</p></div></div><label className="settings-select"><span className="sr-only">{t('Lingua')}</span><select value={language} onChange={event=>update({language:event.target.value==='en'?'en':'it'})}><option value="it">Italiano</option><option value="en">English</option></select></label></div>
  <div className="settings-card"><div className="settings-row">{theme==='dark'?<Moon size={22} aria-hidden="true"/>:<Sun size={22} aria-hidden="true"/>}<div><h2>{t('Aspetto')}</h2><p>{t('Scegli l’aspetto dell’app.')}</p></div></div><div className="theme-options" role="group" aria-label={t('Aspetto')}><button type="button" className={theme==='light'?'active':''} aria-pressed={theme==='light'} onClick={()=>update({theme:'light'})}><Sun size={20} aria-hidden="true"/>{t('Chiara')}</button><button type="button" className={theme==='dark'?'active':''} aria-pressed={theme==='dark'} onClick={()=>update({theme:'dark'})}><Moon size={20} aria-hidden="true"/>{t('Scura')}</button></div></div>
  <p className="settings-storage" role="status">{t(persisted?'Le preferenze vengono salvate automaticamente su questo dispositivo.':'Il browser non consente il salvataggio: le preferenze valgono per questa sessione.')}</p>
 </section>;
}
