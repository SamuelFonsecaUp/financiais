import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../electron/database.cjs';
import { CloudAuth, DEFAULT_SUPABASE_URL } from '../electron/cloudAuth.cjs';
import { CloudSyncEngine } from '../electron/syncEngine.cjs';
import { getFinancialService } from '../electron/services.cjs';

describe('Local-First Cloud Sync Engine (Supabase + Offline Priority)', () => {
  let db: any;
  let service: any;
  let auth: CloudAuth;
  let syncEngine: CloudSyncEngine;

  beforeEach(() => {
    db = initDatabase(':memory:');
    service = getFinancialService(db);
    auth = new CloudAuth(db);
    syncEngine = new CloudSyncEngine(db, auth);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('provides default Supabase configuration and recognizes local-only mode', async () => {
    const session = auth.getSession();
    expect(session.userId).toBeNull();
    expect(session.supabaseUrl).toBe(DEFAULT_SUPABASE_URL);

    const syncResult = await syncEngine.sync();
    expect(syncResult.status).toBe('local_only');
  });

  it('persists and clears cloud sessions properly in SQLite', () => {
    const saved = auth.saveSession({
      userId: 'usr_test_123',
      email: 'usuario@teste.com',
      accessToken: 'token_jwt_fake',
      refreshToken: 'refresh_fake',
      expiresAt: Date.now() + 3600000,
      syncEnabled: true,
    });

    expect(saved.userId).toBe('usr_test_123');
    expect(saved.email).toBe('usuario@teste.com');

    // Retrieve again
    const current = auth.getSession();
    expect(current.userId).toBe('usr_test_123');

    // Sign out
    auth.signOut();
    const afterLogout = auth.getSession();
    expect(afterLogout.userId).toBeNull();
  });

  it('associates existing offline local data with user when authenticating', () => {
    const acc = service.createAccount({ name: 'Carteira Física', type: 'cash', initialBalance: 15000 });
    expect(acc.name).toBe('Carteira Física');

    // Sign in user
    auth.saveSession({
      userId: 'usr_owner_999',
      email: 'owner@teste.com',
      accessToken: 'tok',
    });
    auth.associateLocalDataWithUser('usr_owner_999');

    const row = db.prepare(`SELECT user_id FROM accounts WHERE id = ?`).get(acc.id);
    expect(row.user_id).toBe('usr_owner_999');
  });

  it('handles remote row insertion and updates with Last-Write-Wins', () => {
    const catId = 'cat_sync_test';
    const remoteRow1 = {
      id: catId,
      user_id: 'usr_1',
      name: 'Supermercado Remoto',
      type: 'expense',
      color: '#10b981',
      icon: 'ShoppingCart',
      active: 1,
      is_system: 0,
      updated_at: '2026-09-14T10:00:00.000Z',
    };

    // 1. Insert remote row into empty database (as if pulled from Supabase on PC 2)
    syncEngine.insertLocalRow('categories', remoteRow1);
    let local = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(catId);
    expect(local).toBeDefined();
    expect(local.name).toBe('Supermercado Remoto');
    expect(local.sync_status).toBe('synced');

    // 2. Newer remote row updates local
    const remoteRow2 = {
      ...remoteRow1,
      name: 'Supermercado e Feira',
      updated_at: '2026-09-14T12:00:00.000Z',
    };
    syncEngine.updateLocalRow('categories', remoteRow2);
    local = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(catId);
    expect(local.name).toBe('Supermercado e Feira');

    // 3. Soft delete (tombstone) replica
    const remoteDeleted = {
      ...remoteRow2,
      deleted_at: '2026-09-14T14:00:00.000Z',
      updated_at: '2026-09-14T14:00:00.000Z',
    };
    syncEngine.updateLocalRow('categories', remoteDeleted);
    local = db.prepare(`SELECT deleted_at FROM categories WHERE id = ?`).get(catId);
    expect(local.deleted_at).toBe('2026-09-14T14:00:00.000Z');
  });
});
