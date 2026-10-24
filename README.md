# Arch + Connect — revised project

Express + Sequelize API, React frontend, SQLite locally and on a Render persistent disk. Existing MySQL mode remains available. Read `docs/DEPLOY-RENDER.md` before deploying.

## Windows local setup (Node.js 22.12+)

Extract the ZIP. Open PowerShell inside `architect-connect-portal` (the folder containing `render.yaml`).

```powershell
cd backend
npm ci
npm run setup
npm start
```

In a second PowerShell window, from the project root:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. The frontend proxies `/api` to localhost:5000. The original database is retained in backend/data; do not delete that directory. Never upload `.env`, node_modules, or the database to a public repository.

## Trial dataset

The current packaged database contains 41 users (30 designers, 10 clients and 1 admin), 80 portfolios and 30 inquiries. `npm run seed` in backend safely skips it when the demo marker exists. On a new empty database it creates the core dataset atomically, then expands it to 30 designers and 80 portfolios in a separate transaction. No automatic seed or reset runs at startup.

Demo logins (local testing only):

| Role | Email | Password |
|---|---|---|
| Client | client1@architectconnect.demo | Client@12345 |
| Designer | designer1@architectconnect.demo | Designer@12345 |
| Admin | admin@architectconnect.demo | Admin@12345 |

These credentials describe the seed script; an existing user may have changed their password. Do not enable public demo admin accounts on a real production site. Keep production empty of demo users, or change all demo credentials and suspend unneeded accounts before launch.

A separate freshly generated trial database is included at `backend/demo/trial.sqlite`, with correctly stored professional fees and materials budgets. To use it locally, set `SQLITE_PATH=./demo/trial.sqlite` in backend/.env and restart. Your original backend/data database remains separate. Old inquiries may have zero fee values because the original model discarded these fields; create a new inquiry with a fee to test payments. Missing historical amounts cannot be reconstructed automatically.

## Payment setup

Set Razorpay test key ID, key secret and webhook secret in backend/.env. Accept an inquiry as its designer, then open it as its client and choose Pay design fee. The fee comes from the stored project brief; materials are separate. The platform's Razorpay merchant receives funds; automatic payout to individual designers, escrow and refunds are not implemented.

Checkout callback verification uses server-side HMAC, payment amount/order/currency checks and captured status. Signed webhooks recover payment status after browser interruption; repeated delivery is safe. Polling refreshes the receipt display. Never put the key secret in the frontend. Live payments require your activated Razorpay merchant account, live keys and a live-mode webhook. Real gateway transactions were not exercised in this environment.

## Checks

```powershell
cd backend
npm test
npm run backup
cd ../frontend
npm run build
```

Backups use SQLite VACUUM INTO for a consistent database snapshot, not a copy of a live WAL database. Copy backups off the server regularly. Automatic daily/startup backups require AUTO_BACKUP=true. Retention is manual; monitor disk usage. See docs/AUDIT.md for tested behavior and limitations.

## Update architect sample details and fees

The refreshed sample data has ten distinct fictional studios, fee ranges, bios, specialties and portfolios. Fees appear on directory cards and full profiles. Existing demo users can be updated without deleting accounts or inquiries:

```powershell
cd backend
npm run demo:update
```

This uses the database selected in backend/.env, creates a SQLite backup first, and updates only the ten known designerN@architectconnect.demo accounts. New inquiries/payments/messages and other accounts are kept. Repeating the command does not duplicate sample projects. It deliberately restores those demo profiles to the supplied sample values; customize backend/demo/architects.json before running if you want your own demo details.

For a real architect: log in with their designer account, open Dashboard, edit Minimum/Maximum architect fee and choose Save profile. Refresh the directory afterwards. Their fee is an estimate for the project, not a per-square-foot price. This does not change already agreed inquiry fees.

## Larger demo dataset

The package now includes 30 fictional architects and 80 sample projects across residential, hospitality, commercial and institutional work. Existing installations can add missing sample architects with `npm run demo:expand` from backend (using the database in .env). Expansion backs up SQLite, runs atomically and skips existing accounts without changing their work. Repeating it adds no duplicates. New demo designer logins: designer11@architectconnect.demo through designer30@architectconnect.demo, password Designer@12345. These are public testing credentials. Production requires deliberate ALLOW_DEMO_SEED=true. Sample images are illustrative external photos and profiles are fictional.

## Distinct demo images

Demo images are now bundled under frontend/public/media rather than cycling a handful of external links. Each sample architect and project has its own image assignment. Source, author and license details are included in media/credits.html and media/manifest.json. Images illustrate fictional sample projects and are not evidence of work by those sample studios.

For an existing installation, copy the updated frontend/public/media folder and updated source while preserving backend/data and .env, stop the backend, then run `npm run demo:images` inside backend. It backs up SQLite first and updates only images for recognized demo accounts and project titles, leaving fees, descriptions, inquiries, messages and payments intact. Restart the Vite frontend; on Render rebuild/redeploy after committing media assets.
