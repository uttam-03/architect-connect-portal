import {backup} from "./backup.js";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeDatabase } from "./database.js";
import paymentRoutes, { webhook } from "./routes/payments.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { DataTypes } from "sequelize";
import dotenv from "dotenv";
import { sequelize, dialect } from "./models.js";

import authRoutes from "./routes/auth.js";
import designerRoutes from "./routes/designers.js";
import portfolioRoutes from "./routes/portfolios.js";
import inquiryRoutes from "./routes/inquiries.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
app.set("trust proxy", 1);
app.use(helmet({contentSecurityPolicy: false}));
app.post("/api/payments/webhook", express.raw({type: "application/json", limit: "1mb"}), webhook);
const origins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map(x => x.trim()) : true;
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

app.get("/api/health", async (_, res) => {try {await sequelize.authenticate(); res.json({ok:true, database:dialect});} catch {res.status(503).json({ok:false});}});
app.use("/api/payments", paymentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/designers", designerRoutes);
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
if (fs.existsSync(frontend)) {
  app.use(express.static(frontend));
  app.get(/^(?!\/api(?:\/|$)).*/, (_,res)=>res.sendFile(path.join(frontend,"index.html")));
}
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => { console.error(err); const status = err.status || (err.name === "SequelizeUniqueConstraintError" ? 409 : err.name === "SequelizeValidationError" || err.name === "SequelizeForeignKeyConstraintError" ? 400 : 500); res.status(status).json({ message: status >= 500 ? "Request failed. Please try again." : err.message }); });

await initializeDatabase();
console.log(`Database connected using ${dialect}`);
if(dialect==='sqlite' && process.env.AUTO_BACKUP==='true'){
 await backup();setInterval(()=>backup().catch(console.error),24*60*60*1000).unref();
}
const server = app.listen(PORT, "0.0.0.0", () => console.log(`API running on ${PORT}`));
process.on("SIGTERM", () => server.close(async () => {await sequelize.close(); process.exit(0);}));
