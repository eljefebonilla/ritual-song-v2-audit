/**
 * Execute the 007_songs_migration.sql against Supabase.
 * Uses the Supabase Management API SQL endpoint via service role key.
 *
 * Usage: npx tsx scripts/migrate-songs.ts
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function executeSql(sql: string): Promise<void> {
  // Use the PostgREST rpc endpoint or the Supabase SQL API
  // Supabase exposes pg via the REST endpoint for service_role
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL execution failed (${res.status}): ${text}`);
  }
}

async function executeSqlStatements(sqlContent: string): Promise<void> {
  // Split into individual statements, handling multi-line statements
  // We'll split on semicolons at the end of lines, but not inside strings/functions
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (const line of sqlContent.split("\n")) {
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith("--") && !inDollarQuote) {
      continue;
    }

    // Track $$ dollar-quoting for functions
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      inDollarQuote = !inDollarQuote;
    }

    current += line + "\n";

    // If we hit a semicolon at end of line and we're not inside a dollar-quote
    if (trimmed.endsWith(";") && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt && stmt !== ";") {
        statements.push(stmt);
      }
      current = "";
    }
  }

  // Handle any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  console.log(`Found ${statements.length} SQL statements to execute`);

  // Try executing as a single batch first via the Supabase SQL API
  try {
    const batchRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    // This approach won't work via REST, so fall back to individual execution
  } catch {
    // Expected — REST doesn't support raw SQL
  }

  // Execute individual CREATE statements via the admin client
  // Since we can't run raw SQL via REST, we'll use a workaround:
  // Create a temporary SQL function that runs our migration, then call it
  const fullSql = statements.join("\n");

  // Try the Supabase SQL editor API (available to service_role)
  const sqlApiRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: fullSql }),
  });

  if (sqlApiRes.ok) {
    console.log("Migration executed successfully via exec_sql RPC");
    return;
  }

  // If exec_sql doesn't exist, we need to execute statements individually
  // via creating temporary tables or using the management API
  console.log("exec_sql RPC not available, executing statements individually...");

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\n/g, " ");
    try {
      // Use the pg_net extension or direct SQL execution
      // Since direct SQL isn't available via REST, write to file for manual execution
      console.log(`  [${i + 1}/${statements.length}] ${preview}...`);
      succeeded++;
    } catch (err) {
      console.error(`  FAILED [${i + 1}]: ${err}`);
      failed++;
    }
  }

  if (failed > 0 || succeeded === statements.length) {
    console.log(`\n⚠️  Direct SQL execution via REST API is not supported.`);
    console.log(`   The migration SQL has been written to:`);
    console.log(`   supabase/migrations/007_songs_migration.sql`);
    console.log(`\n   Please execute it manually via one of these methods:`);
    console.log(`   1. Supabase Dashboard → SQL Editor → paste the file contents`);
    console.log(`   2. psql -h <host> -U postgres < supabase/migrations/007_songs_migration.sql`);
    console.log(`   3. supabase db push (if using Supabase CLI)`);
  }
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "supabase", "migrations", "007_songs_migration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  console.log("=== Songs Migration ===");
  console.log(`Reading: ${sqlPath}`);

  await executeSqlStatements(sqlContent);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
