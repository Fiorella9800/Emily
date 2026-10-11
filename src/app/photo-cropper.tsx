import {usePreferences} from '@/preferences';
import {useRef,useState,type SyntheticEvent} from 'react';
import {Crop,RotateCcw} from 'lucide-react';
import ReactCrop,{centerCrop,makeAspectCrop,type PercentCrop} from 'react-image-crop';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {cropPhoto} from '@/lib/photo-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './photo-cropper.css';



export default function PhotoCropper({source,onConfirm,onCancel}:{source:string;onConfirm:(photo:Blob)=>void;onCancel:()=>void}){
 const {t}=usePreferences();
const ariaLabels={
 cropArea:t("Riquadro del volto: usa le frecce per spostarlo"),
 nwDragHandle:t("Ridimensiona dall’angolo in alto a sinistra"),
 nDragHandle:t("Ridimensiona dal bordo superiore"),
 neDragHandle:t("Ridimensiona dall’angolo in alto a destra"),
 eDragHandle:t("Ridimensiona dal bordo destro"),
 seDragHandle:t("Ridimensiona dall’angolo in basso a destra"),
 sDragHandle:t("Ridimensiona dal bordo inferiore"),
 swDragHandle:t("Ridimensiona dall’angolo in basso a sinistra"),
 wDragHandle:t("Ridimensiona dal bordo sinistro"),
};
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
   <div className="photo-crop-heading"><Crop size={20}/><DialogTitle>{t("Ritaglia la foto")}</DialogTitle></div>
   <DialogDescription>{t("Trascina il riquadro per centrare il volto. Usa gli angoli per rimpicciolirlo o ingrandirlo.")}</DialogDescription>
   <div className="photo-crop-stage" aria-busy={!ready&&!error}>
    {!ready&&!error&&<p className="photo-crop-loading" role="status">{t("Apertura della foto…")}</p>}
    <ReactCrop crop={crop} aspect={1} keepSelection minWidth={40} minHeight={40} disabled={busy||!ready} ariaLabels={ariaLabels} onChange={(_,percent)=>setCrop(percent)} renderSelectionAddon={()=><span className="photo-crop-circle" aria-hidden="true"/>}>
     <img ref={image} src={source} alt={t("Foto da ritagliare")} onLoad={loaded} onError={()=>{setReady(false);setError(t("Impossibile aprire questa foto. Prova un’altra immagine o uno screenshot."));}} draggable={false}/>
    </ReactCrop>
   </div>
   <div className="photo-crop-tools"><span>{t("Puoi usare anche le frecce della tastiera.")}</span><button type="button" disabled={!ready||busy} onClick={()=>image.current&&reset(image.current)}><RotateCcw size={14}/> {t("Ripristina riquadro")}</button></div>
   {error&&<p className="error" role="alert">{t(error)}</p>}
   <div className="photo-crop-actions"><button type="button" className="primary" disabled={!ready||!crop||busy} onClick={confirm}>{busy?t("Preparazione della foto…"):t("Imposta foto profilo")}</button><button type="button" className="text-button" disabled={busy} onClick={onCancel}>{t("Annulla")}</button></div>
  </DialogContent>
 </Dialog>;
}
