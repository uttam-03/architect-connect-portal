import { Sequelize, DataTypes, Op } from "sequelize";
import dotenv from "dotenv";
import {mysqlOptions} from "./mysql-config.js";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const dialect = (process.env.DB_DIALECT || "sqlite").toLowerCase();
const common = { logging: process.env.DB_LOGGING === "true" ? console.log : false };

let sequelize;
if (dialect === "mysql") {
  sequelize = new Sequelize(process.env.MYSQL_DATABASE, process.env.MYSQL_USER, process.env.MYSQL_PASSWORD, {
    ...mysqlOptions(),
    ...common
  });
} else if (dialect === "sqlite") {
  const storage = process.env.SQLITE_PATH || "./data/architect_connect.sqlite";
  if (process.env.RENDER && !storage.startsWith("/var/data/")) throw new Error("Render SQLite requires SQLITE_PATH under /var/data and an attached persistent disk");
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: process.env.SQLITE_PATH || "./data/architect_connect.sqlite",
    ...common
  });
} else {
  throw new Error(`Unsupported DB_DIALECT: ${dialect}. Use mysql or sqlite.`);
}

export const Payment = sequelize.define("Payment", {
  id: {type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true},
  inquiryId: {type: DataTypes.UUID, allowNull: false, unique: true, references: {model: "inquiries", key: "id"}},
  clientId: {type: DataTypes.UUID, allowNull: false},
  orderId: {type: DataTypes.STRING, unique: true},
  paymentId: {type: DataTypes.STRING, unique: true},
  amount: {type: DataTypes.INTEGER, allowNull: false},
  currency: {type: DataTypes.STRING, defaultValue: "INR"},
  status: {type: DataTypes.STRING, defaultValue: "created"}
}, {tableName: "payments"});

const id = { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true };

export const User = sequelize.define("User", {
  id,
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  phone: DataTypes.STRING(30),
  role: { type: DataTypes.ENUM("client", "designer", "admin"), defaultValue: "client" },
  profileImage: DataTypes.TEXT,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: "users", timestamps: true });

export const DesignerProfile = sequelize.define("DesignerProfile", {
  id,
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  professionalTitle: { type: DataTypes.STRING(180), defaultValue: "Architect & Interior Designer" },
  bio: { type: DataTypes.TEXT, defaultValue: "" },
  expertise: { type: DataTypes.JSON, defaultValue: [] },
  specialization: { type: DataTypes.JSON, defaultValue: [] },
  experience: { type: DataTypes.INTEGER, defaultValue: 0 },
  location: { type: DataTypes.STRING(120), defaultValue: "" },
  budgetMin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  budgetMax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  architectFeeMin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  architectFeeMax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  materialBudgetMin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  materialBudgetMax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  designStyles: { type: DataTypes.JSON, defaultValue: [] },
  profileImage: DataTypes.TEXT,
  rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 },
  reviewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  portfolioCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  views: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: "designer_profiles", timestamps: true });

export const Portfolio = sequelize.define("Portfolio", {
  id,
  designerId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  location: DataTypes.STRING(120),
  year: DataTypes.INTEGER,
  budget: DataTypes.DECIMAL(12, 2),
  style: DataTypes.STRING(100),
  images: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM("pending", "published", "rejected"), defaultValue: "published" },
  views: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: "portfolios", timestamps: true });

// Binary photos live in the same persistent database as portfolio records.
export const ProjectImage = sequelize.define("ProjectImage", {
  id: {type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true},
  portfolioId: {type: DataTypes.UUID, allowNull: false, references: {model:"portfolios",key:"id"},onDelete:"CASCADE"},
  mimeType: {type: DataTypes.STRING(40),allowNull:false},
  byteLength: {type: DataTypes.INTEGER,allowNull:false},
  sha256: {type: DataTypes.STRING(64),allowNull:false},
  data: {type: DataTypes.BLOB('medium'),allowNull:false}
}, {tableName:"project_images",timestamps:true,defaultScope:{attributes:{exclude:["data"]}},indexes:[{fields:["portfolioId"]}]});

export const Inquiry = sequelize.define("Inquiry", {
  id,
  clientId: { type: DataTypes.UUID, allowNull: false },
  designerId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  projectType: DataTypes.STRING(100),
  location: DataTypes.STRING(120),
  budget: DataTypes.DECIMAL(12, 2),
  architectFeeBudget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  materialBudget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  timeline: DataTypes.STRING(120),
  status: { type: DataTypes.ENUM("pending", "accepted", "rejected", "completed"), defaultValue: "pending" }
}, { tableName: "inquiries", timestamps: true });

export const Message = sequelize.define("Message", {
  id,
  inquiryId: { type: DataTypes.UUID, allowNull: false },
  senderId: { type: DataTypes.UUID, allowNull: false },
  receiverId: { type: DataTypes.UUID, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 3000] } },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: "messages", timestamps: true });

export const Review = sequelize.define("Review", {
  id,
  clientId: { type: DataTypes.UUID, allowNull: false },
  designerId: { type: DataTypes.UUID, allowNull: false },
  inquiryId: { type: DataTypes.UUID, allowNull: false, unique: true },
  rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  comment: { type: DataTypes.TEXT, allowNull: false }
}, { tableName: "reviews", timestamps: true });

export const Report = sequelize.define("Report", {
  id,
  reporterId: { type: DataTypes.UUID, allowNull: false },
  targetType: { type: DataTypes.ENUM("designer", "portfolio", "review"), allowNull: false },
  targetId: { type: DataTypes.UUID, allowNull: false },
  reason: { type: DataTypes.STRING(255), allowNull: false },
  description: DataTypes.TEXT,
  status: { type: DataTypes.ENUM("open", "resolved", "dismissed"), defaultValue: "open" }
}, { tableName: "reports", timestamps: true });

export const SavedDesigner = sequelize.define("SavedDesigner", {
  id,
  clientId: { type: DataTypes.UUID, allowNull: false },
  designerId: { type: DataTypes.UUID, allowNull: false }
}, { tableName: "saved_designers", timestamps: true, indexes: [{ unique: true, fields: ["clientId", "designerId"] }] });

User.hasOne(DesignerProfile, { foreignKey: "userId", as: "designerProfile", onDelete: "CASCADE" });
DesignerProfile.belongsTo(User, { foreignKey: "userId", as: "user" });
Portfolio.belongsTo(User, { foreignKey: "designerId", as: "designer" });
Inquiry.belongsTo(User, { foreignKey: "clientId", as: "client" });
Inquiry.belongsTo(User, { foreignKey: "designerId", as: "designer" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Message.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });
Message.belongsTo(Inquiry, { foreignKey: "inquiryId", as: "inquiry" });
Review.belongsTo(User, { foreignKey: "clientId", as: "client" });
Review.belongsTo(User, { foreignKey: "designerId", as: "designer" });
Review.belongsTo(Inquiry, { foreignKey: "inquiryId", as: "inquiry" });
Report.belongsTo(User, { foreignKey: "reporterId", as: "reporter" });
SavedDesigner.belongsTo(User, { foreignKey: "designerId", as: "designer" });

export { sequelize, Sequelize, DataTypes, Op, dialect };
