import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import {sequelize,User,DesignerProfile,Portfolio,dialect} from './models.js';
import {initializeDatabase} from './database.js';
import {backup} from './backup.js';
await initializeDatabase();
if(process.env.NODE_ENV==='production'&&process.env.ALLOW_DEMO_SEED!=='true')throw new Error('Set ALLOW_DEMO_SEED=true intentionally to add public demo accounts.');
if(dialect==='sqlite')await backup();
const records=JSON.parse(fs.readFileSync(new URL('./demo/architects.json',import.meta.url),'utf8'));
const password=await bcrypt.hash('Designer@12345',12);let added=0,projectsAdded=0;
await sequelize.transaction(async transaction=>{
 for(const {email,name,projects,...profile} of records){
 // Existing accounts and their custom work are never changed by expansion.
 if(await User.findOne({where:{email},transaction}))continue;
 const user=await User.create({name,email,password,role:'designer'},{transaction});
 await DesignerProfile.create({...profile,userId:user.id,portfolioCount:projects.length},{transaction});
 await Portfolio.bulkCreate(projects.map(project=>({...project,designerId:user.id})),{transaction});
 added++;projectsAdded+=projects.length;
 }
});
console.log(`Added ${added} demo architects and ${projectsAdded} projects. Existing records kept.`);
await sequelize.close();
