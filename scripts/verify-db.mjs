import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set in .env");
  process.exit(1);
}

// Strip surrounding quotes if present
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}

const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

if (isLocalhost) {
  console.log(`[VERIFICATION RESULT]: DATABASE_URL is currently configured to localhost:`);
  console.log(`  ${dbUrl}`);
  console.log(`\nTiDB Cloud remote cluster configuration is required.`);
  process.exit(2);
}

try {
  let hostname = "gateway01.eu-central-1.prod.aws.tidbcloud.com";
  try {
    const parsed = new URL(dbUrl.replace(/^mysql:\/\//, "http://"));
    hostname = parsed.hostname;
  } catch {}

  const isTiDB = dbUrl.includes("tidbcloud.com");
  const poolConfig = {
    uri: dbUrl,
    ...(isTiDB && !dbUrl.includes("ssl=") ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } : {}),
  };

  const pool = mysql.createPool(poolConfig);
  // Test query
  await pool.query("SELECT 1");

  let userCount = 0;
  try {
    const [userRows] = await pool.query("SELECT COUNT(*) as count FROM users");
    userCount = userRows[0]?.count ?? 0;
  } catch (e) {
    userCount = "0 (users table not created yet)";
  }

  console.log(`Connected DB Host: ${hostname}`);
  console.log(`Total registered users in TiDB: ${userCount}`);
  await pool.end();
} catch (error) {
  console.error("Connection failed:", error.message);
  process.exit(1);
}
