import {Router} from 'express';
import crypto from 'node:crypto';
import {Payment, Inquiry} from '../models.js';
import {auth,roles} from '../middleware.js';
const router=Router();
export function validSignature(body,signature,secret){if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;return crypto.timingSafeEqual(crypto.createHmac('sha256',secret).update(body).digest(),Buffer.from(signature,'hex'));}
async function gateway(endpoint,method='GET',body){
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)throw Object.assign(new Error('Configure Razorpay keys to enable payments'),{status:503});
 const r=await fetch(`https://api.razorpay.com/v1/${endpoint}`,{method,headers:{Authorization:`Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Object.assign(new Error('Payment provider unavailable'),{status:502});return r.json();
}
async function reconcile(record,p){
 if(p.order_id!==record.orderId||p.amount!==record.amount||p.currency!==record.currency)throw Object.assign(new Error('Payment details mismatch'),{status:400});
 if(p.status==='captured')await record.update({paymentId:p.id,status:'paid'});return record;
}
router.get('/inquiry/:id',auth,async(req,res,next)=>{try{
 const i=await Inquiry.findByPk(req.params.id);if(!i)return res.sendStatus(404);
 if(req.user.role!=='admin'&&![i.clientId,i.designerId].includes(req.user.id))return res.sendStatus(403);
 res.json(await Payment.findOne({where:{inquiryId:i.id}}));
}catch(e){next(e)}});
router.post('/orders',auth,roles('client'),async(req,res,next)=>{try{
 if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return res.status(503).json({message:'Payment setup pending: configure Razorpay keys'});
 const i=await Inquiry.findOne({where:{id:req.body.inquiryId,clientId:req.user.id}});if(!i)return res.sendStatus(404);
 if(!['accepted','completed'].includes(i.status))return res.status(409).json({message:'Designer must accept first'});
 const amount=Math.round(Number(i.architectFeeBudget)*100);
 if(!Number.isSafeInteger(amount)||amount<100||amount>1000000000)return res.status(400).json({message:'Valid design fee (₹1 to ₹1,00,00,000) required'});
 const [record]=await Payment.findOrCreate({where:{inquiryId:i.id},defaults:{clientId:req.user.id,amount,currency:'INR'}});
 if(record.status==='paid')return res.status(409).json({message:'Already paid'});
 const [claim]=await Payment.update({status:'creating'},{where:{id:record.id,status:'created',orderId:null}});
 if(claim){const o=await gateway('orders','POST',{amount:record.amount,currency:'INR',receipt:record.id,notes:{inquiryId:i.id}});await record.update({orderId:o.id,status:'created'});}else await record.reload();
 if(!record.orderId)return res.status(409).json({message:'Order awaiting reconciliation. Contact support before retrying.'});
 const order=await gateway(`orders/${encodeURIComponent(record.orderId)}`);
 if(order.status==='paid'){
 const list=await gateway(`orders/${encodeURIComponent(record.orderId)}/payments`);const paid=list.items?.find(p=>p.status==='captured');if(paid)await reconcile(record,paid);
 return res.status(409).json({message:'Already paid. Refresh payment status.'});}
 res.json({key:process.env.RAZORPAY_KEY_ID,orderId:record.orderId,amount:record.amount,currency:'INR',testMode:process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')});
}catch(e){next(e)}});
router.post('/verify',auth,roles('client'),async(req,res,next)=>{try{
 const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
 const record=await Payment.findOne({where:{orderId:razorpay_order_id||'',clientId:req.user.id}});if(!record)return res.sendStatus(404);
 if(!validSignature(`${record.orderId}|${razorpay_payment_id}`,razorpay_signature,process.env.RAZORPAY_KEY_SECRET))return res.status(400).json({message:'Invalid signature'});
 if(typeof razorpay_payment_id!=='string'||!/^pay_[a-zA-Z0-9]+$/.test(razorpay_payment_id))return res.sendStatus(400);
 await reconcile(record,await gateway(`payments/${encodeURIComponent(razorpay_payment_id)}`));res.json({status:record.status});
}catch(e){next(e)}});
export async function webhook(req,res,next){try{
 if(!validSignature(req.body,req.headers['x-razorpay-signature'],process.env.RAZORPAY_WEBHOOK_SECRET))return res.sendStatus(400);
 const event=JSON.parse(req.body.toString());const p=event.payload?.payment?.entity;
 if(['payment.captured','order.paid'].includes(event.event)&&p?.order_id){const r=await Payment.findOne({where:{orderId:p.order_id}});if(r)await reconcile(r,p);}
 res.json({received:true});
}catch(e){next(e)}}
export default router;
