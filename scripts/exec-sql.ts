/**
 * Execute raw SQL against Supabase using the pg endpoint.
 * This uses the Supabase service role key to authenticate.
 *
 * Usage: npx tsx scripts/exec-sql.ts <sql-file>
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

async function execSql(sql: string): Promise<string> {
  // Try the Supabase API SQL execution endpoint
  // This requires the database password, which we don't have.
  // Instead, we'll use the REST API to create a Postgres function that wraps our SQL.

  // Create a temporary RPC function via the service role
  const createFnSql = `
    CREATE OR REPLACE FUNCTION _tmp_migration() RETURNS void AS $$
    BEGIN
      ${sql.replace(/'/g, "''")}
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // Actually, let's try the Supabase SQL API endpoint that the dashboard uses
  // This is available at POST /pg/query with the service role key
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/_exec_raw_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (res.ok) {
    return await res.text();
  }

  // Fallback: Try splitting and executing via individual table creation
  // using the Supabase Management API
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (mgmtToken) {
    const mgmtRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mgmtToken}`,
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    if (mgmtRes.ok) {
      return await mgmtRes.text();
    }
    return `Management API error: ${mgmtRes.status} ${await mgmtRes.text()}`;
  }

  return `REST API error: ${res.status} ${await res.text()}`;
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error("Usage: npx tsx scripts/exec-sql.ts <sql-file>");
    process.exit(1);
  }

  const sqlPath = path.resolve(sqlFile);
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log(`Executing SQL from: ${sqlPath}`);
  console.log(`Project: ${projectRef}`);

  // Split into manageable statements
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  console.log(`${statements.length} statements`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    const preview = stmt.substring(0, 60).replace(/\n/g, " ");
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);
    const result = await execSql(stmt);
    if (result && result.includes("error")) {
      console.error(`  Result: ${result.substring(0, 200)}`);
    }
  }

  console.log("Done.");
}

main().catch(console.error);
