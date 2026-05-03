import { Request, Response } from 'express';
import { hasAdminPermission } from '../constants/adminRoles';
import { CatalogueQcService } from '../services/catalogueQc.service';
import { HeroSlideService } from '../services/heroSlide.service';

const getActor = (req: Request) => ({
  uid: req.user?.uid || 'unknown',
  email: req.user?.email,
});

const sendHeroSlideMutationError = (res: Response, error: any, fallbackMessage: string): void => {
  if (error.message === 'heroSlide not found' || error.message === 'Hero slide not found') {
    res.status(404).json({
      success: false,
      message: 'Hero slide not found',
    });
    return;
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

export const createHeroSlide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, imageUrl, buttonText, buttonLink, position } = req.body;
    const heroSlideData = {
      title,
      description,
      imageUrl,
      buttonText,
      buttonLink,
      position,
    };

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('heroSlide', 'create', heroSlideData, getActor(req));
      res.status(202).json({
        success: true,
        message: 'Hero slide submitted for QC approval',
        data: request,
      });
      return;
    }

    const heroSlide = await HeroSlideService.createHeroSlide(heroSlideData);
    res.status(201).json({
      success: true,
      message: 'Hero slide created successfully',
      data: heroSlide,
    });
  } catch (error: any) {
    console.error('Error creating hero slide:', error);
    sendHeroSlideMutationError(res, error, 'Failed to create hero slide');
  }
};

export const getAllHeroSlides = async (_req: Request, res: Response): Promise<void> => {
  try {
    const heroSlides = await HeroSlideService.getAllHeroSlides();
    res.status(200).json({
      success: true,
      data: heroSlides,
    });
  } catch (error: any) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slides',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getHeroSlideById = async (req: Request, res: Response): Promise<void> => {
  try {
    const heroSlide = await HeroSlideService.getHeroSlideById(req.params.id);

    if (!heroSlide) {
      res.status(404).json({
        success: false,
        message: 'Hero slide not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: heroSlide,
    });
  } catch (error: any) {
    console.error('Error fetching hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slide',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateHeroSlide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl, buttonText, buttonLink, position } = req.body;
    const updateData: any = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (buttonText !== undefined) updateData.buttonText = buttonText;
    if (buttonLink !== undefined) updateData.buttonLink = buttonLink;
    if (position !== undefined) updateData.position = position;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('heroSlide', 'update', updateData, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Hero slide changes submitted for QC approval',
        data: request,
      });
      return;
    }

    const heroSlide = await HeroSlideService.updateHeroSlide(id, updateData);
    if (!heroSlide) {
      res.status(404).json({
        success: false,
        message: 'Hero slide not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Hero slide updated successfully',
      data: heroSlide,
    });
  } catch (error: any) {
    console.error('Error updating hero slide:', error);
    sendHeroSlideMutationError(res, error, 'Failed to update hero slide');
  }
};

export const deleteHeroSlide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!hasAdminPermission(req.user, 'OWNER')) {
      const request = await CatalogueQcService.createRequest('heroSlide', 'delete', null, getActor(req), id);
      res.status(202).json({
        success: true,
        message: 'Hero slide deletion submitted for QC approval',
        data: request,
      });
      return;
    }

    const deleted = await HeroSlideService.deleteHeroSlide(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Hero slide not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Hero slide deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting hero slide:', error);
    sendHeroSlideMutationError(res, error, 'Failed to delete hero slide');
  }
};
