/**
 * RMA Front Elevation Designer - Supabase Client Manager
 * Supports user authentication and isolated cloud storage when Supabase environment URL/key are configured.
 */

class SupabaseManager {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.initFromLocalStorage();
  }

  initFromLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    const url = localStorage.getItem('rma_sb_url');
    const key = localStorage.getItem('rma_sb_key');

    if (url && key && window.supabase) {
      try {
        this.client = window.supabase.createClient(url, key);
        this.checkAuthSession();
      } catch (e) {
        console.warn('Supabase initialization error:', e);
      }
    }
  }

  configure(url, key) {
    if (!url || !key) return false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rma_sb_url', url);
      localStorage.setItem('rma_sb_key', key);
    }
    if (window.supabase) {
      this.client = window.supabase.createClient(url, key);
      return true;
    }
    return false;
  }

  async checkAuthSession() {
    if (!this.client) return null;
    const { data: { session }, error } = await this.client.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      this.updateAuthUI();
    }
    return this.currentUser;
  }

  async signUp(email, password) {
    if (!this.client) throw new Error('Supabase project configuration required in Settings.');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this.updateAuthUI();
    return data;
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase project configuration required in Settings.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this.updateAuthUI();
    return data;
  }

  async signOut() {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.currentUser = null;
    this.updateAuthUI();
  }

  async resetPassword(email) {
    if (!this.client) throw new Error('Supabase project configuration required in Settings.');
    const { data, error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  }

  updateAuthUI() {
    const label = typeof document !== 'undefined' ? document.getElementById('authUserLabel') : null;
    if (label) {
      label.textContent = this.currentUser ? this.currentUser.email.split('@')[0] : 'Sign In';
    }
  }
}

window.SupabaseManager = SupabaseManager;
