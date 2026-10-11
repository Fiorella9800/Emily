import {test} from 'node:test';
import assert from 'node:assert/strict';
import {centerCrop,makeAspectCrop} from 'react-image-crop';
import {cropPixels,cropPhoto} from '../src/lib/photo-crop.ts';

test('portrait, landscape and square images open with a centered square selection inside the photo',()=>{
 for(const [width,height] of [[800,1200],[1200,800],[1000,1000]]){
  const crop=centerCrop(makeAspectCrop({unit:'%',width:90},1,width,height),width,height);
  const pixels=cropPixels({naturalWidth:width,naturalHeight:height},crop);
  assert.ok(pixels.x>=0&&pixels.y>=0);
  assert.ok(pixels.x+pixels.size<=width+.0001);
  assert.ok(pixels.y+pixels.size<=height+.0001);
  assert.ok(Math.abs(pixels.x-(width-pixels.size)/2)<.0001);
  assert.ok(Math.abs(pixels.y-(height-pixels.size)/2)<.0001);
 }
});

test('moving and resizing the selection exports the selected original pixels, regardless of the displayed image size',()=>{
 const image={naturalWidth:1200,naturalHeight:800,width:300,height:200};
 const crop={unit:'%',x:25,y:10,width:40,height:60};
 assert.deepEqual(cropPixels(image,crop),{x:300,y:80,size:480});
 assert.deepEqual(cropPixels({...image,width:600,height:400},crop),{x:300,y:80,size:480});
 assert.deepEqual(cropPixels(image,{...crop,x:35,y:20,width:20,height:30}),{x:420,y:160,size:240});
});

test('the crop stays inside the source even with fractional edge coordinates and rejects empty selections',()=>{
 const image={naturalWidth:800,naturalHeight:1200};
 const edge=cropPixels(image,{unit:'%',x:50,y:80,width:60,height:40});
 assert.deepEqual(edge,{x:400,y:960,size:240});
 for(const crop of [
  {unit:'%',x:0,y:0,width:0,height:0},
  {unit:'%',x:101,y:0,width:10,height:10},
  {unit:'%',x:NaN,y:0,width:10,height:10},
 ])assert.throws(()=>cropPixels(image,crop));
});

test('confirmation produces the same square JPEG format used by profile and contact uploads',async()=>{
 const originalDocument=globalThis.document,calls=[];
 const image={naturalWidth:1200,naturalHeight:800};
 const jpeg=new Blob(['fixture-jpeg'],{type:'image/jpeg'});
 const context={fillRect:(...args)=>calls.push(['fill',...args]),drawImage:(...args)=>calls.push(['draw',...args])};
 const canvas={getContext:()=>context,toBlob:(callback,type,quality)=>{calls.push(['encode',type,quality]);callback(jpeg);}};
 globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas;}};
 try{
  const result=await cropPhoto(image,{unit:'%',x:25,y:10,width:40,height:60});
  assert.equal(result,jpeg);assert.equal(result.type,'image/jpeg');
  assert.equal(canvas.width,600);assert.equal(canvas.height,600);
  assert.equal(context.fillStyle,'#fff');
  assert.deepEqual(calls,[['fill',0,0,600,600],['draw',image,300,80,480,480,0,0,600,600],['encode','image/jpeg',.88]]);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});

test('an export failure rejects instead of returning an empty photo',async()=>{
 const originalDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(null)})};
 try{
  await assert.rejects(()=>cropPhoto({naturalWidth:100,naturalHeight:100},{unit:'%',x:0,y:0,width:90,height:90}),/Impossibile preparare/);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
