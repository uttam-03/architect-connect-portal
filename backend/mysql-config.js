import fs from 'node:fs';
export function mysqlOptions(env=process.env){
 const hosted=Boolean(env.RENDER)||env.NODE_ENV==='production';
 const secure=env.MYSQL_SSL==='true'||hosted;
 if(hosted&&env.MYSQL_SSL==='false')throw new Error('Hosted MySQL requires verified TLS');
 const options={host:env.MYSQL_HOST||'127.0.0.1',port:Number(env.MYSQL_PORT||3306),dialect:'mysql',pool:{max:5,min:0,acquire:30000,idle:10000},define:{charset:'utf8mb4',collate:'utf8mb4_unicode_ci'}};
 if(secure){
 let ca=env.MYSQL_SSL_CA_BASE64?Buffer.from(env.MYSQL_SSL_CA_BASE64,'base64').toString('utf8'):env.MYSQL_SSL_CA_PATH?fs.readFileSync(env.MYSQL_SSL_CA_PATH,'utf8'):'';
 if(!ca.includes('-----BEGIN CERTIFICATE-----'))throw new Error('Download Aiven CA certificate; set MYSQL_SSL_CA_BASE64 or MYSQL_SSL_CA_PATH');
 options.dialectOptions={ssl:{ca,rejectUnauthorized:true,verifyIdentity:true},connectTimeout:20000};
 }
 return options;
}
