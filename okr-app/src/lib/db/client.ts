import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import path from 'path';
import fs from 'fs';

// Get database path from environment or use default
const dbPath = env.DATABASE_PATH || path.join(process.cwd(), 'data', 'okr.db');

// Ensure the directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Create SQLite database connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Run migrations at runtime (not during build) to create/update tables
if (!building) {
	const migrationsFolder = path.join(process.cwd(), 'drizzle');
	if (fs.existsSync(migrationsFolder)) {
		// Check if db was created by db:push (has tables but no migration journal)
		const tableCount = (sqlite.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'").get() as { c: number }).c;
		const hasMigrationJournal = (sqlite.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get() as { c: number }).c > 0;

		if (tableCount === 0 || hasMigrationJournal) {
			// Fresh database or previously migrated — run migrations
			migrate(db, { migrationsFolder });
		}
	}
}

// Export the raw SQLite connection for migrations
export { sqlite };
