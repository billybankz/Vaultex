const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { to, username, code, type = 'self' } = req.body;

    if (!to || !username || !code) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const isAdmin = type === 'admin';
    const subject = isAdmin
        ? `Your Vaultex credentials have been reset by an administrator`
        : `Your Vaultex password reset code`;

    try {
        const data = await resend.emails.send({
            from: 'Vaultex <onboarding@resend.dev>',
            to: [to],
            subject,
            html: `
        <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff;">
          <h2>Vaultex Security</h2>
          <p>Hi ${username},</p>
          <p>${isAdmin ? 'An admin reset your credentials.' : 'You requested a reset.'}</p>
          <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #1e293b; display: inline-block;">
            ${code}
          </div>
          <p>Safe coding!</p>
        </div>
      `,
        });

        res.status(200).json({ success: true, id: data.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
