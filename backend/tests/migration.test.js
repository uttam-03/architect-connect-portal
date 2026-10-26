import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mysqlOptions} from '../mysql-config.js';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'arch-migrate-'));process.env.SQLITE_PATH=path.join(temp,'target.sqlite');process.env.DB_DIALECT='sqlite';
const {sequelize}=await import('../models.js');
const {initializeDatabase}=await import('../database.js');
const {readSQLiteSnapshot,importIntoEmpty,tableOrder}=await import('../migration-data.js');
test('MySQL TLS config verifies certificates and hostnames',()=>{
 assert.throws(()=>mysqlOptions({RENDER:'true',MYSQL_SSL:'false'}),/verified TLS/);
 assert.throws(()=>mysqlOptions({RENDER:'true'}),/CA certificate/);
 const ca='-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----';
 const opts=mysqlOptions({RENDER:'true',MYSQL_SSL_CA_BASE64:Buffer.from(ca).toString('base64'),MYSQL_HOST:'database.example.com',MYSQL_PORT:'12345'});
 assert.equal(opts.dialectOptions.ssl.rejectUnauthorized,true);assert.equal(opts.dialectOptions.ssl.verifyIdentity,true);assert.equal(opts.port,12345);assert.equal(opts.pool.max,5);
});
test('read-only source, JSON/date conversion, import rollback and nonempty protection',async()=>{
 try{
 const source=path.resolve('./demo/trial.sqlite');const before=fs.readFileSync(source);
 const data=await readSQLiteSnapshot(source);assert.equal(data.users.filter(x=>x.role==='designer').length,30);
 await initializeDatabase();const counts=await importIntoEmpty(sequelize,data);assert.equal(counts.portfolios,80);
 const user=await sequelize.models.User.findByPk(data.users[0].id);assert.equal(user.password,data.users[0].password);assert.equal(typeof user.isActive,'boolean');
 const profile=await sequelize.models.DesignerProfile.findOne();assert(Array.isArray(profile.designStyles));
 await assert.rejects(()=>importIntoEmpty(sequelize,data),/not empty/);assert.equal(await sequelize.models.User.count(),41);
 for(const table of [...tableOrder].reverse()){const model=sequelize.modelManager.models.find(m=>m.tableName===table);await model.destroy({where:{}});}
 const invalid=structuredClone(data);invalid.portfolios[0].designerId='00000000-0000-4000-8000-000000000000';
 await assert.rejects(()=>importIntoEmpty(sequelize,invalid));assert.equal(await sequelize.models.User.count(),0);
 assert(fs.readFileSync(source).equals(before));
 }finally{await sequelize.close();fs.rmSync(temp,{recursive:true,force:true});}
});
