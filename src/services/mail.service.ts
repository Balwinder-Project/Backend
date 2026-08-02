import nodemailer, { Transporter } from 'nodemailer';

export interface ContactMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

let transporter: Transporter | null = null;

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const from = process.env.SMTP_FROM || user;
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || '';

  return { host, port, secure, user, pass, from, adminEmail };
};

const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  const { host, port, secure, user, pass } = getSmtpConfig();

  if (!user || !pass) {
    throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASS missing)');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Notify the admin about a new Contact Us form submission.
 */
export const sendContactFormNotification = async (
  payload: ContactMessagePayload
): Promise<void> => {
  const { from, adminEmail } = getSmtpConfig();

  if (!adminEmail) {
    throw new Error('ADMIN_NOTIFY_EMAIL is not configured');
  }

  const transport = getTransporter();
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, '<br/>');

  await transport.sendMail({
    from: `"B&D Creation Website" <${from}>`,
    to: adminEmail,
    replyTo: payload.email,
    subject: `[Contact] ${payload.subject}`,
    text: [
      'New contact form submission from the B&D Creation website.',
      '',
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `Subject: ${payload.subject}`,
      '',
      'Message:',
      payload.message,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #111;">
        <h2 style="margin: 0 0 12px;">New Contact Form Message</h2>
        <p style="margin: 0 0 16px; color: #555;">
          Submitted via the B&amp;D Creation website contact page.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 100px;">Name</td>
            <td style="padding: 8px 0;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Subject</td>
            <td style="padding: 8px 0;">${safeSubject}</td>
          </tr>
        </table>
        <div style="padding: 14px; background: #f7f7f7; border-radius: 8px; line-height: 1.5;">
          ${safeMessage}
        </div>
      </div>
    `,
  });
};
