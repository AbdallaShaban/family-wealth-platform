import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

async function purge() {
  let dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
    dbUrl = dbUrl.slice(1, -1);
  }
  const pool = mysql.createPool({ uri: dbUrl });
  const staleThreshold = 1735689600000; // Jan 1, 2025
  const [res] = await pool.query(
    "DELETE FROM price_quotes WHERE workspaceId = 1 AND (asOf < ? OR source LIKE '%Yahoo%')",
    [staleThreshold]
  );
  console.log('Purged stale quotes count:', res.affectedRows);
  const [remaining] = await pool.query('SELECT count(*) as count FROM price_quotes WHERE workspaceId = 1');
  console.log('Remaining quotes:', remaining[0].count);
  await pool.end();
}
purge();
