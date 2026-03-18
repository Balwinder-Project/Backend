import { Router } from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest';
import { createAddressValidator, updateAddressValidator } from '../validators/address.validator';

const router = Router();

router.get('/', authenticateUser, getAddresses);
router.post('/', authenticateUser, createAddressValidator, validateRequest, createAddress);
router.put('/:id', authenticateUser, updateAddressValidator, validateRequest, updateAddress);
router.delete('/:id', authenticateUser, deleteAddress);
router.put('/:id/default', authenticateUser, setDefaultAddress);

export default router;
