import fs from "fs";
import dotenv from "dotenv";
import { connectAdmin, closeAdminSqlClient } from "./admin-sql";

dotenv.config();

async function main() {
  const client = await connectAdmin();
  console.log("Connected + hard-delete bypass enabled.");

  try {
    const sql = fs.readFileSync("supabase/seed.sql", "utf8");
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
