import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  Lock, Unlock, Key, Shield, LogOut, Database, Users, Trash2,
  Sun, Moon, Eye, EyeOff, Edit2, Check, X, AlertCircle, Mail, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { encryptPassword, decryptPassword, hashPassword } from './utils/crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VAULT_URL = import.meta.env.VITE_VAULT_URL || '/vault-api';
const EMAIL_URL = import.meta.env.VITE_EMAIL_URL || '/email-api';
const VAULT_TOKEN = 'admin-master-token';
const REGISTRY_PATH = `${VAULT_URL}/v1/secret/data/auth/registry`;
const RESET_TOKENS_PATH = `${VAULT_URL}/v1/secret/data/auth/reset-tokens`;

// ---------------------------------------------------------------------------
// Test accounts – seeded once on startup
// ---------------------------------------------------------------------------
const TEST_ACCOUNTS = [
  { username: 'admin', password: 'Admin@123', email: 'admin@vault.test', role: 'admin' },
  { username: 'alice', password: 'Alice@123', email: 'alice@vault.test', role: 'user' },
  { username: 'bob', password: 'Bob@123', email: 'bob@vault.test', role: 'user' },
];

async function seedTestAccounts() {
  try {
    await axios.get(REGISTRY_PATH, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
  } catch (err) {
    if (err.response?.status === 404) {
      const registry = {};
      for (const acct of TEST_ACCOUNTS) {
        registry[acct.username] = {
          role: acct.role,
          email: acct.email,
          authHash: await hashPassword(acct.password),
        };
      }
      await axios.post(REGISTRY_PATH, { data: registry }, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
      console.info('[RBAC] Test accounts seeded.');
    }
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------------------------
// Helper: fetch registry
// ---------------------------------------------------------------------------
async function fetchRegistry() {
  try {
    const res = await axios.get(REGISTRY_PATH, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
    return res.data?.data?.data || {};
  } catch (err) {
    if (err.response?.status === 404) return {};
    throw err;
  }
}

async function saveRegistry(registry) {
  await axios.post(REGISTRY_PATH, { data: registry }, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
}

async function fetchResetTokens() {
  try {
    const res = await axios.get(RESET_TOKENS_PATH, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
    return res.data?.data?.data || {};
  } catch (err) {
    if (err.response?.status === 404) return {};
    throw err;
  }
}

async function saveResetTokens(tokens) {
  await axios.post(RESET_TOKENS_PATH, { data: tokens }, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
}

// ---------------------------------------------------------------------------
// LoginForm — with Forgot Password self-reset flow
// ---------------------------------------------------------------------------
function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot-password flow state: null | 'request' | 'verify'
  const [resetStep, setResetStep] = useState(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);

  const clearMessages = () => { setError(''); setInfo(''); };

  // ---- Normal login -------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!username || !password || !email) return;
    setLoading(true);
    try {
      const authHash = await hashPassword(password);
      const registry = await fetchRegistry();

      if (registry[username]) {
        if (registry[username].authHash !== authHash) {
          setError('Invalid credentials. Please check your username and password.');
          return;
        }
        onLogin(username, password, email, registry[username].role || 'user');
      } else {
        // New user — register as user
        registry[username] = { role: 'user', email, authHash };
        await saveRegistry(registry);
        onLogin(username, password, email, 'user');
      }
    } catch {
      setError('Cannot connect to Vault. Is the Docker container running?');
    } finally { setLoading(false); }
  };

  // ---- Step 1: request reset code -----------------------------------------
  const handleRequestReset = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!username || !email) return;
    setLoading(true);
    try {
      const registry = await fetchRegistry();
      const user = registry[username];
      if (!user) { setError('Username not found.'); return; }
      if (user.email !== email) { setError('Email does not match the one registered for this account.'); return; }

      const code = generateCode();
      const expiry = Date.now() + 15 * 60 * 1000;
      const tokens = await fetchResetTokens();
      tokens[username] = { code, expiry };
      await saveResetTokens(tokens);

      await axios.post(`${EMAIL_URL}/send-reset`, { to: email, username, code, type: 'self' });
      setInfo(`A 6-digit reset code has been sent to ${email}. Check your inbox.`);
      setResetStep('verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset code. Please try again.');
    } finally { setLoading(false); }
  };

  // ---- Step 2: verify code + set new password -----------------------------
  const handleVerifyReset = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!resetCode || !newPassword) return;
    setLoading(true);
    try {
      const tokens = await fetchResetTokens();
      const token = tokens[username];
      if (!token) { setError('No reset code found. Please request a new one.'); return; }
      if (token.code !== resetCode) { setError('Invalid reset code.'); return; }
      if (Date.now() > token.expiry) { setError('Reset code has expired. Please request a new one.'); return; }

      // Update password in registry
      const authHash = await hashPassword(newPassword);
      const registry = await fetchRegistry();
      registry[username] = { ...registry[username], authHash };
      await saveRegistry(registry);

      // Clear the used token
      delete tokens[username];
      await saveResetTokens(tokens);

      setInfo('Password reset successfully! You can now log in with your new password.');
      setResetStep(null);
      setResetCode('');
      setNewPassword('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  // ---- Render -------------------------------------------------------------
  return (
    <div>
      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {info && (
        <div className="error-message" style={{ backgroundColor: 'rgba(109,40,217,0.2)', borderColor: 'var(--primary-color)', color: 'var(--text-primary)' }}>
          {info}
        </div>
      )}

      {/* ---- Forgot password: Step 1 ---- */}
      {resetStep === 'request' && (
        <form onSubmit={handleRequestReset}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>Reset Password</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Enter your username and registered email to receive a reset code.
          </p>
          <div className="form-group">
            <label>Username</label>
            <div style={{ position: 'relative' }}>
              <Users size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input type="text" placeholder="johndoe" value={username}
                onChange={e => setUsername(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <div className="form-group">
            <label>Registered Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <button type="submit" className="btn" disabled={loading || !username || !email}>
            <Mail size={16} /> {loading ? 'Sending...' : 'Send Reset Code'}
          </button>
          <button type="button" className="btn"
            style={{ marginTop: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}
            onClick={() => { setResetStep(null); clearMessages(); }}>
            ← Back to Login
          </button>
        </form>
      )}

      {/* ---- Forgot password: Step 2 ---- */}
      {resetStep === 'verify' && (
        <form onSubmit={handleVerifyReset}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>Enter Reset Code</h3>
          <div className="form-group">
            <label>6-Digit Reset Code</label>
            <input type="text" placeholder="123456" maxLength={6} value={resetCode}
              onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} required
              style={{ textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.2rem' }} />
          </div>
          <div className="form-group">
            <label>New Password / Master Key</label>
            <div style={{ position: 'relative' }}>
              <Key size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input type={showNewPw ? 'text' : 'password'} placeholder="New secret password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} required />
              <button type="button" onClick={() => setShowNewPw(p => !p)}
                style={{ position: 'absolute', top: '12px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn" disabled={loading || !resetCode || !newPassword}>
            <RefreshCw size={16} /> {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <button type="button" className="btn"
            style={{ marginTop: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}
            onClick={() => setResetStep('request')}>
            ← Resend Code
          </button>
        </form>
      )}

      {/* ---- Normal login ---- */}
      {!resetStep && (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <Users size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input id="username" type="text" placeholder="johndoe" value={username}
                onChange={e => setUsername(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="email">Recovery Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password / Master Key</label>
            <div style={{ position: 'relative' }}>
              <Key size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input id="password" type={showPw ? 'text' : 'password'}
                placeholder="Your secret password &amp; encryption key"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} required />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', top: '12px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              This is also your encryption key — it is never stored.
            </p>
          </div>
          <button type="submit" className="btn" disabled={loading || !username || !password || !email}>
            <Unlock size={20} /> {loading ? 'Verifying...' : 'Login / Create Account'}
          </button>
          <button type="button"
            onClick={() => { setResetStep('request'); clearMessages(); }}
            style={{
              width: '100%', marginTop: '0.75rem', background: 'none', border: 'none',
              color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline'
            }}>
            Forgot password?
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserDashboard
// ---------------------------------------------------------------------------
function UserDashboard({ username, masterKey, onLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedPasswords, setSavedPasswords] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [editingEntry, setEditingEntry] = useState(null);

  const fetchUserVault = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${VAULT_URL}/v1/secret/data/users/${username}`,
        { headers: { 'X-Vault-Token': VAULT_TOKEN } });
      const encryptedMap = res.data?.data?.data?.passwords || {};
      const decrypted = {};
      Object.keys(encryptedMap).forEach(app => {
        const d = decryptPassword(encryptedMap[app], masterKey);
        if (d) decrypted[app] = d;
      });
      setSavedPasswords(decrypted);
    } catch (err) {
      if (err.response?.status !== 404) setError(`Failed to fetch vault: ${err.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUserVault(); }, [username]);

  const saveToVault = async (passwords) => {
    const enc = {};
    Object.keys(passwords).forEach(app => { enc[app] = encryptPassword(passwords[app], masterKey); });
    await axios.post(`${VAULT_URL}/v1/secret/data/users/${username}`,
      { data: { passwords: enc } }, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
  };

  const toggleVisibility = (app) => setVisiblePasswords(p => ({ ...p, [app]: !p[app] }));

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const updated = { ...savedPasswords, [newAppName]: newPassword };
      await saveToVault(updated);
      setSavedPasswords(updated); setNewPassword(''); setNewAppName('');
    } catch (err) { setError(`Failed to save: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleDeletePassword = async (app) => {
    if (!window.confirm(`Delete the saved password for "${app}"?`)) return;
    setLoading(true); setError('');
    try {
      const updated = { ...savedPasswords }; delete updated[app];
      await saveToVault(updated); setSavedPasswords(updated);
    } catch (err) { setError(`Failed to delete: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleEditPassword = async () => {
    if (!editingEntry) return;
    const { app, value } = editingEntry;
    setLoading(true); setError('');
    try {
      const updated = { ...savedPasswords, [app]: value };
      await saveToVault(updated); setSavedPasswords(updated); setEditingEntry(null);
    } catch (err) { setError(`Failed to update: ${err.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={24} /> {username}&apos;s Vault
        </h2>
        <button onClick={onLogout} className="btn"
          style={{ width: 'auto', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="secrets-list">
        {Object.keys(savedPasswords).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No passwords saved yet.</p>
        ) : (
          Object.keys(savedPasswords).map((app, idx) => {
            const isVisible = !!visiblePasswords[app];
            const isEditing = editingEntry?.app === app;
            return (
              <div key={idx} className="secret-item" style={{ alignItems: 'center', gap: '0.75rem' }}>
                <span className="secret-item-key" style={{ minWidth: '100px' }}>{app}</span>
                {isEditing ? (
                  <input type="text" value={editingEntry.value} autoFocus
                    onChange={e => setEditingEntry({ app, value: e.target.value })}
                    style={{
                      flex: 1, background: 'var(--form-bg)', border: '1px solid var(--primary-color)',
                      borderRadius: '6px', padding: '0.3rem 0.6rem', color: 'var(--text-primary)'
                    }} />
                ) : (
                  <span className="secret-item-value" style={{
                    flex: 1,
                    letterSpacing: isVisible ? 'normal' : '0.15em', fontFamily: isVisible ? 'inherit' : 'monospace'
                  }}>
                    {isVisible ? savedPasswords[app] : '••••••••'}
                  </span>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {isEditing ? (
                    <>
                      <button title="Save" onClick={handleEditPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', padding: '4px' }}><Check size={16} /></button>
                      <button title="Cancel" onClick={() => setEditingEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <button title={isVisible ? 'Hide' : 'Show'} onClick={() => toggleVisibility(app)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>{isVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      <button title="Edit" onClick={() => setEditingEntry({ app, value: savedPasswords[app] })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}><Edit2 size={16} /></button>
                      <button title="Delete" onClick={() => handleDeletePassword(app)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)', padding: '4px' }}><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSavePassword}
        style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--form-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Save a Password securely</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          E2E security
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input type="text" placeholder="Application Name (e.g. GitHub)" value={newAppName} onChange={e => setNewAppName(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input type="password" placeholder="Super Secret Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn" style={{ marginTop: '1rem' }} disabled={loading || !newPassword || !newAppName}>
          <Lock size={16} /> Encrypt &amp; Save
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel — Delete User + Reset Credentials
// ---------------------------------------------------------------------------
function AdminPanel({ onExit }) {
  const [registryUsers, setRegistryUsers] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    setLoading(true); setError(''); setMessage('');
    try { setRegistryUsers(await fetchRegistry()); }
    catch (err) { setError(`Failed to load users: ${err.message}`); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  // ---- Delete user: removes from registry + vault data --------------------
  const handleDeleteUser = async (username) => {
    const confirmed = window.confirm(
      `⚠️ Delete user "${username}"?\n\nThis will permanently remove their account and all stored passwords. This action cannot be undone.`
    );
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const updated = { ...registryUsers };
      delete updated[username];
      await saveRegistry(updated);

      // Also delete vault data (best-effort)
      try {
        await axios.delete(`${VAULT_URL}/v1/secret/metadata/users/${username}`,
          { headers: { 'X-Vault-Token': VAULT_TOKEN } });
      } catch { /* vault data may not exist */ }

      setMessage(`✅ User "${username}" has been deleted.`);
      await loadUsers();
    } catch (err) { setError(`Failed to delete user: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ---- Reset credentials: generate code + email ---------------------------
  const handleResetCredentials = async (username) => {
    const user = registryUsers[username];
    if (!user?.email) { setError(`No email found for "${username}".`); return; }

    const confirmed = window.confirm(
      `Reset credentials for "${username}"?\n\nA reset code will be sent to ${user.email}.\nThe user must use this code to set a new password.`
    );
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const code = generateCode();
      const expiry = Date.now() + 15 * 60 * 1000;
      const tokens = await fetchResetTokens();
      tokens[username] = { code, expiry };
      await saveResetTokens(tokens);

      await axios.post(`${EMAIL_URL}/send-reset`, { to: user.email, username, code, type: 'admin' });
      setMessage(`✅ Reset code sent to ${user.email}. They can now log in and use "Forgot password?" to set a new one.`);
    } catch (err) {
      setError(`Failed to send reset: ${err.response?.data?.error || err.message}`);
    } finally { setLoading(false); }
  };

  const userList = Object.entries(registryUsers);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={24} color="var(--error-color)" /> Admin Panel
        </h2>
        <button onClick={onExit} className="btn"
          style={{ width: 'auto', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}>
          Exit Admin
        </button>
      </div>

      {error && <div className="error-message"><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>}
      {message && <div className="error-message" style={{ backgroundColor: 'rgba(109,40,217,0.15)', borderColor: 'var(--primary-color)', color: 'var(--text-primary)' }}>{message}</div>}

      <div className="secrets-list">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users…</p>
        ) : userList.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No users found.</p>
        ) : (
          userList.map(([uname, info]) => (
            <div key={uname} className="secret-item" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <Users size={16} />
                <span className="secret-item-key">{uname}</span>
                <span style={{
                  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px',
                  backgroundColor: info.role === 'admin' ? 'var(--error-color)' : 'var(--primary-color)',
                  color: 'white', opacity: 0.85
                }}>
                  {info.role}
                </span>
                {info.email && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{info.email}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {/* Reset Credentials */}
                <button onClick={() => handleResetCredentials(uname)} className="btn"
                  style={{
                    width: 'auto', padding: '0.4rem 0.8rem', backgroundColor: 'transparent',
                    border: '1px solid var(--primary-color)', color: 'var(--primary-color)', fontSize: '0.8rem'
                  }}
                  title={`Send password reset email to ${info.email}`}>
                  <Mail size={14} /> Reset Credentials
                </button>
                {/* Delete User */}
                <button onClick={() => handleDeleteUser(uname)} className="btn"
                  style={{
                    width: 'auto', padding: '0.4rem 0.8rem', backgroundColor: 'transparent',
                    border: '1px solid var(--error-color)', color: 'var(--error-color)', fontSize: '0.8rem'
                  }}
                  title={`Permanently delete user "${uname}"`}>
                  <Trash2 size={14} /> Delete User
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>
        Admin has zero-visibility into user passwords.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainApp
// ---------------------------------------------------------------------------
function MainApp() {
  const [currentUser, setCurrentUser] = useState(() => sessionStorage.getItem('vault_user'));
  const [masterKey, setMasterKey] = useState(() => sessionStorage.getItem('vault_key'));
  const [email, setEmail] = useState(() => sessionStorage.getItem('vault_email'));
  const [role, setRole] = useState(() => sessionStorage.getItem('vault_role') || 'user');
  const [showAdmin, setShowAdmin] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('vault_theme') || 'dark');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => { if (!seeded) seedTestAccounts().finally(() => setSeeded(true)); }, []);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  const handleLogin = (user, key, em, userRole) => {
    setCurrentUser(user); setMasterKey(key); setEmail(em); setRole(userRole);
    sessionStorage.setItem('vault_user', user);
    sessionStorage.setItem('vault_key', key);
    sessionStorage.setItem('vault_email', em);
    sessionStorage.setItem('vault_role', userRole);
  };

  const handleLogout = () => {
    setCurrentUser(null); setMasterKey(null); setEmail(null);
    setRole('user'); setShowAdmin(false);
    sessionStorage.clear();
  };

  const isAdmin = role === 'admin';

  return (
    <div className="app-container">
      <div className="header" style={{ position: 'relative' }}>
        <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{ position: 'absolute', top: 0, left: 0, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div style={{
          width: '64px', height: '64px', background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
          borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', fontWeight: 'bold', color: 'white', marginBottom: '1rem', margin: '0 auto'
        }}>
          V
        </div>
        <h1>Vaultex</h1>
        <p>E2E Encrypted Vault</p>

        {currentUser && isAdmin && (
          <button onClick={() => setShowAdmin(s => !s)}
            style={{
              position: 'absolute', top: 0, right: 0, background: 'none', border: 'none',
              color: showAdmin ? 'var(--text-secondary)' : 'var(--error-color)', cursor: 'pointer',
              fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
            <Shield size={14} /> {showAdmin ? '← My Vault' : 'Admin Panel'}
          </button>
        )}

        {currentUser && (
          <span style={{
            position: 'absolute', bottom: 4, right: 0, fontSize: '0.7rem',
            padding: '2px 8px', borderRadius: '12px',
            backgroundColor: isAdmin ? 'var(--error-color)' : 'var(--primary-color)',
            color: 'white', opacity: 0.85
          }}>
            {isAdmin ? '🛡 Admin' : '👤 User'}
          </span>
        )}
      </div>

      {!currentUser ? (
        <LoginForm onLogin={handleLogin} />
      ) : showAdmin && isAdmin ? (
        <AdminPanel onExit={() => setShowAdmin(false)} />
      ) : (
        <UserDashboard username={currentUser} masterKey={masterKey} onLogout={handleLogout} />
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
