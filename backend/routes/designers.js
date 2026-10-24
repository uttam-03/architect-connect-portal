import { Router } from "express";
import { User, DesignerProfile, Portfolio, Review, SavedDesigner, Op } from "../models.js";
import { auth, roles } from "../middleware.js";
const router=Router();
router.use('/profile', (req,res,next)=>{
 if(!['POST','PUT'].includes(req.method))return next();
 const b=req.body;
 for(const key of ['budgetMin','budgetMax','architectFeeMin','architectFeeMax','materialBudgetMin','materialBudgetMax','experience']){
 if(b[key]!==undefined&&(!Number.isFinite(Number(b[key]))||Number(b[key])<0))return res.status(400).json({message:'Budgets and experience must be non-negative numbers'});
 }
 for(const [min,max] of [['budgetMin','budgetMax'],['architectFeeMin','architectFeeMax'],['materialBudgetMin','materialBudgetMax']])if(b[min]!=null&&b[max]!=null&&Number(b[min])>Number(b[max]))return res.status(400).json({message:'Minimum cannot exceed maximum'});
 for(const key of ['expertise','specialization','designStyles'])if(b[key]!==undefined&&(!Array.isArray(b[key])||b[key].some(x=>typeof x!=='string')))return res.status(400).json({message:'Styles and expertise must be lists of text'});
 next();
});

const profileJson=(p,u)=>({ ...p.toJSON(), userId:u ? {id:u.id,name:u.name,email:u.email,profileImage:u.profileImage,phone:u.phone}:p.userId });
router.get("/",async(req,res,next)=>{try{
 const {q,location,style,profession,minBudget,maxBudget,minExperience,sort="rating"}=req.query;
 const where={role:"designer",isActive:true};
 if(q) where.name={[Op.like]:`%${q}%`};
 const users=await User.findAll({where,attributes:["id","name","email","profileImage"]});
 const ids=users.map(u=>u.id); if(!ids.length)return res.json([]);
 const pf={userId:{[Op.in]:ids}};
 if(location)pf.location={[Op.like]:`%${location}%`};
 if(profession)pf.professionalTitle={[Op.like]:`%${profession}%`};
 if(minExperience)pf.experience={[Op.gte]:Number(minExperience)};
 if(minBudget)pf.budgetMax={[Op.gte]:Number(minBudget)};
 if(maxBudget)pf.budgetMin={[Op.lte]:Number(maxBudget)};
 const profiles=await DesignerProfile.findAll({where:pf,include:{model:User,as:"user",attributes:["id","name","email","profileImage"]},order:sort==="experience"?[['experience','DESC']]:sort==="newest"?[['createdAt','DESC']]:sort==="popularity"?[['views','DESC']]:[['rating','DESC']],limit:50});
 let out=profiles.map(p=>profileJson(p,p.user));
 if(style)out=out.filter(p=>(p.designStyles||[]).some(s=>String(s).toLowerCase().includes(style.toLowerCase())));
 res.json(out);
}catch(e){next(e)}});
router.get("/client/saved",auth,roles("client"),async(req,res,next)=>{try{
 const rows=await SavedDesigner.findAll({where:{clientId:req.user.id},include:{model:User,as:"designer",attributes:["id","name","email","profileImage"]}}); res.json(rows.map(r=>({...r.toJSON(),designerId:r.designer})));
}catch(e){next(e)}});
router.get("/:id",async(req,res,next)=>{try{
 const p=await DesignerProfile.findOne({where:{userId:req.params.id},include:{model:User,as:"user",attributes:["id","name","email","phone","profileImage","isActive"]}});
 if(!p||!p.user?.isActive)return res.status(404).json({message:"Designer not found"});
 await p.increment("views");
 const portfolios=await Portfolio.findAll({where:{designerId:req.params.id,status:"published"},order:[['createdAt','DESC']]});
 const reviews=await Review.findAll({where:{designerId:req.params.id},include:{model:User,as:"client",attributes:["id","name"]},order:[['createdAt','DESC']],limit:20});
 res.json({profile:profileJson(p,p.user),portfolios,reviews:reviews.map(r=>({...r.toJSON(),clientId:r.client}))});
}catch(e){next(e)}});
router.post("/profile",auth,roles("designer"),async(req,res,next)=>{try{
 const allowed=["professionalTitle","bio","expertise","specialization","experience","location","budgetMin","budgetMax","architectFeeMin","architectFeeMax","materialBudgetMin","materialBudgetMax","designStyles","profileImage"];
 const data=Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
 if(data.budgetMin!=null&&data.budgetMax!=null&&Number(data.budgetMin)>Number(data.budgetMax))return res.status(400).json({message:"Minimum budget cannot exceed maximum budget"});
 const [p]=await DesignerProfile.findOrCreate({where:{userId:req.user.id},defaults:data}); if(p.userId===req.user.id)await p.update(data); res.json(p);
}catch(e){next(e)}});
router.put("/profile",auth,roles("designer"),async(req,res,next)=>{try{
 const allowed=["professionalTitle","bio","expertise","specialization","experience","location","budgetMin","budgetMax","architectFeeMin","architectFeeMax","materialBudgetMin","materialBudgetMax","designStyles","profileImage"];
 const data=Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
 if(data.budgetMin!=null&&data.budgetMax!=null&&Number(data.budgetMin)>Number(data.budgetMax))return res.status(400).json({message:"Minimum budget cannot exceed maximum budget"});
 const p=await DesignerProfile.findOne({where:{userId:req.user.id}}); if(!p)return res.status(404).json({message:"Profile not found"}); await p.update(data); res.json(p);
}catch(e){next(e)}});
router.post("/:id/save",auth,roles("client"),async(req,res,next)=>{try{const designer=await User.findOne({where:{id:req.params.id,role:"designer",isActive:true}});if(!designer)return res.status(404).json({message:"Designer not found"});await SavedDesigner.findOrCreate({where:{clientId:req.user.id,designerId:req.params.id}});res.status(201).json({saved:true})}catch(e){if(e.name==="SequelizeUniqueConstraintError")return res.status(409).json({message:"Already saved"});next(e)}});
router.delete("/:id/save",auth,roles("client"),async(req,res,next)=>{try{await SavedDesigner.destroy({where:{clientId:req.user.id,designerId:req.params.id}});res.json({saved:false})}catch(e){next(e)}});
export default router;
