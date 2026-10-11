import type {PercentCrop} from 'react-image-crop';

export function cropPixels(image:{naturalWidth:number;naturalHeight:number},crop:PercentCrop){
 const {naturalWidth:width,naturalHeight:height}=image;
 if(![width,height,crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)||width<=0||height<=0||crop.width<=0||crop.height<=0)throw Error('Scegli un riquadro valido per la foto.');
 const x=Math.max(0,crop.x)*width/100,y=Math.max(0,crop.y)*height/100;
 // Use original image pixels, so resizing the dialog never changes the result.
 const size=Math.min(crop.width*width/100,crop.height*height/100,width-x,height-y);
 if(size<1)throw Error('Il riquadro è troppo piccolo. Ingrandiscilo per ritagliare la foto.');
 return {x,y,size};
}

export async function cropPhoto(image:HTMLImageElement,crop:PercentCrop):Promise<Blob>{
 const {x,y,size}=cropPixels(image,crop);
 const canvas=document.createElement('canvas');
 canvas.width=600;canvas.height=600;
 const context=canvas.getContext('2d');
 if(!context)throw Error('Impossibile preparare la foto. Riprova.');
 context.fillStyle='#fff';context.fillRect(0,0,600,600);
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 context.drawImage(image,x,y,size,size,0,0,600,600);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Impossibile preparare la foto. Riprova.')),'image/jpeg',.88));
}
