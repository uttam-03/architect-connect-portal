import path from 'node:path';
import fs from 'node:fs';
import {sequelize,dialect} from './models.js';
export async function backup(){
 if(dialect==='mysql'){
 const data={};
 await sequelize.transaction({isolationLevel:'REPEATABLE READ'},async transaction=>{
 for(const model of sequelize.modelManager.models)data[model.tableName]=(await model.unscoped().findAll({transaction})).map(row=>{const record=row.toJSON();for(const [key,value] of Object.entries(record))if(Buffer.isBuffer(value))record[key]={encoding:"base64",data:value.toString("base64")};return record;});
 });
 const dir=process.env.BACKUP_DIR||'./backups';fs.mkdirSync(dir,{recursive:true});
 const file=path.resolve(dir,`mysql-backup-${Date.now()}.json`);
 fs.writeFileSync(file,JSON.stringify({format:'architect-connect-backup',version:1,createdAt:new Date().toISOString(),data},null,2),{flag:'wx',mode:0o600});
 console.log('Private MySQL application backup:',file);return file;
 }
 const dir=process.env.BACKUP_DIR||path.join(path.dirname(sequelize.options.storage),'backups');fs.mkdirSync(dir,{recursive:true});
 const file=path.resolve(dir,`backup-${Date.now()}.sqlite`);await sequelize.query(`VACUUM INTO ${sequelize.escape(file)}`);console.log('Database backup:',file);return file;
}
if(process.argv[1]?.endsWith('backup.js')){await backup();await sequelize.close();}
