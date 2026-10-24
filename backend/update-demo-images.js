import fs from 'node:fs';
import {sequelize,User,DesignerProfile,Portfolio,dialect} from './models.js';
import {initializeDatabase} from './database.js';
import {backup} from './backup.js';
await initializeDatabase();if(dialect==='sqlite')await backup();
const data=JSON.parse(fs.readFileSync(new URL('./demo/architects.json',import.meta.url),'utf8'));
let profiles=0,projects=0;
await sequelize.transaction(async transaction=>{
 for(const item of data){
 const user=await User.findOne({where:{email:item.email,role:'designer'},transaction});if(!user)continue;
 await DesignerProfile.update({profileImage:item.profileImage},{where:{userId:user.id},transaction});
 await user.update({profileImage:item.profileImage},{transaction});profiles++;
 for(const sample of item.projects){
 const [count]=await Portfolio.update({images:sample.images},{where:{designerId:user.id,title:sample.title},transaction});projects+=count;
 }
 }
});console.log(`Updated images for ${profiles} demo architects and ${projects} sample projects. Other data kept.`);await sequelize.close();
