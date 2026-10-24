import path from 'node:path';
import fs from 'node:fs';
import {sequelize,dialect} from './models.js';
export async function backup(){
 if(dialect!=='sqlite')throw new Error('Use mysqldump for MySQL');
 const dir=process.env.BACKUP_DIR||path.join(path.dirname(sequelize.options.storage),'backups');fs.mkdirSync(dir,{recursive:true});
 const file=path.resolve(dir,`backup-${Date.now()}.sqlite`);await sequelize.query(`VACUUM INTO ${sequelize.escape(file)}`);console.log('Database backup:',file);return file;
}
if(process.argv[1]?.endsWith('backup.js')){await backup();await sequelize.close();}
