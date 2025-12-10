import { Router } from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller';
import { validateRequest } from '../middleware/validateRequest';
import { updateUserValidator } from '../validators/user.validator';

const router = Router();

// CRUD operations
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUserValidator, validateRequest, updateUser);
router.delete('/:id', deleteUser);

export default router;


