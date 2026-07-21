import DiscountCampaign, { IDiscountCampaign } from '../models/discountCampaign.model';

export class DiscountCampaignService {
  static async getAll(): Promise<IDiscountCampaign[]> {
    return DiscountCampaign.find().populate('categories', 'name slug').sort({ createdAt: -1 });
  }

  static async create(data: Record<string, any>): Promise<IDiscountCampaign> {
    return DiscountCampaign.create(data);
  }

  static async update(id: string, data: Record<string, any>): Promise<IDiscountCampaign | null> {
    return DiscountCampaign.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  static async remove(id: string): Promise<boolean> {
    const res = await DiscountCampaign.findByIdAndDelete(id);
    return !!res;
  }

  /**
   * Map of categoryId -> highest active campaign percentage. Products in a
   * category use this to apply the festive/seasonal discount for normal
   * customers.
   */
  static async getActiveCategoryPercents(): Promise<Map<string, number>> {
    const active = await DiscountCampaign.find({ isActive: true, percentage: { $gt: 0 } });
    const map = new Map<string, number>();
    for (const campaign of active) {
      for (const cat of campaign.categories || []) {
        const key = String(cat);
        map.set(key, Math.max(map.get(key) ?? 0, campaign.percentage));
      }
    }
    return map;
  }
}
