import HeroSlide, { IHeroSlide } from '../models/heroSlide.model';

export class HeroSlideService {
  static async createHeroSlide(data: Partial<IHeroSlide>): Promise<IHeroSlide> {
    return HeroSlide.create(data);
  }

  static async getAllHeroSlides(): Promise<IHeroSlide[]> {
    return HeroSlide.find({}).sort({ position: 1, createdAt: 1 });
  }

  static async getHeroSlideById(id: string): Promise<IHeroSlide | null> {
    return HeroSlide.findById(id);
  }

  static async updateHeroSlide(id: string, data: Partial<IHeroSlide>): Promise<IHeroSlide | null> {
    return HeroSlide.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  static async deleteHeroSlide(id: string): Promise<IHeroSlide | null> {
    return HeroSlide.findByIdAndDelete(id);
  }
}
