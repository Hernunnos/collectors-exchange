/**
 * Splits cards_catalogue.sql into smaller chunks
 * Run: node split_sql.js
 * Output: sql_chunks/chunk_001.sql, chunk_002.sql, etc.
 */

import fs from "fs";
import path from "path";

const INPUT_FILE  = "cards_catalogue.sql";
const OUTPUT_DIR  = "sql_chunks";
const ROWS_PER_CHUNK = 2000; // ~safe size for Supabase SQL editor

const sql = fs.readFileSync(INPUT_FILE, "utf8");

// Split into schema part and INSERT blocks
const schemaEnd = sql.indexOf("\nINSERT INTO");
const schema    = sql.slice(0, schemaEnd);
const inserts   = sql.slice(schemaEnd);

// Split on each INSERT INTO block
const blocks = inserts.split("\nINSERT INTO cards").filter(b => b.trim());

// Re-collect individual rows across all blocks
const allRows = [];
for (const block of blocks) {
  const valuesStart = block.indexOf("VALUES\n") + "VALUES\n".length;
  const onConflict  = block.indexOf("\nON CONFLICT");
  const rowSection  = block.slice(valuesStart, onConflict);
  // Split rows carefully (each row starts with a newline and open paren)
  const rows = rowSection.split(/,\n(?=\()/).map(r => r.trim()).filter(Boolean);
  allRows.push(...rows);
}

console.log(`Total rows: ${allRows.length.toLocaleString()}`);

// Create output dir
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Write schema as chunk_000 (run this first)
fs.writeFileSync(path.join(OUTPUT_DIR, "chunk_000_schema.sql"), schema);
console.log(`Written: chunk_000_schema.sql (run this first)`);

// Write row chunks
const HEADER = `INSERT INTO cards (id,name,set_name,set_code,set_number,condition,language,rarity,game,img_url,api_id,base_price) VALUES\n`;
const FOOTER = `\nON CONFLICT (api_id) DO UPDATE SET img_url=EXCLUDED.img_url, rarity=EXCLUDED.rarity, name=EXCLUDED.name;\n`;

let chunkNum = 1;
for (let i = 0; i < allRows.length; i += ROWS_PER_CHUNK) {
  const chunk    = allRows.slice(i, i + ROWS_PER_CHUNK);
  const filename = `chunk_${String(chunkNum).padStart(3, "0")}.sql`;
  const content  = HEADER + chunk.join(",\n") + FOOTER;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), content);
  chunkNum++;
}

console.log(`\n✅ Split into ${chunkNum - 1} chunks in ./${OUTPUT_DIR}/`);
console.log("\nRun in Supabase SQL Editor in this order:");
console.log("  1. chunk_000_schema.sql  (once)");
console.log(`  2. chunk_001.sql through chunk_${String(chunkNum-1).padStart(3,"0")}.sql`);
