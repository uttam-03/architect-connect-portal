import bcrypt from 'bcryptjs';
import {User,sequelize} from './models.js';
import {initializeDatabase} from './database.js';
const {ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
if(!ADMIN_EMAIL||!/^\S+@\S+\.\S+$/.test(ADMIN_EMAIL)||!ADMIN_PASSWORD||ADMIN_PASSWORD.length<12)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) temporarily.');
await initializeDatabase();const email=ADMIN_EMAIL.trim().toLowerCase();if(await User.findOne({where:{email}}))throw new Error('Account exists; nothing changed.');
await User.create({name:'Platform Administrator',email,password:await bcrypt.hash(ADMIN_PASSWORD,12),role:'admin'});console.log('Administrator created');await sequelize.close();
