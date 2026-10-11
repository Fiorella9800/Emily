'use client';
import {useEffect,useRef,useState} from 'react';
import jsQR from 'jsqr';
import {Camera,Upload,Square} from 'lucide-react';
export default function QRScanner({onRead}:{onRead:(value:string)=>void}){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),frame=useRef(0),mounted=useRef(true),callback=useRef(onRead);
 const [running,setRunning]=useState(false),[error,setError]=useState(''),[raw,setRaw]=useState(''),[pending,setPending]=useState(false);
 callback.current=onRead;
 function stop(){cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(mounted.current){setRunning(false);setPending(false);}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 async function start(){setError('');setPending(true);try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('La fotocamera non è disponibile in questo browser. Carica un’immagine del QR.');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;const v=video.current!;v.srcObject=media;await v.play();setRunning(true);setPending(false);
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true})!;let last=0;
   function tick(now:number){if(!mounted.current||!stream.current)return;
     if(now-last>180&&v.readyState>=2){last=now;const ratio=Math.min(1,960/v.videoWidth);canvas.width=v.videoWidth*ratio;canvas.height=v.videoHeight*ratio;ctx.drawImage(v,0,0,canvas.width,canvas.height);const img=ctx.getImageData(0,0,canvas.width,canvas.height);const qr=jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});if(qr){stop();callback.current(qr.data);return;}}
     frame.current=requestAnimationFrame(tick);
   }frame.current=requestAnimationFrame(tick);
 }catch(e){stop();setError((e as Error).name==='NotAllowedError'?'Consenti l’accesso alla fotocamera, oppure carica una foto del QR.':(e as Error).message);}}
 async function upload(file?:File){if(!file)return;setError('');if(file.size>15*1024*1024){setError('Scegli un file fino a 15 MB.');return;}
   if(/\.vcf$/i.test(file.name)||file.type.includes('vcard')){callback.current(await file.text());return;}
   if(!file.type.startsWith('image/')){setError('Carica un’immagine del QR o un file .vcf.');return;}
   try{const bitmap=await createImageBitmap(file);const c=document.createElement('canvas');const ratio=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));c.width=bitmap.width*ratio;c.height=bitmap.height*ratio;const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();const d=ctx.getImageData(0,0,c.width,c.height),qr=jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});if(!qr)throw Error('Nessun QR trovato. Usa una foto più nitida e includi tutto il codice.');stop();callback.current(qr.data);}catch(e){setError((e as Error).message);}
 }
 return <div className="scanner"><div className={'camera-box '+(running?'on':'')}><video ref={video} playsInline muted aria-label="Anteprima fotocamera per il QR"/>{!running&&<div><Camera size={40}/><p>Inquadra il QR del biglietto da visita<br/>o il profilo di un utente Emily.</p></div>}</div><div className="action-row"><button className="primary" onClick={running?stop:start} disabled={pending}>{running?<Square size={17}/>:<Camera size={17}/>} {running?'Ferma fotocamera':pending?'Apertura…':'Apri fotocamera'}</button><label className="secondary file-button"><Upload size={17}/> Immagine o vCard<input type="file" accept="image/*,.vcf,text/vcard" onChange={e=>upload(e.target.files?.[0])}/></label></div>{error&&<p className="error" role="alert">{error}</p>}<label className="paste-label">Oppure incolla il link o il testo del QR<textarea rows={3} value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Link Emily, BEGIN:VCARD…, MECARD…" maxLength={100000}/></label><button className="secondary" disabled={!raw.trim()} onClick={()=>{stop();onRead(raw);}}>Leggi il contenuto</button><p className="photo-tip">I dati presenti nel QR compaiono in una scheda da verificare. Se il QR contiene solo un sito, viene salvato il link.</p></div>;
}
