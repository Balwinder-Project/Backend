import { Request, Response } from 'express';
import { DiscountCampaignService } from '../services/discountCampaign.service';

const isValidId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

const sendError = (res: Response, error: any, fallback: string): void => {
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

const normalizePayload = (body: Record<string, any>) => {
  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.categories !== undefined) {
    data.categories = Array.isArray(body.categories)
      ? body.categories.filter((c: any) => isValidId(String(c)))
      : [];
  }
  if (body.percentage !== undefined) data.percentage = Number(body.percentage);
  if (body.isActive !== undefined) data.isActive = !!body.isActive;
  return data;
};

/** GET /api/v1/discount-campaigns */
export const getAllCampaigns = async (_req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await DiscountCampaignService.getAll();
    res.status(200).json({ success: true, data: campaigns });
  } catch (error: any) {
    sendError(res, error, 'Failed to fetch campaigns');
  }
};

/** POST /api/v1/discount-campaigns */
export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await DiscountCampaignService.create(normalizePayload(req.body));
    res.status(201).json({ success: true, message: 'Campaign created', data: campaign });
  } catch (error: any) {
    sendError(res, error, 'Failed to create campaign');
  }
};

/** PUT /api/v1/discount-campaigns/:id */
export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }
    const campaign = await DiscountCampaignService.update(id, normalizePayload(req.body));
    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Campaign updated', data: campaign });
  } catch (error: any) {
    sendError(res, error, 'Failed to update campaign');
  }
};

/** DELETE /api/v1/discount-campaigns/:id */
export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ success: false, message: 'Invalid campaign ID' });
      return;
    }
    const ok = await DiscountCampaignService.remove(id);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Campaign deleted' });
  } catch (error: any) {
    sendError(res, error, 'Failed to delete campaign');
  }
};
