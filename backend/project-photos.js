import crypto from 'node:crypto';
import {ProjectImage} from './models.js';
export const MAX_PHOTOS=4;
export const MAX_PHOTO_BYTES=300*1024;
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function decodePhotos(photos=[]){
 if(!Array.isArray(photos)||photos.length>MAX_PHOTOS)fail('Choose up to 4 project photos.');
 return photos.map(photo=>{
 const text=photo?.data;
 if(typeof text!=='string'||text.length>Math.ceil(MAX_PHOTO_BYTES/3)*4||!text.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(text))fail('Invalid photo or photo exceeds 300 KB after compression.');
 const data=Buffer.from(text,'base64');if(data.toString('base64')!==text||data.length>MAX_PHOTO_BYTES)fail('Invalid photo encoding.');
 let mimeType;
 if(data.length>=12&&data[0]===255&&data[1]===216&&data[2]===255&&data[data.length-2]===255&&data[data.length-1]===217)mimeType='image/jpeg';
 else if(data.length>=33&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&data.toString('ascii',12,16)==='IHDR'&&data.readUInt32BE(16)>0&&data.readUInt32BE(20)>0&&data.readUInt32BE(16)<=16000&&data.readUInt32BE(20)<=16000)mimeType='image/png';
 else if(data.length>=20&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'&&data.readUInt32LE(4)===data.length-8)mimeType='image/webp';
 else fail('Only JPEG, PNG and WebP photos are supported.');
 return {data,mimeType,byteLength:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
 });
}
export function validateImageLinks(images){
 if(!Array.isArray(images)||images.length>MAX_PHOTOS||images.some(url=>typeof url!=='string'||url.length>2048||!(/^https?:\/\//i.test(url)||/^\/api\/portfolios\/images\/[0-9a-f-]{36}$/i.test(url))))fail('Use valid image URLs or upload a photo.');
 return images;
}
export async function storePhotos(portfolio,photos,transaction){
 const urls=[];
 for(const photo of photos){const row=await ProjectImage.create({...photo,portfolioId:portfolio.id},{transaction});urls.push(`/api/portfolios/images/${row.id}`);}
 return urls;
}
export async function assertOwnedImageLinks(images,portfolioId,transaction){
 for(const url of images.filter(url=>url.startsWith('/api/portfolios/images/'))){
 const asset=await ProjectImage.findOne({where:{id:url.split('/').pop(),portfolioId},transaction});if(!asset)fail('This uploaded photo does not belong to your project.');
 }
}
