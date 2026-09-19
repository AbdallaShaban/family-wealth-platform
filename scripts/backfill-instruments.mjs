import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";

let dbUrl = process.env.DATABASE_URL;
if ((dbUrl.startsWith("'") && dbUrl.endsWith("'")) || (dbUrl.startsWith('"') && dbUrl.endsWith('"'))) {
  dbUrl = dbUrl.slice(1, -1);
}

const pool = mysql.createPool({ uri: dbUrl });

try {
  console.log("=== EXISTING INSTRUMENTS BEFORE BACKFILL ===");
  const [initial] = await pool.query("SELECT id, symbol, name, assetType, subCategory, sector FROM instruments");
  console.table(initial);

  // 1. Fix ticker ORDI -> OCDI if present
  console.log("Fixing ticker ORDI -> OCDI if present...");
  await pool.query("UPDATE instruments SET symbol = 'OCDI' WHERE symbol = 'ORDI'");

  // 2. Map backfill updates
  const backfills = [
    { symbol: "ADIB", sector: "البنوك والخدمات المالية", subCategory: "DIRECT_EQUITY" },
    { symbol: "TMGH", sector: "العقارات والتطوير العقاري", subCategory: "DIRECT_EQUITY" },
    { symbol: "ETEL", sector: "الاتصالات والإعلام والتكنولوجيا", subCategory: "DIRECT_EQUITY" },
    { symbol: "PHAR", sector: "الرعاية الصحية والأدوية", subCategory: "DIRECT_EQUITY" },
    { symbol: "ARCC", sector: "البناء ومواد التشييد", subCategory: "DIRECT_EQUITY" },
    { symbol: "MPCO", sector: "الأغذية والمشروبات", subCategory: "DIRECT_EQUITY" },
    { symbol: "ACGC", sector: "الصناعة والسلع المعمرة والمنسوجات", subCategory: "DIRECT_EQUITY" },
    { symbol: "ORAS", sector: "البناء ومواد التشييد", subCategory: "DIRECT_EQUITY" },
    { symbol: "OCDI", sector: "العقارات والتطوير العقاري", subCategory: "DIRECT_EQUITY" },
    { symbol: "BWS", subCategory: "EQUITY_FUND", sector: "البنوك والخدمات المالية" },
    { symbol: "CMS", subCategory: "EQUITY_FUND", sector: "البنوك والخدمات المالية" },
    { symbol: "BRE", subCategory: "REAL_ESTATE_FUND", sector: "العقارات والتطوير العقاري" },
  ];

  for (const item of backfills) {
    const [res] = await pool.query(
      "UPDATE instruments SET sector = ?, subCategory = ? WHERE symbol = ? OR symbol LIKE ?",
      [item.sector, item.subCategory, item.symbol, `${item.symbol}.%`]
    );
    console.log(`Backfill for ${item.symbol}: affectedRows = ${res.affectedRows}`);
  }

  console.log("=== INSTRUMENTS AFTER BACKFILL ===");
  const [updated] = await pool.query("SELECT id, symbol, name, assetType, subCategory, sector FROM instruments");
  console.table(updated);

  await pool.end();
} catch (e) {
  console.error("Backfill failed:", e);
  process.exit(1);
}
