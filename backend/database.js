import { sequelize, dialect, DataTypes } from "./models.js";
export async function initializeDatabase() {
await sequelize.authenticate();
if (dialect === "sqlite") {
  await sequelize.query("PRAGMA journal_mode=WAL");
  await sequelize.query("PRAGMA busy_timeout=10000");
  await sequelize.query("PRAGMA foreign_keys=ON");
}
await sequelize.sync();
// Add new pricing columns safely to existing installations without dropping user data.
const qi = sequelize.getQueryInterface();
const pricingColumns = {
  designer_profiles: {
    architectFeeMin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    architectFeeMax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    materialBudgetMin: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    materialBudgetMax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }
  },
  inquiries: {
    architectFeeBudget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    materialBudget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }
  }
};
for (const [table, columns] of Object.entries(pricingColumns)) {
  const existing = await qi.describeTable(table);
  for (const [column, definition] of Object.entries(columns)) {
    if (!existing[column]) await qi.addColumn(table, column, definition);
  }
}
}
