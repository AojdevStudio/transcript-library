declare module "better-sqlite3" {
  interface Statement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  }

  interface Database {
    prepare(sql: string): Statement;
    pragma(source: string): unknown;
    exec(sql: string): this;
    close(): void;
    transaction<TArgs extends unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void;
  }

  interface DatabaseConstructor {
    new (filename: string): Database;
  }

  const Database: DatabaseConstructor & {
    Database: Database;
  };

  export default Database;
}
