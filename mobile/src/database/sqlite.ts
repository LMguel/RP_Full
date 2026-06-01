/**
 * Bootstrap do SQLite + execução de migrations.
 * Usa react-native-sqlite-storage (Promise API).
 */
import SQLite, {
  enablePromise,
  type SQLiteDatabase,
  type ResultSet,
} from 'react-native-sqlite-storage';
import { migrations } from './migrations';
import { logger } from '@utils/logger';

enablePromise(true);

const DB_NAME = 'registra_ponto.db';
const SCHEMA_VERSION_KEY = 'PRAGMA user_version';

let dbInstance: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

async function open(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabase({
    name: DB_NAME,
    location: 'default',
  });
  await db.executeSql('PRAGMA foreign_keys = ON;');
  await db.executeSql('PRAGMA journal_mode = WAL;');
  return db;
}

async function getCurrentVersion(db: SQLiteDatabase): Promise<number> {
  const [res] = await db.executeSql(SCHEMA_VERSION_KEY);
  const row = res.rows.item(0);
  return Number(row?.user_version ?? 0);
}

async function setVersion(db: SQLiteDatabase, v: number) {
  await db.executeSql(`PRAGMA user_version = ${v}`);
}

async function runMigrations(db: SQLiteDatabase) {
  const current = await getCurrentVersion(db);
  const target = migrations.length;

  if (current >= target) {
    logger.info('SQLite', `Schema atualizado (v${current})`);
    return;
  }

  logger.info('SQLite', `Migrando schema v${current} -> v${target}`);
  for (let i = current; i < target; i++) {
    const m = migrations[i];
    logger.info('SQLite', `Aplicando migration v${i + 1}: ${m.name}`);
    for (const stmt of m.up) {
      await db.executeSql(stmt);
    }
    await setVersion(db, i + 1);
  }
}

export async function initDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await open();
    await runMigrations(db);
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error('SQLite ainda não inicializado. Chame initDatabase() no boot.');
  }
  return dbInstance;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSet> {
  const db = getDb();
  const [res] = await db.executeSql(sql, params);
  return res;
}

export async function executeMany(
  statements: { sql: string; params?: unknown[] }[],
): Promise<void> {
  const db = getDb();
  await db.transaction(async tx => {
    for (const s of statements) {
      tx.executeSql(s.sql, s.params ?? []);
    }
  });
}

export function rowsToArray<T>(res: ResultSet): T[] {
  const out: T[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    out.push(res.rows.item(i) as T);
  }
  return out;
}
