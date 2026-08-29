import pg from "pg";

let _client: pg.Client | null = null;

/**
 * Returns a direct Postgres connection with the admin delete bypass enabled.
 * Uses a singleton — safe to call from multiple seed/test entrypoints.
 * Call closeAdminSqlClient() when done to release the connection.
 */
export async function connectAdmin(): Promise<pg.Client> {
  if (_client) return _client;

  const connectionString = process.env.SUPABASE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "SUPABASE_CONNECTION_STRING is required for admin SQL operations. " +
        "Set it in your .env file.",
    );
  }

  _client = new pg.Client({ connectionString });
  try {
    await _client.connect();
    await _client.query("SET app.allow_hard_delete = 'true'");
  } catch (err) {
    _client = null;
    throw new Error(`Admin SQL connection failed: ${(err as Error).message}`);
  }
  return _client;
}

/**
 * Executes multiple queries in a single transaction with hard-delete bypass enabled.
 * Uses SET LOCAL so the flag persists for the entire transaction regardless of
 * PgBouncer connection pooling mode. Returns the affected row count per query.
 */
export async function adminExec(
  queries: { text: string; params?: unknown[] }[],
): Promise<number[]> {
  const client = await connectAdmin();
  await client.query("BEGIN");
  await client.query("SET LOCAL app.allow_hard_delete = 'true'");
  try {
    const counts: number[] = [];
    for (const q of queries) {
      const result = await client.query(q.text, q.params);
      counts.push(result.rowCount ?? 0);
    }
    await client.query("COMMIT");
    return counts;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Closes the singleton admin connection. Safe to call multiple times.
 * Must be called in global afterAll/teardown to prevent the process from hanging.
 */
export async function closeAdminSqlClient(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
  }
}
