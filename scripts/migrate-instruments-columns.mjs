import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";

let dbUrl = process.env.DATABASE_URL;
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}

const pool = mysql.createPool({ uri: dbUrl });

try {
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'instruments' AND TABLE_SCHEMA = DATABASE()
  `);
  const colNames = cols.map(c => c.COLUMN_NAME);
  console.log("Existing instruments columns:", colNames);

  if (!colNames.includes("subCategory")) {
    console.log("Adding subCategory column to instruments...");
    await pool.query("ALTER TABLE instruments ADD COLUMN subCategory VARCHAR(64) NULL");
    console.log("subCategory column added successfully.");
  } else {
    console.log("subCategory column already exists.");
  }

  if (!colNames.includes("sector")) {
    console.log("Adding sector column to instruments...");
    await pool.query("ALTER TABLE instruments ADD COLUMN sector VARCHAR(100) NULL");
    console.log("sector column added successfully.");
  } else {
    console.log("sector column already exists.");
  }

  const [newCols] = await pool.query("DESCRIBE instruments");
  console.log("Updated instruments columns:");
  console.table(newCols);

  await pool.end();
} catch (e) {
  console.error("Migration failed:", e);
  process.exit(1);
}
