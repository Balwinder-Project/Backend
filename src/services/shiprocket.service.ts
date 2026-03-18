const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

export interface ShippingRate {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  estimated_delivery_days: number;
}

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  weight?: number;
}

export interface ShiprocketOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email?: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_country?: string;
  shipping_state?: string;
  shipping_phone?: string;
  order_items: ShiprocketOrderItem[];
  payment_method: 'Prepaid';
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketOrderResponse {
  order_id: number;
  shipment_id: number;
  status: string;
  status_code: number;
  onboarding_completed_now: number;
  awb_code?: string;
  courier_company_id?: number;
  courier_name?: string;
}

// Module-level token cache (24h validity with 5-minute safety buffer)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export class ShiprocketService {
  static async authenticate(): Promise<string> {
    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {
      throw new Error('SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD must be set in environment variables');
    }

    const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Shiprocket authentication failed: ${response.status} ${body}`);
    }

    const data = await response.json() as { token: string };

    if (!data.token) {
      throw new Error('Shiprocket authentication response missing token');
    }

    cachedToken = data.token;
    tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return cachedToken;
  }

  private static async getToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry - TOKEN_BUFFER_MS) {
      return cachedToken;
    }
    return this.authenticate();
  }

  private static async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${SHIPROCKET_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Shiprocket API error [${method} ${path}]: ${response.status} ${errBody}`);
    }

    return response.json() as Promise<T>;
  }

  static async getShippingRates(
    pickupPostcode: string,
    deliveryPostcode: string,
    weight: number,
    cod: 0 | 1 = 0
  ): Promise<ShippingRate[]> {
    const data = await this.request<any>('POST', '/courier/serviceability/', {
      pickup_postcode: pickupPostcode,
      delivery_postcode: deliveryPostcode,
      weight,
      cod,
    });

    const couriers: any[] = data?.data?.available_courier_companies ?? [];

    return couriers
      .map((c: any) => ({
        courier_company_id: c.courier_company_id,
        courier_name: c.courier_name,
        rate: c.rate,
        estimated_delivery_days: c.estimated_delivery_days,
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  static async createOrder(payload: ShiprocketOrderPayload): Promise<ShiprocketOrderResponse> {
    return this.request<ShiprocketOrderResponse>('POST', '/orders/create/adhoc', payload);
  }

  static async getOrderTracking(awbCode: string): Promise<any> {
    return this.request<any>('GET', `/courier/track/awb/${awbCode}`);
  }
}
