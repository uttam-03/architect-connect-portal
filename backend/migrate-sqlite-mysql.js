import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { readSource, tables } from "./migration-data.js";

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf("--source");
  const source = sourceIndex >= 0
    ? args[sourceIndex + 1]
    : "./data/architect_connect.sqlite";

  const data = await readSource(path.resolve(source));

  console.table(Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [
      table, { records: rows.length }
    ])
  ));

  if (!args.includes("--apply")) {
    console.log("Preview only. Import ke liye --apply add karo.");
    return;
  }

  if (process.env.DB_DIALECT !== "mysql") {
    throw new Error(".env mein DB_DIALECT=mysql hona chahiye");
  }

  // Enable verified TLS in the existing application's MySQL connection.
  const modelPath = path.resolve("./models.js");
  let code = fs.readFileSync(modelPath, "utf8");

  if (!code.includes("AIVEN_VERIFIED_TLS")) {
    if (code.includes("dialectOptions") || code.includes("mysqlOptions")) {
      throw new Error(
        "Models already has custom connection settings. Import stopped for review."
      );
    }

    const pattern = /dialect\s*:\s*["']mysql["']\s*,/g;
    if ((code.match(pattern) || []).length !== 1) {
      throw new Error("MySQL configuration location not found. No changes made.");
    }

    const replacement = `dialect: "mysql",
    /* AIVEN_VERIFIED_TLS */
    dialectOptions: {
      ssl: {
        ca: process.env.MYSQL_SSL_CA_BASE64
          ? Buffer.from(process.env.MYSQL_SSL_CA_BASE64, "base64").toString("utf8")
          : readAivenCertificate(
              process.env.MYSQL_SSL_CA_PATH || "./secrets/ca.pem",
              "utf8"
            ),
        rejectUnauthorized: true,
        verifyIdentity: true
      }
    },`;

    const backupPath = modelPath + ".before-aiven.bak";
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(modelPath, backupPath);
    }

    code = code.replace(pattern, replacement);
    code = 'import { readFileSync as readAivenCertificate } from "node:fs";\n' + code;
    fs.writeFileSync(modelPath, code, "utf8");
    console.log("Backend MySQL TLS enabled; original models.js backup kept.");
  }

  const { sequelize } = await import("./models.js");

  try {
    const models = new Map(
      sequelize.modelManager.models.map(model => [
        model.tableName, model
      ])
    );

    // Refuse unsupported source fields instead of silently dropping data.
    for (const table of tables) {
      if (!data[table].length) continue;
      const model = models.get(table);
      if (!model) throw new Error("Missing application model: " + table);

      for (const row of data[table]) {
        for (const field of Object.keys(row)) {
          if (!model.rawAttributes[field]) {
            throw new Error("Unsupported field: " + table + "." + field);
          }
        }
      }
    }

    await sequelize.authenticate();
    await sequelize.sync();

    await sequelize.transaction(async transaction => {
      for (const table of tables) {
        const model = models.get(table);
        if (model && await model.count({ transaction })) {
          throw new Error(
            table + " already has records. Import refused; existing data kept."
          );
        }
      }

      for (const table of tables) {
        const model = models.get(table);
        if (!model) continue;

        const rows = data[table].map(original => {
          const row = { ...original };

          for (const [field, attribute] of Object.entries(model.rawAttributes)) {
            if (row[field] == null) continue;

            if (attribute.type.key === "JSON" && typeof row[field] === "string") {
              row[field] = JSON.parse(row[field]);
            }

            if (attribute.type.key === "BOOLEAN") {
              if (![0, 1, false, true].includes(row[field])) {
                throw new Error("Invalid boolean: " + table + "." + field);
              }
              row[field] = Boolean(row[field]);
            }

            if (attribute.type.key === "DATE") {
              row[field] = new Date(row[field]);
              if (Number.isNaN(row[field].getTime())) {
                throw new Error("Invalid date: " + table + "." + field);
              }
            }
          }

          return row;
        });

        for (let start = 0; start < rows.length; start += 100) {
          await model.bulkCreate(rows.slice(start, start + 100), {
            transaction,
            validate: true
          });
        }

        const count = await model.count({ transaction });
        if (count !== rows.length) {
          throw new Error("Record count mismatch: " + table);
        }
      }
    });

    console.log("SUCCESS: Data imported into MySQL.");
    console.log("Original SQLite file unchanged. IDs and password hashes retained.");
  } finally {
    await sequelize.close();
  }
}

main().catch(error => {
  console.error("Import stopped:", error.message);
  process.exitCode = 1;
});
