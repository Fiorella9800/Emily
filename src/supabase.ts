import {createClient} from '@supabase/supabase-js';
import config from '../public-config.json';
export const url=import.meta.env.VITE_SUPABASE_URL||config.supabaseUrl;
export const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.publishableKey;
// Fail closed: no mock login or local contacts if the backend is absent.
export const configured=/^https:\/\//.test(url)&&!url.includes('YOUR_PROJECT')&&key.startsWith('sb_publishable_')&&!key.includes('REPLACE_ME');
export const phoneEnabled=(import.meta.env.VITE_PHONE_AUTH_ENABLED??String(config.phoneAuthEnabled))==='true';
export const supabase=configured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
