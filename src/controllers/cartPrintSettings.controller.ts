import { Request, Response } from 'express';
import CartPrintSettings from '../models/cartPrintSettings.model';

const defaults = {showOrderId:true,showCustomerName:true,showPhone:true,showEmail:false,showShippingAddress:true,showSku:true,showProductName:true,showQuantity:true,showUnitPrice:false,showSubtotal:false};

export const getCartPrintSettings = async (_req:Request,res:Response):Promise<void>=>{
  try {
    const existing = await CartPrintSettings.findOne().lean();
    const settings = existing ?? (await CartPrintSettings.create(defaults)).toObject();
    res.json({success:true,data:settings});
  } catch(error) {
    console.error('Failed to read cart print settings',error);
    res.status(500).json({success:false,message:'Failed to read cart print settings'});
  }
};

export const updateCartPrintSettings = async (req:Request,res:Response):Promise<void>=>{
  try {
    const payload:Record<string,boolean>={};
    for(const key of Object.keys(defaults)){
      if(typeof req.body?.[key]!=='boolean'){
        res.status(400).json({success:false,message:'Invalid boolean setting: '+key});
        return;
      }
      payload[key]=req.body[key];
    }
    const settings=await CartPrintSettings.findOneAndUpdate({},payload,{new:true,upsert:true,setDefaultsOnInsert:true});
    res.json({success:true,data:settings});
  } catch(error) {
    console.error('Failed to update cart print settings',error);
    res.status(500).json({success:false,message:'Failed to update cart print settings'});
  }
};
