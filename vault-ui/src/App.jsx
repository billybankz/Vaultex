import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  Lock, Unlock, Key, Shield, LogOut, Database, Users, Trash2,
  Sun, Moon, Eye, EyeOff, Edit2, Check, X, AlertCircle, Mail
} from 'lucide-react';
import { encryptPassword, decryptPassword } from './utils/crypto';
import { supabase } from './lib/supabase';

// ---------------------------------------------------------------------------
// LoginForm — Supabase Auth
// ---------------------------------------------------------------------------
function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState(null);

  const clearMessages = () => { setError(''); setInfo(''); };

  const handleAuth = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          // User doesn't exist — try sign up
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw signUpError;
          if (signUpData.user && signUpData.session) {
            setInfo('Account created! Logging you in…');
            onLogin(signUpData.user.email, password, signUpData.user.id);
          } else {
            setInfo('Check your email for a confirmation link before logging in.');
          }
        } else {
          throw signInError;
        }
      } else {
        onLogin(signInData.user.email, password, signInData.user.id);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setInfo(`Password reset link sent to ${email}. Check your inbox.`);
      setResetStep(null);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div>
      {error && (
        <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {info && (
        <div className="error-message" style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderColor: 'var(--primary-color)', color: 'var(--text-primary)' }}>
          {info}
        </div>
      )}

      {resetStep === 'request' ? (
        <form onSubmit={handleRequestReset}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>Reset Password</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Enter your email to receive a password reset link.
          </p>
          <div className="form-group">
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <button type="submit" className="btn" disabled={loading || !email}>
            <Mail size={16} /> {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button type="button" className="btn"
            style={{ marginTop: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}
            onClick={() => { setResetStep(null); clearMessages(); }}>
            ← Back to Login
          </button>
        </form>
      ) : (
        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} style={{ paddingLeft: '2.5rem' }} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Master Password / Encryption Key</label>
            <div style={{ position: 'relative' }}>
              <Key size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-secondary)' }} />
              <input id="password" type={showPw ? 'text' : 'password'}
                placeholder="Your secret master password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} required />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', top: '12px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              This is also your encryption key — it is never stored or transmitted.
            </p>
          </div>
          <button type="submit" className="btn" disabled={loading || !email || !password}>
            <Unlock size={20} /> {loading ? 'Authenticating…' : 'Login / Sign Up'}
          </button>
          <button type="button"
            onClick={() => { setResetStep('request'); clearMessages(); }}
            style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
            Forgot password?
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserDashboard — Supabase Database
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
    setLoading(true); setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('user_vaults')
        .select('encrypted_data')
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setSavedPasswords({});
        } else {
          throw fetchError;
        }
      } else {
        const encryptedMap = data.encrypted_data || {};
        const decrypted = {};
        Object.keys(encryptedMap).forEach(app => {
          const d = decryptPassword(encryptedMap[app], masterKey);
          if (d) decrypted[app] = d;
        });
        setSavedPasswords(decrypted);
      }
    } catch (err) {
      setError(`Failed to fetch vault: ${err.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUserVault(); }, []);

  const saveToVault = async (passwords) => {
    const { data: { user } } = await supabase.auth.getUser();
    const enc = {};
    Object.keys(passwords).forEach(app => { enc[app] = encryptPassword(passwords[app], masterKey); });
    const { error: upsertError } = await supabase
      .from('user_vaults')
      .upsert({ user_id: user.id, encrypted_data: enc, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (upsertError) throw upsertError;
  };

  const toggleVisibility = (app) => setVisiblePasswords(p => ({ ...p, [app]: !p[app] }));

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!newAppName.trim() || !newPassword.trim()) return;
    setLoading(true); setError('');
    try {
      const updated = { ...savedPasswords, [newAppName.trim()]: newPassword };
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
          <Database size={24} /> My Vault
        </h2>
        <button onClick={onLogout} className="btn"
          style={{ width: 'auto', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Logged in as <strong>{username}</strong>
      </p>

      {error && <div className="error-message"><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>}
      {loading && <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading…</p>}

      <div className="secrets-list">
        {Object.keys(savedPasswords).length === 0 && !loading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            No passwords saved yet. Add one below!
          </p>
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
                    style={{ flex: 1, background: 'var(--form-bg)', border: '1px solid var(--primary-color)', borderRadius: '6px', padding: '0.3rem 0.6rem', color: 'var(--text-primary)' }} />
                ) : (
                  <span className="secret-item-value" style={{ flex: 1, letterSpacing: isVisible ? 'normal' : '0.15em', fontFamily: isVisible ? 'inherit' : 'monospace' }}>
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
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Save a Password</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Passwords are encrypted end-to-end before being stored.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input type="text" placeholder="App Name (e.g. GitHub)" value={newAppName}
              onChange={e => setNewAppName(e.target.value)} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input type="password" placeholder="Password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn" style={{ marginTop: '1rem' }} disabled={loading || !newPassword || !newAppName}>
          <Lock size={16} /> Encrypt & Save
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel — Supabase Auth-based user management
// ---------------------------------------------------------------------------
function AdminPanel({ onExit }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      // List users from the user_vaults table (visible to admin via RLS)
      const { data, error: fetchError } = await supabase
        .from('user_vaults')
        .select('user_id, updated_at');
      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      setError(`Failed to load users: ${err.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleDeleteUserVault = async (userId) => {
    if (!window.confirm(`Delete all vault data for this user?\n\nThis will permanently remove their encrypted passwords. The user's account will remain active.`)) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const { error: delError } = await supabase
        .from('user_vaults')
        .delete()
        .eq('user_id', userId);
      if (delError) throw delError;
      setMessage('✅ Vault data deleted. The user account still exists in auth.');
      await loadUsers();
    } catch (err) { setError(`Failed to delete vault: ${err.message}`); }
    finally { setLoading(false); }
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={24} color="var(--error-color)" /> Admin Panel
        </h2>
        <button onClick={onExit} className="btn"
          style={{ width: 'auto', backgroundColor: 'transparent', border: '1px solid var(--border-color)' }}>
          ← My Vault
        </button>
      </div>

      {error && <div className="error-message"><AlertCircle size={14} style={{ marginRight: 6 }} />{error}</div>}
      {message && <div className="error-message" style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderColor: 'var(--primary-color)', color: 'var(--text-primary)' }}>{message}</div>}

      <div className="secrets-list">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users…</p>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No vault users found.</p>
        ) : (
          users.map((u) => (
            <div key={u.user_id} className="secret-item" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <Users size={16} />
                <span className="secret-item-key" style={{ fontSize: '0.8rem' }}>{u.user_id.substring(0, 18)}…</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Last active: {new Date(u.updated_at).toLocaleDateString()}
                </span>
              </div>
              <button onClick={() => handleDeleteUserVault(u.user_id)} className="btn"
                style={{ width: 'auto', padding: '0.4rem 0.8rem', backgroundColor: 'transparent', border: '1px solid var(--error-color)', color: 'var(--error-color)', fontSize: '0.8rem' }}
                title="Delete this user's vault data">
                <Trash2 size={14} /> Clear Vault
              </button>
            </div>
          ))
        )}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '1rem' }}>
        ⚠️ Admins have zero-visibility into user passwords. Only encrypted blobs are stored.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MainApp
// ---------------------------------------------------------------------------
function MainApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [masterKey, setMasterKey] = useState(null);
  const [role, setRole] = useState('user');
  const [showAdmin, setShowAdmin] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('vault_theme') || 'dark');
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('vault_theme', theme);
  }, [theme]);

  // Restore session on load
  useEffect(() => {
    const restore = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const email = session.user.email;
        setCurrentUser(email);
        // masterKey cannot be restored from session (zero-knowledge) — user must re-enter it
        const isAdmin = email.startsWith('admin@') || email === import.meta.env.VITE_ADMIN_EMAIL;
        setRole(isAdmin ? 'admin' : 'user');
      }
      setSessionLoaded(true);
    };
    restore();
  }, []);

  const handleLogin = (email, key, uid) => {
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

  if (!sessionLoaded) return null; // Avoids flash of login screen on session restore

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
          fontSize: '32px', fontWeight: 'bold', color: 'white', margin: '0 auto 1rem'
        }}>V</div>
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
      ) : !masterKey ? (
        // If session was restored but masterKey not set, prompt re-entry
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <p>Welcome back, <strong>{currentUser}</strong>!</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Please log in again to decrypt your vault. Your master password is never stored.
          </p>
          <button className="btn" onClick={handleLogout} style={{ width: 'auto' }}>
            <LogOut size={16} /> Log out & re-enter
          </button>
        </div>
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
