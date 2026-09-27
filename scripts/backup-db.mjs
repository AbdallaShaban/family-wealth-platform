import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs/promises";
import path from "path";

dotenv.config();

let dbUrl = process.env.DATABASE_URL || "";
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}

const isTiDB = dbUrl.includes("tidbcloud.com");
const poolConfig = {
  uri: dbUrl,
  connectionLimit: 5,
  maxIdle: 2,
  idleTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
  waitForConnections: true,
  ...(isTiDB ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } : {}),
};

function escapeSqlValue(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0": return "\\0";
        case "\x08": return "\\b";
        case "\x09": return "\\t";
        case "\x1a": return "\\z";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\"": case "'": case "\\": case "%": return "\\" + char;
        default: return char;
      }
    })}'`;
  }
  return `'${String(val).replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case "\0": return "\\0";
      case "\x08": return "\\b";
      case "\x09": return "\\t";
      case "\x1a": return "\\z";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\"": case "'": case "\\": case "%": return "\\" + char;
      default: return char;
    }
  })}'`;
}

async function backup() {
  const backupsDir = path.resolve(process.cwd(), "backups");
  await fs.mkdir(backupsDir, { recursive: true });

  const pool = mysql.createPool(poolConfig);
  try {
    const [tables] = await pool.query("SHOW TABLES");
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map((row) => row[tableKey]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupJsonPath = path.join(backupsDir, `backup-${timestamp}.json`);
    const backupSqlPath = path.join(backupsDir, `backup-${timestamp}.sql`);

    console.log(`Starting backup of ${tableNames.length} tables...`);

    const fullBackup = {
      timestamp: new Date().toISOString(),
      tables: {},
    };

    let sqlDump = `-- Family Wealth Assessment Platform Backup\n-- Timestamp: ${new Date().toISOString()}\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

    let totalRows = 0;
    for (let i = 0; i < tableNames.length; i++) {
      const table = tableNames[i];
      try {
        const [createResult] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
        const createSql = createResult[0]["Create Table"] || createResult[0]["Create View"] || "";
        sqlDump += `-- --------------------------------------------------\n-- Table: \`${table}\`\n-- --------------------------------------------------\nDROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n\n`;

        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
        fullBackup.tables[table] = {
          rowCount: rows.length,
          rows: rows,
        };
        totalRows += rows.length;

        if (rows.length > 0) {
          const columns = Object.keys(rows[0]).map((col) => `\`${col}\``).join(", ");
          for (const row of rows) {
            const values = Object.values(row).map(escapeSqlValue).join(", ");
            sqlDump += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
          }
          sqlDump += "\n";
        }
        console.log(`[${i + 1}/${tableNames.length}] ${table}: ${rows.length} rows`);
      } catch (tableErr) {
        console.warn(`Warning on table ${table}:`, tableErr.message);
      }
    }

    sqlDump += "SET FOREIGN_KEY_CHECKS = 1;\n";

    await fs.writeFile(backupJsonPath, JSON.stringify(fullBackup, null, 2), "utf8");
    await fs.writeFile(backupSqlPath, sqlDump, "utf8");

    console.log(`\n========================================`);
    console.log(`SUCCESS: Full Database Backup Completed!`);
    console.log(`Total Tables: ${tableNames.length}`);
    console.log(`Total Rows: ${totalRows}`);
    console.log(`JSON Backup: ${backupJsonPath}`);
    console.log(`SQL Backup: ${backupSqlPath}`);
    console.log(`========================================`);
  } finally {
    await pool.end();
  }
}

backup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
