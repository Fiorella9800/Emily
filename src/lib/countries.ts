import {getCountries,getCountryCallingCode,parsePhoneNumberFromString,type CountryCode} from 'libphonenumber-js';

// ISO country list from node-i18n-iso-countries/codes.json, retrieved 2026-10-11.
// Includes Kosovo; telephone metadata also adds Ascension and Tristan da Cunha.
const isoCountryCodes=["AF","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MP","MK","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","SH","KN","LC","PM","VC","WS","SM","ST","SA","SN","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","AX","BQ","CW","GG","IM","JE","ME","BL","MF","RS","SX","SS","XK"];
export const phoneCountries=getCountries();
export const countryCodes=[...new Set([...isoCountryCodes,...phoneCountries])];
const names={it:new Intl.DisplayNames(['it'],{type:'region'}),en:new Intl.DisplayNames(['en'],{type:'region'})};
export function countryName(code:string,language:'it'|'en'='it'){return names[language].of(code)||code;}
export function callingCode(code:CountryCode){return '+'+getCountryCallingCode(code);}
export function normalizeCountry(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();}
const aliases=new Map<string,string>();
for(const code of countryCodes)for(const label of [code,countryName(code,'it'),countryName(code,'en')])aliases.set(normalizeCountry(label),code);
for(const [alias,code] of [['UK','GB'],['USA','US'],['U.S.A.','US'],['United States of America','US'],['Regno Unito','GB']])aliases.set(normalizeCountry(alias),code);
export function resolveCountry(value:string){return aliases.get(normalizeCountry(value));}
export function countryOptions(language:'it'|'en'='it'){
 return countryCodes.map(code=>({code,label:countryName(code,language)})).sort((a,b)=>a.label.localeCompare(b.label,language));
}
export function searchCountries(query:string,language:'it'|'en'='it'){
 const search=normalizeCountry(query),options=countryOptions(language);
 if(!search)return options;
 return options.filter(option=>normalizeCountry(option.label).startsWith(search)||option.code.toLowerCase()===search);
}
export type PhoneParts={country:CountryCode|'';national:string};
const codesByLength=[...new Set(phoneCountries.map(code=>getCountryCallingCode(code)))].sort((a,b)=>b.length-a.length);
export function splitPhoneNumber(value:string):PhoneParts{
 const original=value.trim();
 if(!/^\+|^00/.test(original))return {country:'IT',national:value};
 const international=original.startsWith('00')?'+'+original.slice(2):original;
 const parsed=parsePhoneNumberFromString(international,{extract:false});
 const digits=international.replace(/\D/g,'');
 const prefix=parsed?.countryCallingCode||codesByLength.find(code=>digits.startsWith(code));
 const matching=prefix?phoneCountries.filter(country=>getCountryCallingCode(country)===prefix):[];
 if(!matching.length)return {country:'',national:value};
 const preferred=prefix==='39'?'IT':prefix==='1'?'US':prefix==='7'?'RU':undefined;
 const country=parsed?.country||(preferred&&matching.includes(preferred)?preferred:matching[0]);
 let consumed=0,index=1;
 while(index<international.length&&consumed<prefix!.length){if(/\d/.test(international[index]))consumed++;index++;}
 return {country,national:international.slice(index).replace(/^[\s.-]+/,'')};
}
export function joinPhoneNumber(country:CountryCode|'',national:string){
 const number=national.trim();
 if(!number)return '';
 return country?callingCode(country)+' '+number:number;
}

