import fs from 'node:fs';
import sqlite3 from 'sqlite3';
export const tableOrder=['users','designer_profiles','portfolios','project_images','inquiries','messages','reviews','reports','saved_designers','payments'];
export function normalizeRecord(row,model){
 const out={};
 for(const [key,attribute] of Object.entries(model.rawAttributes)){
 if(!(key in row))continue;
 let value=row[key];
 if(value!==null){
 switch(attribute.type.key){
 case 'BLOB':
 if(value?.encoding==='base64')value=Buffer.from(value.data,'base64');
 else if(value?.type==='Buffer'&&Array.isArray(value.data))value=Buffer.from(value.data);
 if(!Buffer.isBuffer(value))throw new Error('Invalid binary photo backup');
 break;
 case 'JSON':if(typeof value==='string')value=JSON.parse(value);break;
 case 'BOOLEAN':if(![0,1,false,true].includes(value))throw new Error(`Invalid boolean in ${model.tableName}.${key}`);value=Boolean(value);break;
 case 'DATE':value=new Date(value);if(Number.isNaN(value.getTime()))throw new Error(`Invalid date in ${model.tableName}.${key}`);break;
 }
 }
 out[key]=value;
 }
 return out;
}
export async function readSQLiteSnapshot(file){
 if(!fs.existsSync(file))throw new Error('Source SQLite file does not exist');
 const db=await new Promise((resolve,reject)=>{const db=new sqlite3.Database(file,sqlite3.OPEN_READONLY,e=>e?reject(e):resolve(db));});
 const all=sql=>new Promise((resolve,reject)=>db.all(sql,(e,rows)=>e?reject(e):resolve(rows)));
 try{
 await all('BEGIN');
 const check=await all('PRAGMA quick_check');if(check.length!==1||Object.values(check[0])[0]!=='ok')throw new Error('SQLite integrity check failed');
 const existing=new Set((await all("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name));
 if(!existing.has('users'))throw new Error('Source is not an Architect Connect database');
 const data={};for(const table of tableOrder)data[table]=existing.has(table)?await all(`SELECT * FROM "${table}"`):[];
 await all('COMMIT');return data;
 }finally{await new Promise(resolve=>db.close(resolve));}
}
export async function importIntoEmpty(sequelize,data){
 const models=new Map(sequelize.modelManager.models.map(model=>[model.tableName,model]));
 for(const table of tableOrder)if(!models.has(table))throw new Error(`Missing target model: ${table}`);
 return sequelize.transaction(async transaction=>{
 for(const table of tableOrder)if(await models.get(table).count({transaction}))throw new Error(`Destination ${table} is not empty. Import refused; existing rows are kept.`);
 const counts={};
 for(const table of tableOrder){
 const model=models.get(table);const rows=(data[table]||[]).map(row=>normalizeRecord(row,model));
 // Plain inserts only: no upsert, ignoreDuplicates, deletions or FK disabling.
 for(let i=0;i<rows.length;i+=100)await model.bulkCreate(rows.slice(i,i+100),{transaction,validate:true});
 const count=await model.count({transaction});if(count!==rows.length)throw new Error(`Count mismatch: ${table}`);counts[table]=count;
 }
 return counts;
 });
}

export {readSQLiteSnapshot as readSource, tableOrder as tables};
