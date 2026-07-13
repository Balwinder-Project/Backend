import { Request, Response } from 'express';
import DimensionTemplate from '../models/dimensionTemplate.model';

const isValidId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const sendError = (res: Response, error: any, fallback: string): void => {
  if (error.code === 11000) {
    res.status(409).json({ success: false, message: 'A template with this name already exists' });
    return;
  }
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((e: any) => e.message);
    res.status(400).json({ success: false, message: 'Validation failed', errors });
    return;
  }
  res.status(500).json({
    success: false,
    message: fallback,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

/** GET /api/v1/dimension-templates */
export const getAllDimensionTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await DimensionTemplate.find().sort({ name: 1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error: any) {
    sendError(res, error, 'Failed to fetch dimension templates');
  }
};

/** POST /api/v1/dimension-templates */
export const createDimensionTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, weight, length, breadth, height } = req.body;
    const template = await DimensionTemplate.create({ name, weight, length, breadth, height });
    res.status(201).json({ success: true, message: 'Dimension template created', data: template });
  } catch (error: any) {
    sendError(res, error, 'Failed to create dimension template');
  }
};

/** PUT /api/v1/dimension-templates/:id */
export const updateDimensionTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid template ID' });
      return;
    }
    const { name, weight, length, breadth, height } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (weight !== undefined) updateData.weight = weight;
    if (length !== undefined) updateData.length = length;
    if (breadth !== undefined) updateData.breadth = breadth;
    if (height !== undefined) updateData.height = height;

    const template = await DimensionTemplate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!template) {
      res.status(404).json({ success: false, message: 'Dimension template not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Dimension template updated', data: template });
  } catch (error: any) {
    sendError(res, error, 'Failed to update dimension template');
  }
};

/** DELETE /api/v1/dimension-templates/:id */
export const deleteDimensionTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid template ID' });
      return;
    }
    const template = await DimensionTemplate.findByIdAndDelete(id);
    if (!template) {
      res.status(404).json({ success: false, message: 'Dimension template not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Dimension template deleted' });
  } catch (error: any) {
    sendError(res, error, 'Failed to delete dimension template');
  }
};
