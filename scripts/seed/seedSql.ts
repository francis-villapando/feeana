import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { connectAdmin, closeAdminSqlClient } from "../src/lib/db/adminSql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SQL = path.resolve(__dirname, "../../supabase/seed.sql");

dotenv.config();

async function main() {
  const client = await connectAdmin();
  console.log("Connected + hard-delete bypass enabled.");

  try {
    const sql = fs.readFileSync(SEED_SQL, "utf8");
    await client.query(sql);
    console.log("Successfully executed supabase/seed.sql");
  } finally {
    await closeAdminSqlClient();
  }
}

main().catch((err) => {
  console.error("Seed execution error:", err);
  process.exit(1);
});
