import { Request, Response } from 'express';
import { MockupService } from '../services/mockup.service';

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const sendError = (res: Response, error: any, fallback: string): void => {
  if (
    error.message === 'One or more subcategories were not found' ||
    error.message === 'One or more subcategories have an invalid ID format'
  ) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
    return;
  }
  res.status(500).json({
    success: false,
    message: fallback,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

/** GET /api/v1/mockup-templates */
export const getAllMockupTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await MockupService.getTemplates({
      subCategory: req.query.subCategory as string,
      active: parseBooleanQuery(req.query.active),
    });
    res.status(200).json({ success: true, data: templates });
  } catch (error: any) {
    console.error('Error fetching mockup templates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch mockup templates' });
  }
};

/** GET /api/v1/mockup-templates/:id */
export const getMockupTemplateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await MockupService.getTemplateById(req.params.id);
    if (!template) {
      res.status(404).json({ success: false, message: 'Mockup template not found' });
      return;
    }
    res.status(200).json({ success: true, data: template });
  } catch (error: any) {
    console.error('Error fetching mockup template:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch mockup template' });
  }
};

/** POST /api/v1/mockup-templates */
export const createMockupTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await MockupService.createTemplate(req.body);
    res.status(201).json({ success: true, message: 'Mockup template created', data: template });
  } catch (error: any) {
    console.error('Error creating mockup template:', error);
    sendError(res, error, 'Failed to create mockup template');
  }
};

/** PUT /api/v1/mockup-templates/:id */
export const updateMockupTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const template = await MockupService.updateTemplate(req.params.id, req.body);
    if (!template) {
      res.status(404).json({ success: false, message: 'Mockup template not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Mockup template updated', data: template });
  } catch (error: any) {
    console.error('Error updating mockup template:', error);
    sendError(res, error, 'Failed to update mockup template');
  }
};

/** DELETE /api/v1/mockup-templates/:id */
export const deleteMockupTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await MockupService.deleteTemplate(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Mockup template not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Mockup template deleted' });
  } catch (error: any) {
    console.error('Error deleting mockup template:', error);
    res.status(500).json({ success: false, message: 'Failed to delete mockup template' });
  }
};

/** POST /api/v1/mockup-templates/preview-selection */
export const previewMockupsForSelection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { designImage, subCategories } = req.body || {};
    const results = await MockupService.previewForSelection(designImage, subCategories);
    res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error rendering mockup previews:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to render previews' });
  }
};

/** POST /api/v1/mockup-templates/:id/preview */
export const previewMockupTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const url = await MockupService.previewTemplate(req.params.id, req.body?.designImage);
    res.status(200).json({ success: true, data: { url } });
  } catch (error: any) {
    console.error('Error rendering mockup preview:', error);
    if (error.message === 'Mockup template not found') {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({ success: false, message: error.message || 'Failed to render preview' });
  }
};
