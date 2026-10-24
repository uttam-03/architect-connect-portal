import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

let connection;

try {
  const ca = process.env.MYSQL_SSL_CA_BASE64
    ? Buffer.from(process.env.MYSQL_SSL_CA_BASE64, "base64").toString("utf8")
    : fs.readFileSync(
        process.env.MYSQL_SSL_CA_PATH || "./secrets/ca.pem",
        "utf8"
      );

  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: {
      ca,
      rejectUnauthorized: true,
      verifyIdentity: true
    },
    connectTimeout: 20000
  });

  const [rows] = await connection.query(
    "SHOW SESSION STATUS LIKE 'Ssl_cipher'"
  );

  if (!rows[0]?.Value) {
    throw new Error("TLS connection is not enabled");
  }

  console.log("Database connection OK; TLS enabled.");
} catch (error) {
  console.error("Connection failed:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
