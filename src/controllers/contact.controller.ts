import { Request, Response } from 'express';
import { sendContactFormNotification } from '../services/mail.service';

/**
 * POST /api/v1/contact
 * Public — send a contact form message to the admin inbox.
 */
export const submitContactForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();

    await sendContactFormNotification({ name, email, subject, message });

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Failed to send your message. Please try again or email us directly.'
          : error.message || 'Failed to send contact message',
    });
  }
};
