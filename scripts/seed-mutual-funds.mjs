import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import { fetchEgxOrYahooQuote } from '../server/marketData.ts';

async function seedFunds() {
  let dbUrl = process.env.DATABASE_URL;
  if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
    dbUrl = dbUrl.slice(1, -1);
  }
  const pool = mysql.createPool({ uri: dbUrl });

  const [funds] = await pool.query("SELECT id, symbol, name, currency, assetType FROM instruments WHERE workspaceId = 1 AND assetType = 'fund'");
  const now = Date.now();

  for (const f of funds) {
    const q = await fetchEgxOrYahooQuote(f.symbol, f.currency, undefined, f.assetType, f.name);
    await pool.query(
      'INSERT INTO price_quotes (workspaceId, instrumentId, price, currency, source, quoteStatus, asOf, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [1, f.id, q.price, q.currency, q.source, q.quoteStatus, q.asOf, now]
    );
    console.log(`Seeded NAV for ${f.symbol} (${f.name}) -> ${q.price} EGP`);
  }

  // View updated positions
  const [positions] = await pool.query(`
    SELECT p.id, i.symbol, i.name, i.assetType, p.quantity, p.averageCost, q.price as marketPrice,
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
  console.table(positions);
  await pool.end();
}
seedFunds();
