import React,{useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {UploadCloud,X,ImagePlus} from 'lucide-react';
import api from './api';
const LIMIT=300*1024;
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose JPEG, PNG or WebP photos.');
 if(file.size>20*1024*1024)throw new Error('Choose an original photo smaller than 20 MB.');
 const url=URL.createObjectURL(file);
 try{
 const picture=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This photo cannot be opened. Choose another file.'));img.src=url;});
 if(picture.naturalWidth*picture.naturalHeight>40000000)throw new Error('This photo is too large. Choose one below 40 megapixels.');
 const canvas=document.createElement('canvas');let scale=Math.min(1,1600/Math.max(picture.naturalWidth,picture.naturalHeight));
 let output;
 for(let attempt=0;attempt<8;attempt++){
 canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser cannot prepare photos.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(picture,0,0,canvas.width,canvas.height);
 output=canvas.toDataURL('image/jpeg',Math.max(.45,.85-attempt*.06));
 if(atob(output.split(',')[1]).length<=LIMIT)return {data:output.split(',')[1],preview:output,name:file.name};
 scale*=.8;
 }
 throw new Error('Photo could not be compressed. Choose a smaller image.');
 }finally{URL.revokeObjectURL(url);}
}
export function NewPortfolio(){
 const navigate=useNavigate();const input=useRef(null);
 const [form,setForm]=useState({title:'',category:'Residential',description:'',location:'',year:new Date().getFullYear(),budget:'',style:'Modern'});
 const [photos,setPhotos]=useState([]),[error,setError]=useState(''),[preparing,setPreparing]=useState(false),[saving,setSaving]=useState(false);
 const change=event=>setForm({...form,[event.target.name]:event.target.value});
 async function choose(event){
 const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;
 if(files.length+photos.length>4){setError('You can upload up to 4 photos per project.');return;}
 setError('');setPreparing(true);
 try{const next=[];for(const file of files)next.push(await preparePhoto(file));setPhotos(current=>[...current,...next]);}catch(e){setError(e.message);}finally{setPreparing(false);}
 }
 async function submit(event){
 event.preventDefault();if(!photos.length){setError('Add at least one project photo.');return;}
 setError('');setSaving(true);
 try{await api.post('/portfolios',{...form,title:form.title.trim(),description:form.description.trim(),year:Number(form.year),budget:form.budget===''?null:Number(form.budget),photos:photos.map(photo=>({data:photo.data}))});navigate('/dashboard');}
 catch(e){setError(e.response?.data?.message||'Unable to publish. Your form has been kept; please retry.');}finally{setSaving(false);}
 }
 const disabled=preparing||saving;
 return <div className="page project-editor"><div className="page-title"><p className="eyebrow">YOUR PORTFOLIO</p><h1>Share your latest project.</h1><p>Upload your own photos and tell clients a little about your work.</p></div><form className="panel form-grid" onSubmit={submit}>
 <label className="profile-field full">Project title<input required maxLength={180} name="title" value={form.title} onChange={change} placeholder="e.g. Courtyard family home"/></label>
 <label className="profile-field full">Short description<textarea required maxLength={500} name="description" value={form.description} onChange={change} placeholder="Describe the space, design approach and what makes this project special."/><span>{form.description.length}/500 characters</span></label>
 <div className="photo-upload full"><h2>Project photos</h2><p>Choose up to 4 JPEG, PNG or WebP photos. We resize them automatically. The first photo becomes your cover.</p><input ref={input} id="project-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled||photos.length===4} onChange={choose}/><button type="button" className="upload-drop" disabled={disabled||photos.length===4} onClick={()=>input.current?.click()}><UploadCloud size={30}/><strong>{preparing?'Preparing photos…':'Choose photos from your device'}</strong><span>Photos are saved with your project</span></button>
 <div className="upload-previews">{photos.map((photo,index)=><figure key={photo.name+'-'+index}><img src={photo.preview} alt={'Preview: '+photo.name}/><figcaption>{index===0?'Cover photo':`Photo ${index+1}`}</figcaption><button type="button" aria-label={'Remove '+photo.name} disabled={disabled} onClick={()=>setPhotos(photos.filter((_,i)=>i!==index))}><X size={17}/></button></figure>)}</div></div>
 <label className="profile-field">Category<select name="category" value={form.category} onChange={change}>{['Residential','Commercial','Hospitality','Institutional','Landscape','Renovation'].map(item=><option key={item}>{item}</option>)}</select></label>
 <label className="profile-field">Location<input name="location" maxLength={120} value={form.location} onChange={change} placeholder="City / project location"/></label>
 <label className="profile-field">Completion year<input type="number" min="1900" max={new Date().getFullYear()+5} name="year" value={form.year} onChange={change}/></label>
 <label className="profile-field">Project budget (₹, optional)<input type="number" min="0" step="1" max="9999999999" name="budget" value={form.budget} onChange={change}/></label>
 <label className="profile-field full">Design style<input name="style" maxLength={100} value={form.style} onChange={change}/></label>
 {error&&<p className="error full" role="alert">{error}</p>}<div className="actions full"><button className="btn" type="submit" disabled={disabled}>{saving?'Publishing…':preparing?'Preparing photos…':'Publish project'}</button><Link to="/dashboard" className="textlink">Back to dashboard</Link></div>
 </form></div>;
}
export function MyProjects({projects}){
 return <section className="panel"><div className="panel-head"><h2>Your projects</h2><Link to="/portfolios/new"><ImagePlus size={16}/> Add photos & project</Link></div>{projects.length?<div className="portfolio-grid">{projects.map(project=><Link key={project.id} className="project-card" to={`/portfolios/${project.id}`}>{project.images?.[0]&&<img src={project.images[0]} alt={project.title} loading="lazy"/>}<div><small>{project.category} · {project.location}</small><h3>{project.title}</h3><p className="project-summary">{project.description}</p><span>{project.images?.length||0} photos · {project.status}</span></div></Link>)}</div>:<p>Show clients what you can create. Add your first project with photos and a short description.</p>}</section>;
}
