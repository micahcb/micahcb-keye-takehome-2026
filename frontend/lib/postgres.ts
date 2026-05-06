import { Pool } from "pg"

let postgresPool: Pool | null = null

export function getPostgresPool() {
  if (postgresPool) return postgresPool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL env var.")
  }

  postgresPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  return postgresPool
}
