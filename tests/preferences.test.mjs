import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transpileModule,ModuleKind} from 'typescript';
const source=fs.readFileSync(new URL('../src/preferences-core.ts',import.meta.url),'utf8');
const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext}}).outputText.replace("'./translations'",JSON.stringify(new URL('../src/translations.ts',import.meta.url).href));
const {readPreferences,savePreferences,preferenceKey,createTranslator}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
function storage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}

test('account preferences remain separate and only interface choices are persisted',()=>{
 const s=storage();
 savePreferences(s,'alice',{language:'en',theme:'dark',notes:'private note',access_token:'secret'});
 savePreferences(s,'bob',{language:'it',theme:'light'});
 assert.deepEqual(readPreferences(s,'alice'),{language:'en',theme:'dark'});
 assert.deepEqual(readPreferences(s,'bob'),{language:'it',theme:'light'});
 assert.deepEqual(JSON.parse(s.getItem(preferenceKey('alice'))),{language:'en',theme:'dark'});
 assert.ok(![...s.values.values()].join('').includes('private note'));
 assert.ok(![...s.values.values()].join('').includes('secret'));
});

test('malformed storage and unsupported choices fall back to valid defaults',()=>{
 const s=storage(),fallback={language:'en',theme:'dark'};
 for(const value of ['{broken','null','42','[]','{"language":"fr","theme":"bright"}']){
  s.setItem(preferenceKey('alice'),value);
  assert.deepEqual(readPreferences(s,'alice',fallback),fallback);
 }
 s.setItem(preferenceKey('alice'),'{"language":"it","theme":"unsupported"}');
 assert.deepEqual(readPreferences(s,'alice',fallback),{language:'it',theme:'dark'});
});

test('denied storage does not prevent using the application',()=>{
 const denied={getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}};
 assert.deepEqual(readPreferences(denied,'alice'),{language:'it',theme:'light'});
 assert.equal(savePreferences(denied,'alice',{language:'en',theme:'dark'}),false);
 assert.equal(savePreferences(null,null,{language:'en',theme:'dark'}),false);
 assert.deepEqual(readPreferences(null,null),{language:'it',theme:'light'});
});

test('translation changes interface labels and preserves inserted contact values',()=>{
 const en=createTranslator('en'),it=createTranslator('it');
 assert.equal(en('Le tue persone'),'Your people');
 assert.equal(it('Le tue persone'),'Le tue persone');
 const email='Come funziona+Fiorella@example.com';
 assert.equal(en('Inserisci il codice inviato a {email}.',{email}),'Enter the code sent to '+email+'.');
 assert.equal(en('unknown {name}',{name:'Profilo'}),'unknown Profilo');
 assert.equal(en('unknown {name}'),'unknown {name}');
 for(const key of ['constructor','__proto__','toString','untranslated message'])assert.equal(en(key),key);
});

test('both themes retain readable text and white primary button labels',()=>{
 const css=fs.readFileSync(new URL('../src/app/theme.css',import.meta.url),'utf8');
 const themes=[...css.matchAll(/:root(?:\[data-theme=dark\])?\{([^}]+)\}/g)].map(match=>Object.fromEntries([...match[1].matchAll(/(--[a-z-]+):(#(?:[\da-f]{6}|[\da-f]{3}))/g)].map(m=>[m[1],m[2]])));
 function luminance(hex){const code=hex.length===4?hex.slice(1).split('').map(c=>c+c).join(''):hex.slice(1);const c=code.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
 function ratio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 assert.equal(themes.length,2);
 for(const theme of themes){for(const [text,background]of [['--text','--surface'],['--muted-text','--surface'],['--brand-text','--brand-soft']])assert.ok(ratio(theme[text],theme[background])>=4.5,text+' should be readable');assert.ok(ratio('#fff',theme['--brand-fill'])>=4.5);}
});
