import mongoose, { Schema, Document } from 'mongoose';
export interface ICartPrintSettings extends Document { showOrderId:boolean; showCustomerName:boolean; showPhone:boolean; showEmail:boolean; showShippingAddress:boolean; showSku:boolean; showProductName:boolean; showQuantity:boolean; showUnitPrice:boolean; showSubtotal:boolean; }
const schema = new Schema<ICartPrintSettings>({
 showOrderId:{type:Boolean,default:true}, showCustomerName:{type:Boolean,default:true}, showPhone:{type:Boolean,default:true}, showEmail:{type:Boolean,default:false}, showShippingAddress:{type:Boolean,default:true}, showSku:{type:Boolean,default:true}, showProductName:{type:Boolean,default:true}, showQuantity:{type:Boolean,default:true}, showUnitPrice:{type:Boolean,default:false}, showSubtotal:{type:Boolean,default:false}
},{timestamps:true});
export default mongoose.model<ICartPrintSettings>('CartPrintSettings',schema);