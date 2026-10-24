import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, DesignerProfile, sequelize } from "../models.js";
import { auth } from "../middleware.js";
const router = Router();
router.use(rateLimit({windowMs:15*60*1000,limit:30}));
const tokenFor = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone, profileImage: u.profileImage });
router.post("/register", async (req,res,next)=>{ try {
 let {name,email,phone,password,role="client"}=req.body;
 if (typeof name!=="string" || typeof email!=="string" || typeof password!=="string") return res.status(400).json({message:"Valid name, email and password required"});
 name=name.trim();email=email.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length>120||password.length>128)return res.status(400).json({message:"Invalid account details"});
 if(!name||!email||!password)return res.status(400).json({message:"Name, email and password are required"});
 if(!["client","designer"].includes(role))return res.status(400).json({message:"Invalid role"});
 if(password.length<8)return res.status(400).json({message:"Password must be at least 8 characters"});
 if(await User.findOne({where:{email:email.toLowerCase()}}))return res.status(409).json({message:"Email already registered"});
 const user=await sequelize.transaction(async transaction=>{
 const user=await User.create({name,email,phone,password:await bcrypt.hash(password,12),role},{transaction});
 if(role==="designer") await DesignerProfile.create({userId:user.id},{transaction});
 return user; });
 res.status(201).json({token:tokenFor(user.id),user:publicUser(user)});
 }catch(e){next(e)}});
router.post("/login",async(req,res,next)=>{try{
 const user=await User.findOne({where:{email:(req.body.email||"").toLowerCase()}});
 if(!user||!user.isActive||!(await bcrypt.compare(req.body.password||"",user.password)))return res.status(401).json({message:"Invalid email or password"});
 res.json({token:tokenFor(user.id),user:publicUser(user)});
}catch(e){next(e)}});
router.get("/me",auth,async(req,res,next)=>{try{
 const profile=req.user.role==="designer"?await DesignerProfile.findOne({where:{userId:req.user.id}}):null;
 res.json({user:publicUser(req.user),profile});
}catch(e){next(e)}});
export default router;
