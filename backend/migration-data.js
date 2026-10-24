import fs from "node:fs";
import sqlite3 from "sqlite3";

export const tables = [
  "users",
  "designer_profiles",
  "portfolios",
  "inquiries",
  "messages",
  "reviews",
  "reports",
  "saved_designers",
  "payments"
];

export async function readSource(file) {
  if (!fs.existsSync(file)) {
    throw new Error("SQLite database file nahi mili: " + file);
  }

  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(
      file,
      sqlite3.OPEN_READONLY,
      error => error ? reject(error) : resolve(connection)
    );
  });

  const query = sql => new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => {
      error ? reject(error) : resolve(rows);
    });
  });

  try {
    await query("BEGIN");

    const check = await query("PRAGMA quick_check");
    if (check.length !== 1 || Object.values(check[0])[0] !== "ok") {
      throw new Error("SQLite integrity check failed");
    }

    const existing = new Set(
      (await query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )).map(row => row.name)
    );

    if (!existing.has("users")) {
      throw new Error("Selected file project ka database nahi hai");
    }

    const data = {};
    for (const table of tables) {
      data[table] = existing.has(table)
        ? await query('SELECT * FROM "' + table + '"')
        : [];
    }

    await query("COMMIT");
    return data;
  } finally {
    await new Promise(resolve => db.close(resolve));
  }
}
