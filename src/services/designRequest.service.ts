import DesignRequest, {
  DesignRequestStatus,
  IDesignRequest,
} from '../models/designRequest.model';

export interface CreateDesignRequestData {
  name: string;
  subject: string;
  email: string;
  phone: string;
  requirements: string;
  images: string[];
  firebaseUid?: string | null;
}

export interface UpdateDesignRequestData {
  status?: DesignRequestStatus;
  adminNotes?: string;
}

export interface ListDesignRequestsParams {
  page?: number;
  limit?: number;
  status?: DesignRequestStatus | '';
  search?: string;
}

export class DesignRequestService {
  static async create(data: CreateDesignRequestData): Promise<IDesignRequest> {
    const [request] = await DesignRequest.create([
      {
        name: data.name,
        subject: data.subject,
        email: data.email,
        phone: data.phone,
        requirements: data.requirements,
        images: data.images,
        firebaseUid: data.firebaseUid || null,
        status: 'new',
      },
    ]);
    return request;
  }

  static async listAdmin(params: ListDesignRequestsParams = {}): Promise<{
    items: IDesignRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const filter: Record<string, unknown> = {};

    if (params.status) {
      filter.status = params.status;
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      DesignRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DesignRequest.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async getById(id: string): Promise<IDesignRequest | null> {
    return DesignRequest.findById(id);
  }

  static async update(
    id: string,
    data: UpdateDesignRequestData
  ): Promise<IDesignRequest> {
    const update: UpdateDesignRequestData = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.adminNotes !== undefined) update.adminNotes = data.adminNotes;

    const request = await DesignRequest.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!request) {
      throw new Error('Design request not found');
    }

    return request;
  }
}
