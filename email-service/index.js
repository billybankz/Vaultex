require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PORT = process.env.PORT || 3001;

// -----------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// -----------------------------------------------------------------------
// POST /send-reset  —  sends a password-reset code via Resend
// body: { to: string, username: string, code: string, type: 'admin'|'self' }
// -----------------------------------------------------------------------
app.post('/send-reset', async (req, res) => {
  const { to, username, code, type = 'self' } = req.body;

  if (!to || !username || !code) {
    return res.status(400).json({ error: 'Missing required fields: to, username, code' });
  }

  const isAdmin = type === 'admin';
  const subject = isAdmin
    ? `Your Vaultex credentials have been reset by an administrator`
    : `Your Vaultex password reset code`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #1e293b; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #6d28d9, #4f46e5); padding: 32px; text-align: center; }
        .header h1 { margin: 0; color: white; font-size: 1.5rem; }
        .body { padding: 32px; }
        .code-box { background: #0f172a; border: 2px solid #6d28d9; border-radius: 8px;
                    text-align: center; padding: 24px; margin: 24px 0; }
        .code { font-size: 2.5rem; font-weight: bold; letter-spacing: 0.5rem; color: #a78bfa; font-family: monospace; }
        .note { font-size: 0.85rem; color: #94a3b8; margin-top: 8px; }
        .footer { text-align: center; padding: 16px; font-size: 0.75rem; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡 Vaultex</h1>
        </div>
        <div class="body">
          <p>Hi <strong>${username}</strong>,</p>
          ${isAdmin
      ? `<p>An administrator has initiated a credential reset for your account. Use the code below to set a new password.</p>`
      : `<p>You requested a password reset. Use the code below to set a new password.</p>`
    }
          <div class="code-box">
            <div class="code">${code}</div>
            <div class="note">This code expires in <strong>15 minutes</strong></div>
          </div>
          <p>If you did not request this, please ignore this email. Your account remains secure.</p>
        </div>
        <div class="footer">Vaultex &mdash; E2E Encrypted Vault</div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await axios.post('https://api.resend.com/emails', {
      from: 'Vaultex <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }, {
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[email] Reset code sent to ${to} (id: ${response.data?.id})`);
    res.json({ success: true, id: response.data?.id });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('[email] Send failed:', detail);
    res.status(500).json({ error: 'Failed to send email', detail });
  }
});

app.listen(PORT, () => console.log(`Email service running on port ${PORT}`));
