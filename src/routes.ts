export const appPath=new URL(import.meta.env.BASE_URL,window.location.href).pathname;
export const shareLink=(token:string)=>window.location.origin+appPath+'?share='+token;
