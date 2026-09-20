import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

async function syncDirect() {
  const res = await fetch('https://www.mubasher.info/api/1/stocks/prices?country=eg&period=1D', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  const prices = data.prices || [];

  let dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
    dbUrl = dbUrl.slice(1, -1);
  }
  const pool = mysql.createPool({ uri: dbUrl });

  const [instRows] = await pool.query('SELECT id, name, symbol, currency FROM instruments WHERE workspaceId = 1');
  const now = Date.now();

  for (const inst of instRows) {
    const clean = (inst.symbol || '').replace(/\.CA$/, '').toUpperCase();
    const match = prices.find(p => p.code.toUpperCase() === clean);
    if (match) {
      const priceVal = parseFloat(match.value).toFixed(8);
      const asOf = match.updatedAt ? new Date(match.updatedAt.replace(' ', 'T')).getTime() : now;
      await pool.query(
        'INSERT INTO price_quotes (workspaceId, instrumentId, price, currency, source, quoteStatus, asOf, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [1, inst.id, priceVal, 'EGP', 'مباشر مصر (Mubasher EGX)', 'delayed', asOf, now]
      );
      console.log(`Synchronized: ${inst.symbol} (${inst.name}) -> ${match.value} EGP [As of: ${match.updatedAt}]`);
    }
  }

  // Also query current portfolio positions with their real valuation
  const [positions] = await pool.query(`
    SELECT p.id, i.symbol, i.name, p.quantity, p.averageCost, q.price as marketPrice,
           ROUND(p.quantity * q.price, 2) as marketValue,
           ROUND(p.quantity * (q.price - p.averageCost), 2) as unrealizedPnl
    FROM positions p
    JOIN instruments i ON p.instrumentId = i.id
    LEFT JOIN (
      SELECT pq1.instrumentId, pq1.price
      FROM price_quotes pq1
      INNER JOIN (
        SELECT instrumentId, MAX(asOf) as maxAsOf
        FROM price_quotes
        WHERE workspaceId = 1
        GROUP BY instrumentId
      ) pq2 ON pq1.instrumentId = pq2.instrumentId AND pq1.asOf = pq2.maxAsOf
      WHERE pq1.workspaceId = 1
    ) q ON p.instrumentId = q.instrumentId
    WHERE p.workspaceId = 1 AND p.quantity > 0
  `);

  console.log('\n--- PORTFOLIO POSITIONS & REAL VALUATIONS ---');
  console.table(positions);

  await pool.end();
}
syncDirect();
