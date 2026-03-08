import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { to, username, code, type = 'self' } = JSON.parse(event.body);

        if (!to || !username || !code) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
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
        <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 8px;">
          <h2 style="color: #6366f1;">Vaultex Security</h2>
          <p>Hi <strong>${username}</strong>,</p>
          <p>${isAdmin ? 'An administrator has reset your credentials.' : 'You requested a password reset.'}</p>
          <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #1e293b; border: 2px solid #6366f1; border-radius: 8px; text-align: center; margin: 20px 0; letter-spacing: 4px;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 0.8rem;">This code expires in 15 minutes.</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 0.8rem; color: #64748b;">Vaultex — E2E Encrypted Vault</p>
        </div>
      `,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, id: result.id })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
