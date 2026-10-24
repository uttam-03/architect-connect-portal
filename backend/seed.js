import bcrypt from "bcryptjs";
import {refreshDemo} from "./refresh-demo.js";
import dotenv from "dotenv";
import { sequelize, User, DesignerProfile, Portfolio, Inquiry, Review } from "./models.js";

dotenv.config();
const images=[
"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80",
"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
];
import { initializeDatabase } from "./database.js";
await initializeDatabase();
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Set ALLOW_DEMO_SEED=true deliberately to add public demo accounts in production");
const marker = await User.findOne({where:{email:"admin@architectconnect.demo"}});
if (marker) {console.log("Demo dataset already present; nothing changed."); await sequelize.close(); process.exit(0);}
await sequelize.transaction(async transaction => {
// All inserts share this transaction; failure rolls back the complete dataset.
const createUser = values => User.create(values, {transaction});
const createProfile = values => DesignerProfile.create(values, {transaction});
const createInquiry = values => Inquiry.create(values, {transaction});
const createReview = values => Review.create(values, {transaction});
const hash=p=>bcrypt.hash(p,12);
const admin=await createUser({name:"Platform Admin",email:"admin@architectconnect.demo",password:await hash("Admin@12345"),role:"admin"});
const clients=[];
for(let i=1;i<=10;i++)clients.push(await createUser({name:["Aarav Mehta","Ishita Sharma","Rohan Verma","Ananya Gupta","Kabir Singh","Diya Jain","Aditya Rao","Sanya Kapoor","Vivaan Malhotra","Nisha Bansal"][i-1],email:`client${i}@architectconnect.demo`,password:await hash("Client@12345"),role:"client",phone:`+91 98765 43${String(100+i).slice(-3)}`}));
const names=["Aanya Studio","Arjun Kapoor","Studio Terra","Meera Designs","UrbanForm","Atelier North","Rhea Architects","The Habitat Lab","Nivasa Studio","Axis & Arch"];
const locations=["Noida","Delhi","Gurgaon","Mumbai","Bengaluru","Jaipur","Lucknow","Chandigarh","Pune","Hyderabad"];
const designers=[];
for(let i=1;i<=10;i++){
 const u=await createUser({name:names[i-1],email:`designer${i}@architectconnect.demo`,password:await hash("Designer@12345"),role:"designer"});
 const styles=[i%3===0?"Contemporary":i%3===1?"Modern":"Minimalist",i%4===0?"Luxury":"Sustainable"];
 const p=await createProfile({userId:u.id,professionalTitle:i%2?"Architect & Spatial Designer":"Interior Designer",bio:"Independent design professional focused on thoughtful, functional spaces with a strong material and lighting language.",expertise:i%2?["Architecture","Residential Design","Space Planning"]:["Interior Design","Hospitality","Furniture"],specialization:["Residential","Renovation","Turnkey"],experience:3+i,location:locations[i-1],budgetMin:75000+i*25000,budgetMax:600000+i*100000,architectFeeMin:25000+i*5000,architectFeeMax:90000+i*10000,materialBudgetMin:150000+i*25000,materialBudgetMax:800000+i*50000,designStyles:styles,profileImage:images[(i-1)%5],rating:i%2?4:5,reviewCount:2,portfolioCount:2});
 designers.push({u,p});
 await Portfolio.bulkCreate([
  {designerId:u.id,title:`${styles[0]} Residence`,category:"Residential",description:"A light-filled residence balancing warm materials, clean geometry and practical family zones.",location:p.location,year:2025,budget:Number(p.budgetMax),style:styles[0],images:[images[(i-1)%5],images[i%5]]},
  {designerId:u.id,title:`${styles[0]} Work Studio`,category:"Commercial",description:"A compact professional workplace designed around collaboration, acoustics and flexible furniture.",location:p.location,year:2024,budget:Math.round(Number(p.budgetMax)*.65),style:styles[0],images:[images[i%5],images[(i+1)%5]]}
 ], {transaction});
}
for(let i=0;i<20;i++){
 const d=designers[i%10].u,c=clients[i%10];
 const inquiry=await createInquiry({clientId:c.id,designerId:d.id,title:["3BHK Interior Renovation","Villa Architecture","Office Interior"][i%3],description:"Looking for a design proposal with clear space planning, material suggestions and a realistic execution budget.",projectType:i%3===0?"Interior Design":"Architecture",location:locations[i%10],budget:250000+i*50000,architectFeeBudget:Math.round((250000+i*50000)*0.1),materialBudget:Math.round((250000+i*50000)*0.9),timeline:"3–6 months",status:"completed"});
 await createReview({clientId:c.id,designerId:d.id,inquiryId:inquiry.id,rating:4+(i%2),comment:"Clear communication, practical ideas and a thoughtful design process."});
}
for(let i=0;i<10;i++) await createInquiry({clientId:clients[i].id,designerId:designers[i].u.id,title:"New Residential Consultation",description:"Initial consultation for a residential design project.",projectType:"Interior Design",location:locations[i],budget:300000,architectFeeBudget:30000,materialBudget:270000,timeline:"2–4 months",status:i%3===0?"pending":"accepted"});
console.log("Seed complete",{database:process.env.DB_DIALECT||"sqlite",admin:admin.email,client:clients[0].email,designer:designers[0].u.email});
});
await refreshDemo();
await sequelize.close();
const {execFileSync}=await import("node:child_process");
execFileSync(process.execPath,["expand-demo.js"],{stdio:"inherit",env:process.env});
