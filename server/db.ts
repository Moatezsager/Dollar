import Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize SQLite for local storage
export const db = new Database('messages.db');
db.pragma('journal_mode = WAL');
db.pragma('cache_size = 32000');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');

// Initialize SQLite tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS server_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS broadcast_state (
    term_id TEXT PRIMARY KEY,
    last_price REAL NOT NULL,
    last_broadcast_time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    page_path TEXT NOT NULL,
    referrer TEXT,
    device_type TEXT,
    device_vendor TEXT,
    device_model TEXT,
    os_name TEXT,
    os_version TEXT,
    browser_name TEXT,
    browser_version TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_visitor_id ON analytics_events(visitor_id);

  CREATE TABLE IF NOT EXISTS installs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS broadcast_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    platform TEXT NOT NULL,
    currency_ids TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    duration_ms INTEGER,
    error_message TEXT,
    is_test INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_broadcast_log_created_at ON broadcast_log(created_at);
`);

// Ensure name column exists in messages
try {
  db.prepare("ALTER TABLE messages ADD COLUMN name TEXT").run();
} catch (e) {
  // Column already exists
}

// Initialize Supabase client
export const supabaseUrl = process.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[DB] WARNING: Supabase credentials missing from environment variables.");
}

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
