import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

async function check() {
  let dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
    dbUrl = dbUrl.slice(1, -1);
  }
  const pool = mysql.createPool({ uri: dbUrl });
  const [quotes] = await pool.query('SELECT id, instrumentId, price, currency, source, quoteStatus, asOf, createdAt FROM price_quotes WHERE workspaceId = 1 ORDER BY id ASC');
  console.log('All quotes for workspace 1 count:', quotes.length);
  console.table(quotes.map(q => ({
    id: q.id,
    instId: q.instrumentId,
    price: q.price,
    asOfDate: new Date(q.asOf).toISOString().slice(0, 10),
    source: q.source
  })));
  await pool.end();
}
check();
