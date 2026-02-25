import Razorpay from 'razorpay';

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export class RazorpayService {
    /**
     * Create a new Razorpay order
     * @param amountInPaise - Amount in paise (1 ₹ = 100 paise)
     * @param currency - Currency code (e.g. 'INR')
     * @param receipt - Unique receipt string (max 40 chars)
     * @param notes - Optional key-value notes stored on the order (e.g. { userId })
     */
    static async createOrder(
        amountInPaise: number,
        currency: string,
        receipt: string,
        notes?: Record<string, string>
    ): Promise<any> {
        const options: any = {
            amount: amountInPaise,
            currency,
            receipt,
            payment_capture: 1,
        };

        if (notes) {
            options.notes = notes;
        }

        const order = await razorpayInstance.orders.create(options);
        return order;
    }
}
