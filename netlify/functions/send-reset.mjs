import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { to, username, code, type = 'self' } = JSON.parse(event.body);

        if (!to || !username || !code) {
            return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields: to, username, code' }) };
        }

        const isAdmin = type === 'admin';
        const subject = isAdmin
            ? `Your Vaultex credentials have been reset by an administrator`
            : `Your Vaultex password reset code`;

        const result = await resend.emails.send({
            from: 'Vaultex <onboarding@resend.dev>',
            to: [to],
            subject,
            html: `
        <div style="font-family:'Inter',sans-serif;padding:32px;background:#0b0f1a;color:#f0f4ff;border-radius:12px;max-width:480px;margin:auto;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;width:56px;height:56px;background:linear-gradient(135deg,#6d28d9,#4f46e5);border-radius:14px;line-height:56px;font-size:26px;font-weight:800;color:#fff;">V</div>
            <h2 style="margin:12px 0 4px;background:linear-gradient(135deg,#6366f1,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Vaultex Security</h2>
          </div>
          <p style="margin-bottom:8px;">Hi <strong>${username}</strong>,</p>
          <p style="color:#7b8fb0;margin-bottom:24px;">
            ${isAdmin ? 'An administrator has reset your vault credentials.' : 'You requested a password reset for your Vaultex account.'}
          </p>
          <div style="background:#131929;border:2px solid #6366f1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:0.8rem;color:#7b8fb0;text-transform:uppercase;letter-spacing:1px;">Your Reset Code</p>
            <div style="font-size:2.5rem;font-weight:800;letter-spacing:10px;color:#f0f4ff;font-family:monospace;">${code}</div>
          </div>
          <p style="color:#7b8fb0;font-size:0.8rem;margin-bottom:16px;">⏱ This code expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border:0;border-top:1px solid #253044;margin:20px 0;" />
          <p style="font-size:0.75rem;color:#5a6b8a;text-align:center;">Vaultex — E2E Encrypted Vault • Zero-knowledge security</p>
        </div>
      `,
        });

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ success: true, id: result.id })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: error.message })
        };
    }
};
