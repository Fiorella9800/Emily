import {usePreferences} from '@/preferences';
import {appPath} from '../routes';
import './emily-brand.css';

export default function EmilyBrand(){
 const {t}=usePreferences();
 return <a href={appPath} className="brand" aria-label={t("Emily, pagina principale")}>
  <span className="brand-icon" aria-hidden="true"><img src={appPath+'branding/emily-connected.png'} alt="" width={1254} height={1254} decoding="async"/></span>
  <span className="brand-wordmark">mily<span className="brand-dot">.</span></span>
 </a>;
}
