import React,{useEffect,useState} from 'react';
import api from './api';
let checkout;
function loadCheckout(){
 if(window.Razorpay)return Promise.resolve();
 if(!checkout)checkout=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=resolve;s.onerror=()=>{checkout=null;reject(new Error('Unable to load secure checkout'))};document.body.appendChild(s)});
 return checkout;
}
export function PaymentPanel({inquiry,role}){
 const [record,setRecord]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=()=>api.get(`/payments/inquiry/${inquiry.id}`).then(r=>setRecord(r.data)).catch(()=>setMessage('Unable to load payment status'));
 useEffect(()=>{refresh();const timer=setInterval(refresh,15000);return()=>clearInterval(timer)},[inquiry.id]);
 const pay=async()=>{setBusy(true);setMessage('');try{
 await loadCheckout();const {data:o}=await api.post('/payments/orders',{inquiryId:inquiry.id});
 const widget=new window.Razorpay({key:o.key,order_id:o.orderId,amount:o.amount,currency:o.currency,name:'Arch + Connect',description:'Professional design fee',theme:{color:'#24594f'},handler:async response=>{
 try{const {data}=await api.post('/payments/verify',response);setMessage(data.status==='paid'?'Payment confirmed. Thank you.':'Awaiting capture. Status will refresh automatically.');await refresh()}catch(e){setMessage(e.response?.data?.message||'Verification pending. Refresh status before retrying.')}finally{setBusy(false)}},modal:{ondismiss:()=>{setBusy(false);setMessage('Checkout closed. No confirmed payment yet.');refresh()}}});
 widget.on('payment.failed',()=>{setMessage('Payment failed. You can retry the same order.');setBusy(false);refresh()});widget.open();
 }catch(e){setMessage(e.response?.data?.message||e.message);setBusy(false);refresh()}};
 return <section className="panel payment-panel"><p className="eyebrow">SECURE PAYMENTS · RAZORPAY</p><h2>Professional design fee</h2><p>₹{Number(inquiry.architectFeeBudget||0).toLocaleString('en-IN')} <small>Materials are paid separately by agreement.</small></p><div className="actions"><span className={`status ${record?.status==='paid'?'completed':''}`}>{record?.status||'Not paid'}</span><button className="btn secondary" onClick={refresh}>Refresh status</button>{role==='client'&&['accepted','completed'].includes(inquiry.status)&&record?.status!=='paid'&&<button className="btn" disabled={busy} onClick={pay}>{busy?'Processing…':'Pay design fee'}</button>}</div>{record?.paymentId&&<p className="receipt">Receipt: {record.paymentId} · ₹{(record.amount/100).toLocaleString('en-IN')}</p>}{message&&<p role="status">{message}</p>}<small>Payments go to the platform merchant account. Designer settlement is arranged separately. Test keys process simulated payments only.</small></section>
}
export function ReviewForm({inquiryId}){
 const [rating,setRating]=useState(5),[comment,setComment]=useState(''),[message,setMessage]=useState('');
 async function submit(e){e.preventDefault();try{await api.post('/reviews',{inquiryId,rating:Number(rating),comment});setMessage('Review submitted. Thank you.');setComment('')}catch(e){setMessage(e.response?.data?.message||'Unable to submit review')}}
 return <form className="panel form-grid" onSubmit={submit}><h2 className="full">Share your experience</h2><select aria-label="Rating" value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} stars</option>)}</select><textarea required maxLength={3000} aria-label="Review" value={comment} onChange={e=>setComment(e.target.value)} placeholder="How was your design experience?"/><button className="btn">Submit review</button><p role="status">{message}</p></form>
}
