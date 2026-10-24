import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sequelize,User,DesignerProfile,Portfolio,dialect} from './models.js';
import {initializeDatabase} from './database.js';
import {backup} from './backup.js';
export async function refreshDemo(){
 const records=JSON.parse(fs.readFileSync(new URL('./demo/architects.json',import.meta.url),'utf8'));
 let updated=0;
 await sequelize.transaction(async transaction=>{
 for(const {email,name,projects,...profile} of records){
 const user=await User.findOne({where:{email,role:'designer'},transaction});if(!user)continue;
 await user.update({name},{transaction});
 const [entry]=await DesignerProfile.findOrCreate({where:{userId:user.id},defaults:profile,transaction});await entry.update(profile,{transaction});
 const existing=await Portfolio.findAll({where:{designerId:user.id},order:[['createdAt','ASC'],['id','ASC']],transaction});
 // Only recognized original demo portfolios are refreshed; designer-created projects stay intact.
 for(let i=0;i<projects.length;i++){
 const sample=projects[i];const match=existing.find(p=>p.title===sample.title)||existing.find(p=>/^(Modern|Minimalist|Contemporary) (Residence|Work Studio)$/.test(p.title)&&!existing.used?.has(p.id));
 if(match){existing.used??=new Set();existing.used.add(match.id);await match.update(sample,{transaction});}
 else await Portfolio.create({...sample,designerId:user.id,images:[entry.profileImage].filter(Boolean)},{transaction});
 }
 await entry.update({portfolioCount:await Portfolio.count({where:{designerId:user.id},transaction})},{transaction});updated++;
 }
 });console.log(`Updated ${updated} demo architects. Other accounts, inquiries, payments and messages kept.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await initializeDatabase();if(dialect==='sqlite')await backup();await refreshDemo();await sequelize.close();
}
