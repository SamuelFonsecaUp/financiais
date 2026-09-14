/**
 * Cloud Sync Engine (Local-First Bidirectional Delta Sync)
 * 
 * Sincroniza o SQLite local com o Supabase PostgreSQL em segundo plano:
 * 1. Push: envia alterações locais pendentes (sync_status = 'pending')
 * 2. Pull: baixa alterações remotas (updated_at > last_synced_at)
 * 3. Soft deletes: replica exclusões com deleted_at (tombstones)
 * 4. Resolução de conflitos: Last-Write-Wins baseado no timestamp ISO
 * 5. 100% resiliente: se falhar a rede ou estiver offline, opera localmente sem travar
 */

const SYNC_TABLES = [
  'categories',
  'accounts',
  'credit_cards',
  'imported_statements',
  'transactions',
  'recurring_rules',
  'goals',
  'category_budgets',
  'import_rules',
];

class CloudSyncEngine {
  constructor(db, cloudAuth) {
    this.db = db;
    this.auth = cloudAuth;
    this.isSyncing = false;
  }

  // Quick connectivity check
  async checkOnline(supabaseUrl) {
    try {
      const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok || res.status < 500;
    } catch (e) {
      return false;
    }
  }

  // Execute full sync cycle (Push pending -> Pull remote)
  async sync() {
    if (this.isSyncing) {
      return { status: 'syncing', message: 'Sincronização já em andamento.' };
    }

    const session = this.auth.getSession();
    if (!session || !session.userId || !session.accessToken) {
      return {
        status: 'local_only',
        message: 'Modo local (sem conta na nuvem configurada).',
        lastSyncAt: null,
      };
    }

    this.isSyncing = true;
    try {
      const isOnline = await this.checkOnline(session.supabaseUrl);
      if (!isOnline) {
        return {
          status: 'offline',
          message: 'Sem conexão com a nuvem no momento. Operando 100% offline.',
          lastSyncAt: session.lastSyncAt,
        };
      }

      let totalPushed = 0;
      let totalPulled = 0;

      // 1. Push pending local changes to Supabase
      for (const table of SYNC_TABLES) {
        const pushed = await this.pushTable(table, session);
        totalPushed += pushed;
      }

      // 2. Pull remote updates from Supabase
      for (const table of SYNC_TABLES) {
        const pulled = await this.pullTable(table, session);
        totalPulled += pulled;
      }

      const now = new Date().toISOString();
      this.auth.saveSession({ lastSyncAt: now });

      return {
        status: 'synced',
        message: 'Sincronização com o Supabase concluída com sucesso.',
        pushedCount: totalPushed,
        pulledCount: totalPulled,
        lastSyncAt: now,
      };
    } catch (err) {
      console.error('[CloudSyncEngine] Error during sync:', err);
      return {
        status: 'error',
        message: `Falha na sincronização: ${err.message || err}`,
        lastSyncAt: session.lastSyncAt,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  // Push pending rows for a single table
  async pushTable(tableName, session) {
    const rows = this.db.prepare(`
      SELECT * FROM ${tableName}
      WHERE sync_status = 'pending' OR sync_status IS NULL
    `).all();

    if (rows.length === 0) return 0;

    const payload = rows.map(r => {
      const copy = { ...r };
      delete copy.sync_status;
      copy.user_id = session.userId;
      if (!copy.updated_at) {
        copy.updated_at = new Date().toISOString();
      }
      return copy;
    });

    const endpoint = `${session.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': session.supabaseAnonKey,
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[CloudSyncEngine] Push error for ${tableName}:`, errBody);
      return 0;
    }

    // Mark as synced locally
    const updateStmt = this.db.prepare(`UPDATE ${tableName} SET sync_status = 'synced' WHERE id = ?`);
    const runBatch = this.db.transaction(() => {
      for (const r of rows) {
        updateStmt.run(r.id);
      }
    });
    runBatch();

    return rows.length;
  }

  // Pull remote updates for a single table
  async pullTable(tableName, session) {
    const meta = this.db.prepare(`SELECT last_synced_at FROM sync_metadata WHERE table_name = ?`).get(tableName);
    const lastSyncedAt = meta ? meta.last_synced_at : null;

    let endpoint = `${session.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}?select=*&user_id=eq.${session.userId}&order=updated_at.asc`;
    if (lastSyncedAt) {
      endpoint += `&updated_at=gt.${encodeURIComponent(lastSyncedAt)}`;
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': session.supabaseAnonKey,
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    if (!res.ok) {
      return 0;
    }

    const remoteRows = await res.json();
    if (!Array.isArray(remoteRows) || remoteRows.length === 0) return 0;

    const runPull = this.db.transaction(() => {
      for (const remote of remoteRows) {
        const local = this.db.prepare(`SELECT id, updated_at, deleted_at FROM ${tableName} WHERE id = ?`).get(remote.id);

        if (!local) {
          // New record from another device
          this.insertLocalRow(tableName, remote);
        } else {
          // Existing record: Last-Write-Wins comparison
          const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
          const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;

          if (remoteTime >= localTime) {
            this.updateLocalRow(tableName, remote);
          }
        }
      }

      // Update sync metadata
      const latestRemote = remoteRows[remoteRows.length - 1];
      const newSyncTimestamp = latestRemote?.updated_at || new Date().toISOString();

      this.db.prepare(`
        INSERT INTO sync_metadata (table_name, last_synced_at)
        VALUES (?, ?)
        ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at
      `).run(tableName, newSyncTimestamp);
    });

    runPull();
    return remoteRows.length;
  }

  // Full Pull for fresh installations on another computer
  async fullPull() {
    const session = this.auth.getSession();
    if (!session || !session.userId || !session.accessToken) {
      throw new Error('Faça login com sua conta para restaurar os dados da nuvem.');
    }

    let totalRestored = 0;

    for (const table of SYNC_TABLES) {
      const endpoint = `${session.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?select=*&user_id=eq.${session.userId}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': session.supabaseAnonKey,
          'Authorization': `Bearer ${session.accessToken}`,
        },
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const runInsert = this.db.transaction(() => {
            for (const r of rows) {
              const local = this.db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(r.id);
              if (!local) {
                this.insertLocalRow(table, r);
              } else {
                this.updateLocalRow(table, r);
              }
            }
            this.db.prepare(`
              INSERT INTO sync_metadata (table_name, last_synced_at)
              VALUES (?, ?)
              ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at
            `).run(table, new Date().toISOString());
          });
          runInsert();
          totalRestored += rows.length;
        }
      }
    }

    const now = new Date().toISOString();
    this.auth.saveSession({ lastSyncAt: now });

    return {
      success: true,
      totalRestored,
      timestamp: now,
    };
  }

  // Insert a remote row into local SQLite
  insertLocalRow(tableName, row) {
    const cleanRow = { ...row, sync_status: 'synced' };
    const keys = Object.keys(cleanRow);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => cleanRow[k]);

    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')})
        VALUES (${placeholders})
      `).run(...values);
    } catch (e) {
      console.warn(`[CloudSyncEngine] Error inserting into ${tableName}:`, e.message);
    }
  }

  // Update a local row from remote
  updateLocalRow(tableName, row) {
    const cleanRow = { ...row, sync_status: 'synced' };
    const id = cleanRow.id;
    delete cleanRow.id;

    const keys = Object.keys(cleanRow);
    const assignments = keys.map(k => `${k} = ?`).join(', ');
    const values = [...keys.map(k => cleanRow[k]), id];

    try {
      this.db.prepare(`
        UPDATE ${tableName} SET ${assignments} WHERE id = ?
      `).run(...values);
    } catch (e) {
      console.warn(`[CloudSyncEngine] Error updating ${tableName}:`, e.message);
    }
  }
}

module.exports = {
  CloudSyncEngine,
  SYNC_TABLES,
};
