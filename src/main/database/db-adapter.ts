import { Database } from 'sqlite';

/**
 * Database Adapter - Provides a better-sqlite3-like synchronous API
 * for the async sqlite library
 *
 * This adapter allows services written for better-sqlite3 to work
 * with the async sqlite library without extensive refactoring.
 */
export class DatabaseAdapter {
  constructor(private db: Database) {}

  /**
   * Prepare a SQL statement
   *
   * Note: The returned object methods are ASYNC and return Promises.
   * Services using this must await the results.
   */
  prepare(sql: string) {
    const db = this.db;
    return {
      all: async (...params: any[]) => {
        const result = await db.all(sql, ...params);
        return result || [];
      },
      get: async (...params: any[]) => {
        return await db.get(sql, ...params);
      },
      run: async (...params: any[]) => {
        const result = await db.run(sql, ...params);
        return {
          lastInsertRowid: result.lastID,
          changes: result.changes
        };
      }
    };
  }

  /**
   * Execute SQL directly
   */
  exec(sql: string) {
    return this.db.exec(sql);
  }

  /**
   * Run a SQL statement
   */
  run(sql: string, ...params: any[]) {
    return this.db.run(sql, ...params).then(result => ({
      lastInsertRowid: result.lastID,
      changes: result.changes
    }));
  }

  /**
   * Get all rows
   */
  all(sql: string, ...params: any[]) {
    return this.db.all(sql, ...params);
  }

  /**
   * Get single row
   */
  get(sql: string, ...params: any[]) {
    return this.db.get(sql, ...params);
  }

  /**
   * Close database
   */
  close() {
    return this.db.close();
  }
}
