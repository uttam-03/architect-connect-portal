import { Router } from "express";
import { Portfolio, DesignerProfile, User, Op, sequelize, ProjectImage } from "../models.js";
import {decodePhotos,validateImageLinks,storePhotos,assertOwnedImageLinks,MAX_PHOTOS} from "../project-photos.js";
import { auth, roles } from "../middleware.js";
const router=Router();
router.get("/",async(req,res,next)=>{try{
 const {q,category,style,location}=req.query; const f={status:"published"};
 if(q)f[Op.or]=[{title:{[Op.like]:`%${q}%`}},{description:{[Op.like]:`%${q}%`}}];
 if(category)f.category={[Op.like]:`%${category}%`}; if(style)f.style={[Op.like]:`%${style}%`}; if(location)f.location={[Op.like]:`%${location}%`};
 res.json(await Portfolio.findAll({where:f,include:{model:User,as:"designer",attributes:["id","name","profileImage"]},order:[['createdAt','DESC']],limit:120}));
}catch(e){next(e)}});
router.get("/designer/mine",auth,roles("designer"),async(req,res,next)=>{try{res.json(await Portfolio.findAll({where:{designerId:req.user.id},order:[['createdAt','DESC']]}))}catch(e){next(e)}});
router.get("/images/:id",async(req,res,next)=>{try{
 const photo=await ProjectImage.unscoped().findByPk(req.params.id);
 if(!photo)return res.sendStatus(404);
 const visible=await Portfolio.findOne({where:{id:photo.portfolioId,status:"published"},attributes:["id"]});if(!visible)return res.sendStatus(404);
 res.set({"Content-Type":photo.mimeType,"X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=86400","ETag":'"'+photo.sha256+'"'});
 if(req.headers['if-none-match']==='"'+photo.sha256+'"')return res.status(304).end();
 res.send(photo.data);
}catch(e){next(e)}});
router.get("/:id",async(req,res,next)=>{try{const p=await Portfolio.findByPk(req.params.id,{include:{model:User,as:"designer",attributes:["id","name","profileImage"]}});if(!p||p.status!=="published")return res.status(404).json({message:"Portfolio not found"});await p.increment("views");res.json({...p.toJSON(),designerId:p.designer});}catch(e){next(e)}});
router.post("/",auth,roles("designer"),async(req,res,next)=>{try{
 const {title,category,description,location,year,budget,style}=req.body;
 if(typeof title!=="string"||!title.trim()||title.length>180||typeof category!=="string"||!category.trim()||category.length>100||typeof description!=="string"||!description.trim()||description.length>3000)return res.status(400).json({message:"Project title, category and description (up to 3000 characters) are required."});
 const photos=decodePhotos(req.body.photos);const images=validateImageLinks(req.body.images||[]);
 if(!images.length&&!photos.length)return res.status(400).json({message:"Upload at least one project photo."});
 if(images.length+photos.length>MAX_PHOTOS)return res.status(400).json({message:"A project can have up to 4 photos."});
 if(images.some(url=>url.startsWith('/api/portfolios/images/')))return res.status(400).json({message:"Upload your own photos for a new project."});
 if(budget!=null&&(!Number.isFinite(Number(budget))||Number(budget)<0))return res.status(400).json({message:"Budget must be a valid non-negative amount."});
 const p=await sequelize.transaction(async transaction=>{
 const p=await Portfolio.create({designerId:req.user.id,title:title.trim(),category:category.trim(),description:description.trim(),location,year,budget,style,images},{transaction});
 const uploaded=await storePhotos(p,photos,transaction);await p.update({images:[...images,...uploaded]},{transaction});
 await DesignerProfile.increment("portfolioCount",{where:{userId:req.user.id},transaction});return p;
 });res.status(201).json(p);
}catch(e){next(e)}});
router.put("/:id",auth,roles("designer"),async(req,res,next)=>{try{
 const p=await Portfolio.findOne({where:{id:req.params.id,designerId:req.user.id}});if(!p)return res.status(404).json({message:"Portfolio not found"});
 const allowed=["title","category","description","location","year","budget","style"];
 const data=Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
 if(data.description!==undefined&&(typeof data.description!=="string"||!data.description.trim()||data.description.length>3000))return res.status(400).json({message:"A valid description is required."});
 const photos=decodePhotos(req.body.photos);
 const images=req.body.images===undefined?p.images:validateImageLinks(req.body.images);
 if(!images.length&&!photos.length||images.length+photos.length>MAX_PHOTOS)return res.status(400).json({message:"A project needs 1 to 4 photos."});
 await sequelize.transaction(async transaction=>{
 await assertOwnedImageLinks(images,p.id,transaction);
 const uploaded=await storePhotos(p,photos,transaction);await p.update({...data,images:[...images,...uploaded]},{transaction});
 const retained=p.images.filter(url=>url.startsWith('/api/portfolios/images/')).map(url=>url.split('/').pop());
 await ProjectImage.destroy({where:{portfolioId:p.id,...(retained.length?{id:{[Op.notIn]:retained}}:{})},transaction});
 });res.json(p);
}catch(e){next(e)}});
router.delete("/:id",auth,roles("designer"),async(req,res,next)=>{try{const p=await Portfolio.findOne({where:{id:req.params.id,designerId:req.user.id}});if(!p)return res.status(404).json({message:"Portfolio not found"});await sequelize.transaction(async transaction=>{const deleted=await Portfolio.destroy({where:{id:p.id,designerId:req.user.id},transaction});if(deleted)await DesignerProfile.increment("portfolioCount",{where:{userId:req.user.id},by:-1,transaction});});res.json({deleted:true})}catch(e){next(e)}});
export default router;
