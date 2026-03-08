import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  Lock, Unlock, Key, Shield, LogOut, Database, Users, Trash2,
  Sun, Moon, Eye, EyeOff, Edit2, Check, X, AlertCircle, Mail,
  Copy, Search, Plus, Link, User, Tag, RefreshCw
} from 'lucide-react';
import { encryptPassword, decryptPassword } from './utils/crypto';
import { supabase } from './lib/supabase';

// ── Toast System ──────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, toast: add };
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ── Password Strength ─────────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 20, label: 'Weak', color: '#f87171' };
  if (s <= 2) return { score: 40, label: 'Fair', color: '#fbbf24' };
  if (s <= 3) return { score: 65, label: 'Good', color: '#a78bfa' };
  if (s <= 4) return { score: 85, label: 'Strong', color: '#34d399' };
  return { score: 100, label: 'Great', color: '#10b981' };
}

// ── Category helpers ──────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Work', 'Social', 'Finance', 'Gaming', 'Other'];
const catClass = (c = '') => `cat-${c.toLowerCase()}`;

// ── Copy to clipboard ─────────────────────────────────────────────────────────
function CopyButton({ text, toast }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('Copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast('Failed to copy', 'error'); }
  };
  return (
    <button className={`icon-btn copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy} title="Copy password">
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

// ── Vault entry helpers ───────────────────────────────────────────────────────
// Entries can be legacy string or new object: { password, username, url, category }
const toEntry = (v) => typeof v === 'string'
  ? { password: v, username: '', url: '', category: 'Other' }
  : v;

// ── LoginForm ─────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false); // false | 'request' | 'verify'
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const clear = () => { setError(''); setInfo(''); };

  const handleAuth = async (e) => {
    e.preventDefault(); clear();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data: si, error: sie } = await supabase.auth.signInWithPassword({ email, password });
      if (sie) {
        if (sie.message.toLowerCase().includes('invalid login credentials')) {
          const { data: su, error: sue } = await supabase.auth.signUp({ email, password });
          if (sue) throw sue;
          if (su.user && su.session) {
            setInfo('Account created! Logging you in…');
            onLogin(su.user.email, password, su.user.id);
          } else {
            setInfo('Check your email for a confirmation link.');
          }
        } else throw sie;
      } else {
        onLogin(si.user.email, password, si.user.id);
      }
    } catch (err) { setError(err.message || 'Authentication failed.'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault(); clear();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setInfo(`Reset code sent to ${email}. Check your inbox.`);
      setResetMode('verify');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault(); clear();
    if (!email || !otpCode || !newPassword) return;
    setLoading(true);
    try {
      // 1. Verify OTP code
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'recovery'
      });
      if (verifyError) throw verifyError;

      // 2. Update the user's password now that they are verified/logged in
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;

      setInfo('Password successfully reset! Logging you in...');
      onLogin(data.user.email, newPassword, data.user.id);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {error && <div className="msg error"><AlertCircle size={15} />{error}</div>}
      {info && <div className="msg info">{info}</div>}

      {resetMode === 'verify' ? (
        <form onSubmit={handleVerifyOTP}>
          <h3 style={{ textAlign: 'center', marginBottom: '0.75rem', marginTop: 0 }}>Enter Reset Code</h3>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Enter the 6-digit code sent to your email.
          </p>
          <div className="form-group">
            <label>Reset Code</label>
            <div className="input-wrap">
              <Key size={16} className="input-icon" />
              <input type="text" className="has-icon" placeholder="123456"
                value={otpCode} onChange={e => setOtpCode(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>New Master Password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input type="password" className="has-icon" placeholder="New master password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading || !otpCode || !newPassword}>
            <Unlock size={15} /> {loading ? 'Verifying…' : 'Reset Password'}
          </button>
          <button className="btn ghost" type="button"
            style={{ marginTop: '0.5rem' }}
            onClick={() => { setResetMode(false); clear(); }}>
            ← Back to Login
          </button>
        </form>
      ) : resetMode === 'request' ? (
        <form onSubmit={handleReset}>
          <h3 style={{ textAlign: 'center', marginBottom: '0.75rem', marginTop: 0 }}>Reset Password</h3>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Enter your email to receive a reset code.
          </p>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input type="email" className="has-icon" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading || !email}>
            <Mail size={15} /> {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button className="btn ghost" type="button"
            style={{ marginTop: '0.5rem' }}
            onClick={() => { setResetMode(false); clear(); }}>
            ← Back to Login
          </button>
        </form>
      ) : (
        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input id="email" type="email" className="has-icon" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Master Password / Encryption Key</label>
            <div className="input-wrap">
              <Key size={16} className="input-icon" />
              <input id="password" type={showPw ? 'text' : 'password'}
                className="has-icon has-icon-right"
                placeholder="Your secret master password"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="eye-btn" onClick={() => setShowPw(p => !p)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="hint">This is also your encryption key — it is never stored or transmitted.</p>
          </div>
          <button className="btn" type="submit" disabled={loading || !email || !password}>
            <Unlock size={16} /> {loading ? 'Authenticating…' : 'Login / Sign Up'}
          </button>
          <button type="button"
            onClick={() => { setResetMode('request'); clear(); }}
            style={{
              width: '100%', marginTop: '0.75rem', background: 'none', border: 'none',
              color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'
            }}>
            Forgot password?
          </button>
        </form>
      )}
    </div>
  );
}

// ── UserDashboard ─────────────────────────────────────────────────────────────
function UserDashboard({ username, masterKey, onLogout, toast }) {
  const [loading, setLoading] = useState(false);
  const [savedPasswords, setSavedPW] = useState({});
  const [newApp, setNewApp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCat, setNewCat] = useState('Other');
  const [visible, setVisible] = useState({});
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('All');

  const strength = getStrength(newPw);

  const fetchVault = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('user_vaults').select('encrypted_data').single();
      if (error) {
        if (error.code === 'PGRST116') { setSavedPW({}); }
        else throw error;
      } else {
        const enc = data.encrypted_data || {};
        const dec = {};
        Object.keys(enc).forEach(app => {
          const raw = decryptPassword(enc[app], masterKey);
          if (raw) {
            try { dec[app] = JSON.parse(raw); }
            catch { dec[app] = { password: raw, username: '', url: '', category: 'Other' }; }
          }
        });
        setSavedPW(dec);
      }
    } catch (err) { toast(`Failed to fetch vault: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  }, [masterKey, toast]);

  useEffect(() => { fetchVault(); }, [fetchVault]);

  const persistVault = async (passwords) => {
    const { data: { user } } = await supabase.auth.getUser();
    const enc = {};
    Object.keys(passwords).forEach(app => {
      enc[app] = encryptPassword(JSON.stringify(passwords[app]), masterKey);
    });
    const { error } = await supabase.from('user_vaults')
      .upsert({ user_id: user.id, encrypted_data: enc, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' });
    if (error) throw error;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newApp.trim() || !newPw.trim()) return;
    setLoading(true);
    try {
      const entry = { password: newPw, username: newUser, url: newUrl, category: newCat };
      const updated = { ...savedPasswords, [newApp.trim()]: entry };
      await persistVault(updated);
      setSavedPW(updated);
      setNewApp(''); setNewPw(''); setNewUser(''); setNewUrl(''); setNewCat('Other');
      toast(`"${newApp.trim()}" saved to vault!`, 'success');
    } catch (err) { toast(`Failed to save: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (app) => {
    if (!window.confirm(`Delete the saved password for "${app}"?`)) return;
    setLoading(true);
    try {
      const updated = { ...savedPasswords }; delete updated[app];
      await persistVault(updated); setSavedPW(updated);
      toast(`"${app}" deleted.`, 'info');
    } catch (err) { toast(`Failed to delete: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      const updated = { ...savedPasswords, [editing.app]: editing.entry };
      await persistVault(updated); setSavedPW(updated); setEditing(null);
      toast('Password updated!', 'success');
    } catch (err) { toast(`Failed to update: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  };

  // Filter entries
  const filtered = Object.entries(savedPasswords).filter(([app, v]) => {
    const entry = toEntry(v);
    const matchSearch = app.toLowerCase().includes(search.toLowerCase()) ||
      (entry.username || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCat === 'All' || entry.category === activeCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="dashboard">
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={20} /> My Vault
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            ({Object.keys(savedPasswords).length} entries)
          </span>
        </h2>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={onLogout}>
          <LogOut size={15} /> Logout
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input placeholder="Search by name or username…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="cat-filter">
          {CATEGORIES.map(c => (
            <span key={c} className={`cat-chip ${activeCat === c ? 'active' : ''}`}
              onClick={() => setActiveCat(c)}>{c}</span>
          ))}
        </div>
      </div>

      {/* Vault list */}
      <div className="vault-list">
        {loading ? (
          <div className="vault-empty"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="vault-empty">
            {search || activeCat !== 'All' ? 'No entries match your search.' : 'No passwords saved yet. Add one below!'}
          </div>
        ) : filtered.map(([app, raw]) => {
          const entry = toEntry(raw);
          const isVis = !!visible[app];
          const isEd = editing?.app === app;
          const initials = app.slice(0, 2).toUpperCase();

          return (
            <div key={app} className="vault-item">
              <div className="vault-item-icon">{initials}</div>
              <div className="vault-item-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="vault-item-name">{app}</span>
                  <span className={`cat-badge ${catClass(entry.category)}`}>{entry.category}</span>
                </div>
                <div className="vault-item-meta">
                  {entry.username && <span><User size={11} /> {entry.username}</span>}
                  {entry.url && <a href={entry.url} target="_blank" rel="noreferrer"><Link size={11} /> {entry.url.replace(/^https?:\/\//, '')}</a>}
                </div>
              </div>

              {/* Password display / edit */}
              {isEd ? (
                <input className="edit-input" type="text" autoFocus
                  value={editing.entry.password}
                  onChange={e => setEditing({ ...editing, entry: { ...editing.entry, password: e.target.value } })} />
              ) : (
                <span className={`vault-item-pw ${isVis ? 'visible' : ''}`}>
                  {isVis ? entry.password : '••••••••'}
                </span>
              )}

              <div className="vault-item-actions">
                {isEd ? (
                  <>
                    <button className="icon-btn" onClick={handleEditSave} title="Save"><Check size={15} /></button>
                    <button className="icon-btn" onClick={() => setEditing(null)} title="Cancel"><X size={15} /></button>
                  </>
                ) : (
                  <>
                    <button className="icon-btn" onClick={() => setVisible(v => ({ ...v, [app]: !v[app] }))}
                      title={isVis ? 'Hide' : 'Show'}>
                      {isVis ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <CopyButton text={entry.password} toast={toast} />
                    <button className="icon-btn" title="Edit"
                      onClick={() => setEditing({ app, entry: { ...entry } })}>
                      <Edit2 size={15} />
                    </button>
                    <button className="icon-btn delete" title="Delete"
                      onClick={() => handleDelete(app)}>
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save form */}
      <div className="save-form">
        <h3><Plus size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Save a Password</h3>
        <p className="hint">All passwords are encrypted end-to-end before being stored.</p>
        <form onSubmit={handleSave}>
          <div className="save-form-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input placeholder="App / Site name *" value={newApp}
                onChange={e => setNewApp(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input placeholder="Username / Email"
                value={newUser} onChange={e => setNewUser(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input placeholder="URL (https://…)"
                value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select value={newCat} onChange={e => setNewCat(e.target.value)}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
            <input type="password" placeholder="Password *"
              value={newPw} onChange={e => setNewPw(e.target.value)} required />
            {newPw && (
              <div className="strength-wrap">
                <div className="strength-track">
                  <div className="strength-fill"
                    style={{ width: `${strength.score}%`, background: strength.color }} />
                </div>
                <div className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>

          <button className="btn" type="submit"
            disabled={loading || !newApp || !newPw} style={{ marginTop: '0.25rem' }}>
            <Lock size={15} /> Encrypt & Save
          </button>
        </form>
      </div>
    </div>
  );
}

// ── AdminPanel ────────────────────────────────────────────────────────────────
function AdminPanel({ onExit, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null); // userId being sent reset

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_vaults')
        .select('user_id, updated_at');
      if (error) throw error;

      // Try to get email from auth.users via RPC (if available), else show ID
      // We'll attempt a profile lookup via the user_id
      setUsers(data || []);
    } catch (err) { toast(`Failed to load users: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleClearVault = async (userId) => {
    if (!window.confirm('Delete all vault data for this user?\n\nTheir account will remain active.')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('user_vaults').delete().eq('user_id', userId);
      if (error) throw error;
      toast('Vault data cleared. Account still active.', 'success');
      await loadUsers();
    } catch (err) { toast(`Failed to clear vault: ${err.message}`, 'error'); }
    finally { setLoading(false); }
  };

  const handleSendReset = async (userId) => {
    const email = prompt('Enter user email to send reset code:');
    if (!email) return;
    setSending(userId);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const res = await fetch('/.netlify/functions/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, username: email.split('@')[0], code, type: 'admin' })
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Reset code sent to ${email}!`, 'success');
    } catch (err) { toast(`Email failed: ${err.message}`, 'error'); }
    finally { setSending(null); }
  };

  return (
    <div className="dashboard">
      <div className="admin-header">
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="var(--error)" /> Admin Panel
        </h2>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={onExit}>
          ← My Vault
        </button>
      </div>

      <div className="vault-list">
        {loading ? (
          <div className="vault-empty"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="vault-empty">No vault users found.</div>
        ) : users.map(u => (
          <div key={u.user_id} className="admin-user-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="vault-item-icon" style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)' }}>
                <Users size={16} color="#fff" />
              </div>
              <div>
                <div className="admin-user-email" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                  {u.user_id}
                </div>
                <div className="admin-user-meta">
                  Last active: {new Date(u.updated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="admin-actions">
              <button
                className="btn"
                style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                disabled={sending === u.user_id}
                onClick={() => handleSendReset(u.user_id)}
                title="Send password reset email">
                {sending === u.user_id
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Sending…</>
                  : <><Mail size={13} /> Send Reset</>}
              </button>
              <button
                className="btn danger"
                style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => handleClearVault(u.user_id)}
                title="Clear vault data">
                <Trash2 size={13} /> Clear Vault
              </button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        ⚠️ Admins have zero-visibility into user passwords. Only encrypted blobs are stored.
      </p>
    </div>
  );
}

// ── Unlock screen (session restore) ──────────────────────────────────────────
function UnlockScreen({ username, onUnlock, onLogout }) {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Verify credentials against Supabase
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: username, password: pw });
      if (err) throw err;
      onUnlock(pw);
    } catch { setError('Incorrect password. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="unlock-screen">
      <div className="vault-item-icon" style={{ width: 56, height: 56, fontSize: '1.4rem', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
        🔒
      </div>
      <p>Welcome back, <strong>{username}</strong>!</p>
      <p>Enter your master password to decrypt your vault.</p>
      {error && <div className="msg error" style={{ width: '100%' }}><AlertCircle size={15} />{error}</div>}
      <form onSubmit={handleUnlock} style={{ width: '100%', maxWidth: 340 }}>
        <div className="form-group">
          <div className="input-wrap">
            <Key size={16} className="input-icon" />
            <input type={show ? 'text' : 'password'} className="has-icon has-icon-right"
              placeholder="Master password"
              value={pw} onChange={e => setPw(e.target.value)} autoFocus required />
            <button type="button" className="eye-btn" onClick={() => setShow(s => !s)}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button className="btn" type="submit" disabled={loading || !pw}>
          <Unlock size={15} /> {loading ? 'Unlocking…' : 'Unlock Vault'}
        </button>
        <button className="btn ghost" type="button"
          style={{ marginTop: '0.5rem' }} onClick={onLogout}>
          <LogOut size={14} /> Log out
        </button>
      </form>
    </div>
  );
}

// ── MainApp ───────────────────────────────────────────────────────────────────
function MainApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [masterKey, setMasterKey] = useState(null);
  const [role, setRole] = useState('user');
  const [showAdmin, setShowAdmin] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('vault_theme') || 'dark');
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const { toasts, toast } = useToast();

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  useEffect(() => {
    const restore = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const email = session.user.email;
        setCurrentUser(email);
        const isAdmin = email.startsWith('admin@') || email === import.meta.env.VITE_ADMIN_EMAIL;
        setRole(isAdmin ? 'admin' : 'user');
      }
      setSessionLoaded(true);
    };
    restore();
  }, []);

  const handleLogin = (email, key) => {
    setCurrentUser(email);
    setMasterKey(key);
    const isAdmin = email.startsWith('admin@') || email === import.meta.env.VITE_ADMIN_EMAIL;
    setRole(isAdmin ? 'admin' : 'user');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null); setMasterKey(null); setRole('user'); setShowAdmin(false);
  };

  const isAdmin = role === 'admin';
  if (!sessionLoaded) return null;

  return (
    <div className="app-container">
      <ToastContainer toasts={toasts} />

      <div className="header">
        <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="logo-block">V</div>
        <h1>Vaultex</h1>
        <p>E2E Encrypted Vault</p>

        {currentUser && isAdmin && (
          <button className="admin-toggle-btn"
            style={{ color: showAdmin ? 'var(--text-muted)' : 'var(--error)' }}
            onClick={() => setShowAdmin(s => !s)}>
            <Shield size={14} /> {showAdmin ? '← My Vault' : 'Admin Panel'}
          </button>
        )}

        {currentUser && (
          <span className="role-badge"
            style={{ background: isAdmin ? 'var(--error)' : 'var(--primary)' }}>
            {isAdmin ? '🛡 Admin' : '👤 User'}
          </span>
        )}
      </div>

      {!currentUser ? (
        <LoginForm onLogin={handleLogin} />
      ) : !masterKey ? (
        <UnlockScreen
          username={currentUser}
          onUnlock={(key) => setMasterKey(key)}
          onLogout={handleLogout}
        />
      ) : showAdmin && isAdmin ? (
        <AdminPanel onExit={() => setShowAdmin(false)} toast={toast} />
      ) : (
        <UserDashboard username={currentUser} masterKey={masterKey} onLogout={handleLogout} toast={toast} />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;
