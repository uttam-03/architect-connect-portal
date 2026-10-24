import { Router } from "express";
import { Portfolio, DesignerProfile, User, Op, sequelize } from "../models.js";
import { auth, roles } from "../middleware.js";
const router=Router();
router.get("/",async(req,res,next)=>{try{
 const {q,category,style,location}=req.query; const f={status:"published"};
 if(q)f[Op.or]=[{title:{[Op.like]:`%${q}%`}},{description:{[Op.like]:`%${q}%`}}];
 if(category)f.category={[Op.like]:`%${category}%`}; if(style)f.style={[Op.like]:`%${style}%`}; if(location)f.location={[Op.like]:`%${location}%`};
 res.json(await Portfolio.findAll({where:f,include:{model:User,as:"designer",attributes:["id","name","profileImage"]},order:[['createdAt','DESC']],limit:120}));
}catch(e){next(e)}});
router.get("/designer/mine",auth,roles("designer"),async(req,res,next)=>{try{res.json(await Portfolio.findAll({where:{designerId:req.user.id},order:[['createdAt','DESC']]}))}catch(e){next(e)}});
router.get("/:id",async(req,res,next)=>{try{const p=await Portfolio.findByPk(req.params.id,{include:{model:User,as:"designer",attributes:["id","name","profileImage"]}});if(!p||p.status!=="published")return res.status(404).json({message:"Portfolio not found"});await p.increment("views");res.json({...p.toJSON(),designerId:p.designer});}catch(e){next(e)}});
router.post("/",auth,roles("designer"),async(req,res,next)=>{try{const {title,category,description,location,year,budget,style,images=[]}=req.body;if(!title||!category||!description||(!Array.isArray(images)||!images.length||images.some(x=>typeof x!=="string"||!/^https?:\/\//.test(x))))return res.status(400).json({message:"Title, category, description and at least one image are required"});const p=await sequelize.transaction(async transaction=>{const p=await Portfolio.create({designerId:req.user.id,title,category,description,location,year,budget,style,images},{transaction});await DesignerProfile.increment("portfolioCount",{where:{userId:req.user.id},transaction});return p;});res.status(201).json(p)}catch(e){next(e)}});
router.put("/:id",auth,roles("designer"),async(req,res,next)=>{try{const p=await Portfolio.findOne({where:{id:req.params.id,designerId:req.user.id}});if(!p)return res.status(404).json({message:"Portfolio not found"});const allowed=["title","category","description","location","year","budget","style","images"];
const data=Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
if(data.images && (!Array.isArray(data.images)||!data.images.length||data.images.some(x=>typeof x!=="string"||!/^https?:\/\//.test(x)))) return res.status(400).json({message:"Valid image URLs required"});
await p.update(data);res.json(p)}catch(e){next(e)}});
router.delete("/:id",auth,roles("designer"),async(req,res,next)=>{try{const p=await Portfolio.findOne({where:{id:req.params.id,designerId:req.user.id}});if(!p)return res.status(404).json({message:"Portfolio not found"});await sequelize.transaction(async transaction=>{const deleted=await Portfolio.destroy({where:{id:p.id,designerId:req.user.id},transaction});if(deleted)await DesignerProfile.increment("portfolioCount",{where:{userId:req.user.id},by:-1,transaction});});res.json({deleted:true})}catch(e){next(e)}});
export default router;
