export interface Migration {
  version: number;
  statements: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY NOT NULL,
        uri TEXT NOT NULL,
        media_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        modified_at INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        file_size INTEGER NOT NULL,
        file_size_estimated INTEGER NOT NULL DEFAULT 0,
        duration REAL,
        is_screenshot INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        seen_generation INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS analysis (
        asset_id TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        fingerprint TEXT,
        fingerprint_kind TEXT,
        exact_hash TEXT NOT NULL DEFAULT '',
        blur_score REAL NOT NULL DEFAULT 0,
        analysis_version INTEGER NOT NULL,
        analyzed_modified_at INTEGER NOT NULL,
        analyzed_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS similar_groups (
        group_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        is_best INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (kind, group_id, asset_id)
      )`,
      `CREATE TABLE IF NOT EXISTS swipe_decisions (
        asset_id TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        decision TEXT NOT NULL,
        decided_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS trash (
        asset_id TEXT PRIMARY KEY NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        source TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_assets_file_size ON assets(file_size)',
      'CREATE INDEX IF NOT EXISTS idx_assets_media_type ON assets(media_type, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_analysis_exact_hash ON analysis(exact_hash)',
      'CREATE INDEX IF NOT EXISTS idx_analysis_blur_score ON analysis(blur_score)',
      'CREATE INDEX IF NOT EXISTS idx_similar_groups_asset ON similar_groups(asset_id)',
    ],
  },
];

export const latestSchemaVersion = migrations.reduce((max, m) => Math.max(max, m.version), 0);
