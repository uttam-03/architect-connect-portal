import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'arch-test-'));
process.env.SQLITE_PATH=path.join(dir,'test.sqlite');process.env.JWT_SECRET='test-secret-with-at-least-32-characters';process.env.RAZORPAY_WEBHOOK_SECRET='webhook-secret';
const {sequelize,User,Inquiry,Portfolio,Payment}=await import('../models.js');
const {validSignature}=await import('../routes/payments.js');
let child;
const base='http://127.0.0.1:5087/api';
async function request(route,method='GET',body,token){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>null)}}
async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5087',AUTO_BACKUP:'false'},stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',x=>logs+=x);for(let i=0;i<100;i++){try{if((await request('/health')).status===200)return}catch{}if(child.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,100))}throw new Error(logs||'Startup timeout')}
async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM')})}
test('auth, permissions, project lifecycle, payments and persistence',async t=>{
 try{
 await start();
 const register=async(name,role)=>{const r=await request('/auth/register','POST',{name,email:`${name}@example.com`,password:'Testing@12345',role});assert.equal(r.status,201);return r.data};
 const c=await register('client','client'),d=await register('designer','designer'),other=await register('other','designer');
 assert.equal((await request('/designers/profile','PUT',{architectFeeMin:45000,architectFeeMax:120000},d.token)).status,200);
 const directory=await request('/designers');const card=directory.data.find(p=>p.userId.id===d.user.id);assert.equal(Number(card.architectFeeMin),45000);assert.equal(Number(card.architectFeeMax),120000);
 const profile=await request(`/designers/${d.user.id}`);assert.equal(Number(profile.data.profile.architectFeeMin),45000);

 const invalid=await request('/auth/register','POST',{name:'Bad',email:'invalid',password:'Testing@12345'});assert.equal(invalid.status,400);
 const created=await request('/inquiries','POST',{designerId:d.user.id,title:'Home',description:'Design project',budget:30000,architectFeeBudget:10000,materialBudget:20000},c.token);assert.equal(created.status,201);const id=created.data.id;
 let detail=await request(`/inquiries/${id}`,'GET',null,c.token);assert.equal(Number(detail.data.inquiry.architectFeeBudget),10000);assert.equal(detail.data.inquiry.clientId.name,'client');
 assert.equal((await request(`/inquiries/${id}`,'GET',null,other.token)).status,403);
 assert.equal((await request(`/inquiries/${id}`,'PUT',{status:'completed'},c.token)).status,409);
 assert.equal((await request(`/inquiries/${id}`,'PUT',{status:'accepted'},d.token)).status,200);
 assert.equal((await request(`/inquiries/${id}/messages`,'POST',{message:'Hello'},c.token)).status,201);
 const portfolio=await request('/portfolios','POST',{title:'Test',category:'Residential',description:'A project',images:['https://example.com/a.jpg']},d.token);assert.equal(portfolio.status,201);
 await request(`/portfolios/${portfolio.data.id}`,'PUT',{designerId:other.user.id,status:'rejected',views:999},d.token);
 const saved=await Portfolio.findByPk(portfolio.data.id);assert.equal(saved.designerId,d.user.id);assert.equal(saved.status,'published');assert.equal(saved.views,0);
 assert.equal((await request(`/inquiries/${id}`,'PUT',{status:'completed'},c.token)).status,200);
 assert.equal((await request('/reviews','POST',{inquiryId:id,rating:4.5,comment:'Great'},c.token)).status,400);
 assert.equal((await request('/reviews','POST',{inquiryId:id,rating:5,comment:'Great'},c.token)).status,201);
 assert.equal((await request('/reviews','POST',{inquiryId:id,rating:5,comment:'Again'},c.token)).status,409);
 const payment=await Payment.create({inquiryId:id,clientId:c.user.id,orderId:'order_test',amount:1000000,currency:'INR'});
 const body=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_test',order_id:'order_test',amount:1000000,currency:'INR',status:'captured'}}}});
 const secret='webhook-secret';assert(validSignature(body,crypto.createHmac('sha256',secret).update(body).digest('hex'),secret));assert(!validSignature(body,'bad',secret));
 const signature=crypto.createHmac('sha256',secret).update(body).digest('hex');
 for(let replay=0;replay<2;replay++){
 const result=await fetch(base+'/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':signature},body});assert.equal(result.status,200);
 }
 await payment.reload();assert.equal(payment.status,'paid');assert.equal(payment.paymentId,'pay_test');
 const tampered=await fetch(base+'/payments/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':signature},body:body.replace('1000000','999')});assert.equal(tampered.status,400);

 assert.equal((await request('/payments/verify','POST',{razorpay_order_id:'order_test',razorpay_payment_id:'pay_test',razorpay_signature:'0'.repeat(64)},c.token)).status,400);
 await stop();await start();
 const persisted=await request(`/inquiries/${id}`,'GET',null,c.token);assert.equal(persisted.data.inquiry.status,'completed');assert.equal(persisted.data.messages.length,1);
 const {backup}=await import('../backup.js');const file=await backup();assert(fs.statSync(file).size>0);
 console.log('PASS: fees persist; role checks; immutable ownership; valid transitions; duplicate review rejection; signature checks; restart persistence; SQLite backup');
 }finally{await stop();await sequelize.close();fs.rmSync(dir,{recursive:true,force:true})}
});
