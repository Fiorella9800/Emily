import {useRef,useState,type SyntheticEvent} from 'react';
import {Crop,RotateCcw} from 'lucide-react';
import ReactCrop,{centerCrop,makeAspectCrop,type PercentCrop} from 'react-image-crop';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {cropPhoto} from '@/lib/photo-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './photo-cropper.css';

const ariaLabels={
 cropArea:'Riquadro del volto: usa le frecce per spostarlo',
 nwDragHandle:'Ridimensiona dall’angolo in alto a sinistra',
 nDragHandle:'Ridimensiona dal bordo superiore',
 neDragHandle:'Ridimensiona dall’angolo in alto a destra',
 eDragHandle:'Ridimensiona dal bordo destro',
 seDragHandle:'Ridimensiona dall’angolo in basso a destra',
 sDragHandle:'Ridimensiona dal bordo inferiore',
 swDragHandle:'Ridimensiona dall’angolo in basso a sinistra',
 wDragHandle:'Ridimensiona dal bordo sinistro',
};

export default function PhotoCropper({source,onConfirm,onCancel}:{source:string;onConfirm:(photo:Blob)=>void;onCancel:()=>void}){
 const image=useRef<HTMLImageElement>(null);
 const [crop,setCrop]=useState<PercentCrop>(),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function reset(frame:HTMLImageElement){
  setCrop(centerCrop(makeAspectCrop({unit:'%',width:90},1,frame.naturalWidth,frame.naturalHeight),frame.naturalWidth,frame.naturalHeight));
 }
 function loaded(e:SyntheticEvent<HTMLImageElement>){reset(e.currentTarget);setReady(true);setError('');}
 async function confirm(){
  if(!image.current||!crop||!ready||busy)return;
  setBusy(true);setError('');
  try{onConfirm(await cropPhoto(image.current,crop));}
  catch(e){setError((e as Error).message);setBusy(false);}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onCancel();}}>
  <DialogContent className="photo-crop-dialog" showCloseButton={!busy} onInteractOutside={event=>event.preventDefault()}>
   <div className="photo-crop-heading"><Crop size={20}/><DialogTitle>Ritaglia la foto</DialogTitle></div>
   <DialogDescription>Trascina il riquadro per centrare il volto. Usa gli angoli per rimpicciolirlo o ingrandirlo.</DialogDescription>
   <div className="photo-crop-stage" aria-busy={!ready&&!error}>
    {!ready&&!error&&<p className="photo-crop-loading" role="status">Apertura della foto…</p>}
    <ReactCrop crop={crop} aspect={1} keepSelection minWidth={40} minHeight={40} disabled={busy||!ready} ariaLabels={ariaLabels} onChange={(_,percent)=>setCrop(percent)} renderSelectionAddon={()=><span className="photo-crop-circle" aria-hidden="true"/>}>
     <img ref={image} src={source} alt="Foto da ritagliare" onLoad={loaded} onError={()=>{setReady(false);setError('Impossibile aprire questa foto. Prova un’altra immagine o uno screenshot.');}} draggable={false}/>
    </ReactCrop>
   </div>
   <div className="photo-crop-tools"><span>Puoi usare anche le frecce della tastiera.</span><button type="button" disabled={!ready||busy} onClick={()=>image.current&&reset(image.current)}><RotateCcw size={14}/> Ripristina riquadro</button></div>
   {error&&<p className="error" role="alert">{error}</p>}
   <div className="photo-crop-actions"><button type="button" className="primary" disabled={!ready||!crop||busy} onClick={confirm}>{busy?'Preparazione della foto…':'Imposta foto profilo'}</button><button type="button" className="text-button" disabled={busy} onClick={onCancel}>Annulla</button></div>
  </DialogContent>
 </Dialog>;
}
