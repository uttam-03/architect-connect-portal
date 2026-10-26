import path from 'node:path';
import fs from 'node:fs';
import {readSQLiteSnapshot,importIntoEmpty} from './migration-data.js';
const args=process.argv.slice(2);const index=args.indexOf('--source');const source=args[index+1];
if(index<0||!source||source.startsWith('--'))throw new Error('Usage: npm run migrate:mysql -- --source ./data/architect_connect.sqlite [--apply]');
let data;
if(source.toLowerCase().endsWith('.json')){
 const backup=JSON.parse(fs.readFileSync(source,'utf8'));
 if(backup.format!=='architect-connect-backup'||backup.version!==1||!backup.data||!Array.isArray(backup.data.users))throw new Error('Not a supported application backup');
 data=backup.data;
}else data=await readSQLiteSnapshot(path.resolve(source));
console.table(Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,{sourceRows:rows.length}])));
if(!args.includes('--apply')){console.log('Preview only. Source is read-only; destination has not been connected or changed. Add --apply after configuring MySQL.');process.exit(0);}
const {sequelize,dialect}=await import('./models.js');
try{
 if(dialect!=='mysql')throw new Error('Set DB_DIALECT=mysql and Aiven TLS settings before applying');
 const {initializeDatabase}=await import('./database.js');await initializeDatabase();
 const counts=await importIntoEmpty(sequelize,data);console.table(counts);console.log('Import committed. IDs and password hashes retained. Original SQLite file unchanged.');
}catch(e){console.error('Import failed:',e.message);process.exitCode=1;}finally{await sequelize.close();}
