import { Router } from 'express';
import { submitContactForm } from '../controllers/contact.controller';
import { validateRequest } from '../middleware/validateRequest';
import { contactFormValidator } from '../validators/contact.validator';

const router = Router();

// Public contact form
router.post('/', contactFormValidator, validateRequest, submitContactForm);

export default router;
