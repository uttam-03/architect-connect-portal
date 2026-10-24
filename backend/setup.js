import fs from 'node:fs';
import crypto from 'node:crypto';
if(fs.existsSync('.env'))console.log('Existing .env kept. JWT_SECRET must have at least 32 characters.');else{fs.writeFileSync('.env',fs.readFileSync('.env.example','utf8').replace('replace-with-a-random-secret-of-at-least-32-characters',crypto.randomBytes(48).toString('hex')),{mode:0o600});console.log('Created .env with random signing secret.');}
