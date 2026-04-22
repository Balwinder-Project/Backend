import { Request, Response } from 'express';
import { CatalogueQcService } from '../services/catalogueQc.service';

const getActor = (req: Request) => ({
  uid: req.user?.uid || 'unknown',
  email: req.user?.email,
});

const sendQcError = (res: Response, error: any): void => {
  const badRequestMessages = [
    'Feedback is required',
    'Request is not pending QC check 1',
    'Request is not pending QC check 2',
    'Category not found',
    'One or more tags were not found',
    'A product with this SKU already exists',
    'A category with this name or slug already exists',
    'A tag with this name or slug already exists',
  ];

  if (error.message === 'QC request not found') {
    res.status(404).json({
      success: false,
      message: error.message,
    });
    return;
  }

  if (
    badRequestMessages.includes(error.message) ||
    error.message?.startsWith('Cannot delete category.') ||
    error.name === 'ValidationError'
  ) {
    res.status(400).json({
      success: false,
      message: error.name === 'ValidationError' ? 'Validation failed' : error.message,
      errors: error.name === 'ValidationError'
        ? Object.values(error.errors).map((err: any) => err.message)
        : undefined,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: 'QC action failed',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

export const listQcCheck1 = async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = await CatalogueQcService.listByStatus('pending_qc1');
    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const listQcCheck2 = async (_req: Request, res: Response): Promise<void> => {
  try {
    const requests = await CatalogueQcService.listByStatus('pending_qc2');
    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const getQcRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await CatalogueQcService.getRequest(req.params.id);
    if (!request) {
      res.status(404).json({
        success: false,
        message: 'QC request not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const approveQcCheck1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await CatalogueQcService.approveQc1(req.params.id, getActor(req), req.body.payload);
    res.status(200).json({
      success: true,
      message: 'QC check 1 approved',
      data: request,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const rejectQcCheck1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await CatalogueQcService.rejectQc1(req.params.id, getActor(req), req.body.feedback);
    res.status(200).json({
      success: true,
      message: 'QC check 1 rejected',
      data: request,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const approveQcCheck2 = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await CatalogueQcService.approveQc2(req.params.id, getActor(req), req.body.payload);
    res.status(200).json({
      success: true,
      message: 'QC check 2 approved and applied',
      data: request,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};

export const rejectQcCheck2 = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await CatalogueQcService.rejectQc2(req.params.id, getActor(req), req.body.feedback);
    res.status(200).json({
      success: true,
      message: 'QC check 2 rejected',
      data: request,
    });
  } catch (error: any) {
    sendQcError(res, error);
  }
};
