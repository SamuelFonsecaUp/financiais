/**
 * Cloud Authentication Manager (Supabase / Local-First)
 * 
 * Gerencia credenciais e sessões com o Supabase, armazenando tokens no SQLite local
 * e permitindo alternar de modo 100% offline para nuvem com fluidez total.
 */

const DEFAULT_SUPABASE_URL = 'https://pkmedbjdxvwafvofgnrj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrbWVkYmpkeHZ3YWZ2b2ZnbnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTM5NDcsImV4cCI6MjEwNDk4OTk0N30.KXB0RLjKH3TV6_WhUES1-rxpz5ZymSf2b2AnKYrZcjk';

class CloudAuth {
  constructor(db) {
    this.db = db;
  }

  // Get current stored session or fallback config
  getSession() {
    const row = this.db.prepare(`SELECT * FROM cloud_session WHERE id = 'current_session'`).get();
    if (!row || !row.user_id) {
      return {
        userId: null,
        email: null,
        accessToken: null,
        refreshToken: null,
        supabaseUrl: row?.supabase_url || DEFAULT_SUPABASE_URL,
        supabaseAnonKey: row?.supabase_anon_key || DEFAULT_SUPABASE_ANON_KEY,
        lastSyncAt: row?.last_sync_at || null,
        syncEnabled: false,
      };
    }

    return {
      userId: row.user_id,
      email: row.email,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      supabaseUrl: row.supabase_url || DEFAULT_SUPABASE_URL,
      supabaseAnonKey: row.supabase_anon_key || DEFAULT_SUPABASE_ANON_KEY,
      lastSyncAt: row.last_sync_at,
      syncEnabled: Boolean(row.sync_enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Save or update session
  saveSession(data) {
    const now = new Date().toISOString();
    const existing = this.db.prepare(`SELECT id FROM cloud_session WHERE id = 'current_session'`).get();

    const supabaseUrl = data.supabaseUrl || DEFAULT_SUPABASE_URL;
    const supabaseAnonKey = data.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;

    if (existing) {
      this.db.prepare(`
        UPDATE cloud_session SET
          user_id = COALESCE(?, user_id),
          email = COALESCE(?, email),
          access_token = COALESCE(?, access_token),
          refresh_token = COALESCE(?, refresh_token),
          expires_at = COALESCE(?, expires_at),
          supabase_url = COALESCE(?, supabase_url),
          supabase_anon_key = COALESCE(?, supabase_anon_key),
          last_sync_at = COALESCE(?, last_sync_at),
          sync_enabled = COALESCE(?, sync_enabled),
          updated_at = ?
        WHERE id = 'current_session'
      `).run(
        data.userId || null,
        data.email || null,
        data.accessToken || null,
        data.refreshToken || null,
        data.expiresAt || null,
        supabaseUrl,
        supabaseAnonKey,
        data.lastSyncAt || null,
        data.syncEnabled !== undefined ? (data.syncEnabled ? 1 : 0) : null,
        now
      );
    } else {
      this.db.prepare(`
        INSERT INTO cloud_session (
          id, user_id, email, access_token, refresh_token, expires_at,
          supabase_url, supabase_anon_key, last_sync_at, sync_enabled, created_at, updated_at
        ) VALUES (
          'current_session', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        data.userId || null,
        data.email || null,
        data.accessToken || null,
        data.refreshToken || null,
        data.expiresAt || null,
        supabaseUrl,
        supabaseAnonKey,
        data.lastSyncAt || null,
        data.syncEnabled !== undefined ? (data.syncEnabled ? 1 : 0) : 1,
        now,
        now
      );
    }

    return this.getSession();
  }

  // Update cloud connection config
  updateConfig(supabaseUrl, supabaseAnonKey) {
    const existing = this.db.prepare(`SELECT id FROM cloud_session WHERE id = 'current_session'`).get();
    const now = new Date().toISOString();
    if (existing) {
      this.db.prepare(`
        UPDATE cloud_session SET
          supabase_url = ?,
          supabase_anon_key = ?,
          updated_at = ?
        WHERE id = 'current_session'
      `).run(supabaseUrl, supabaseAnonKey, now);
    } else {
      this.db.prepare(`
        INSERT INTO cloud_session (id, supabase_url, supabase_anon_key, sync_enabled, created_at, updated_at)
        VALUES ('current_session', ?, ?, 0, ?, ?)
      `).run(supabaseUrl, supabaseAnonKey, now, now);
    }
    return this.getSession();
  }

  // Clear session on sign out
  signOut() {
    this.db.prepare(`
      UPDATE cloud_session SET
        user_id = NULL,
        email = NULL,
        access_token = NULL,
        refresh_token = NULL,
        expires_at = NULL,
        sync_enabled = 0,
        updated_at = ?
      WHERE id = 'current_session'
    `).run(new Date().toISOString());

    return { success: true };
  }

  // Authenticate with Supabase Auth API
  async signIn(email, password, config = {}) {
    const current = this.getSession();
    const supabaseUrl = (config.supabaseUrl || current?.supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
    const supabaseAnonKey = config.supabaseAnonKey || current?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;

    const endpoint = `${supabaseUrl}/auth/v1/token?grant_type=password`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json();

    if (!res.ok) {
      let msg = body.error_description || body.msg || body.message || 'Falha ao autenticar com o Supabase.';
      const lower = msg.toLowerCase();
      if (lower.includes('email not confirmed')) {
        msg = 'Seu e-mail ainda não foi confirmado! Acesse sua caixa de entrada e clique no link de confirmação para conseguir fazer o login.';
      } else if (lower.includes('invalid login credentials')) {
        msg = 'E-mail ou senha incorretos.';
      }
      throw new Error(msg);
    }

    const session = this.saveSession({
      userId: body.user?.id,
      email: body.user?.email || email,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: body.expires_at ? body.expires_at * 1000 : Date.now() + (body.expires_in || 3600) * 1000,
      supabaseUrl,
      supabaseAnonKey,
      syncEnabled: true,
    });

    // Tag existing local rows with this user_id if they didn't have one
    this.associateLocalDataWithUser(session.userId);

    return {
      success: true,
      user: {
        id: session.userId,
        email: session.email,
      },
      session,
    };
  }

  // Register new account with Supabase Auth API
  async signUp(email, password, config = {}) {
    const current = this.getSession();
    const supabaseUrl = (config.supabaseUrl || current?.supabaseUrl || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
    const supabaseAnonKey = config.supabaseAnonKey || current?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;

    const endpoint = `${supabaseUrl}/auth/v1/signup`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json();

    if (!res.ok) {
      let msg = body.error_description || body.msg || body.message || 'Falha ao registrar conta no Supabase.';
      const lower = msg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('user already exists')) {
        msg = 'Este e-mail já está cadastrado. Acesse a aba "Entrar" para fazer login.';
      }
      throw new Error(msg);
    }

    if (body.access_token) {
      const session = this.saveSession({
        userId: body.user?.id,
        email: body.user?.email || email,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: body.expires_at ? body.expires_at * 1000 : Date.now() + 3600000,
        supabaseUrl,
        supabaseAnonKey,
        syncEnabled: true,
      });

      this.associateLocalDataWithUser(session.userId);

      return {
        success: true,
        user: { id: session.userId, email: session.email },
        session,
        confirmed: true,
      };
    }

    return {
      success: true,
      user: { id: body.id, email: body.email },
      confirmed: false,
      message: 'Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro antes de fazer login.',
    };
  }

  // Associate existing local rows with user_id and mark for sync
  associateLocalDataWithUser(userId) {
    if (!userId) return;
    const tables = [
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
    for (const t of tables) {
      try {
        this.db.prepare(`
          UPDATE ${t}
          SET user_id = ?, sync_status = 'pending'
          WHERE user_id IS NULL OR user_id = '' OR user_id = ?
        `).run(userId, userId);
      } catch (e) {
        console.error(`[CloudAuth] Error associating table ${t}:`, e.message);
      }
    }
  }
}

module.exports = {
  CloudAuth,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
};
