import { Request, Response } from 'express';
import mongoose from 'mongoose';
import NamePlateConfig from '../models/namePlateConfig.model';
import SubCategory from '../models/subCategory.model';

const validId = (id: string) => mongoose.isValidObjectId(id);



const getHostedFontFamilies = async (): Promise<string[]> => {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const { s3Client, B2_BUCKET_NAME } = await import('../config/b2');
  const result = await s3Client.send(new GetObjectCommand({
    Bucket: B2_BUCKET_NAME,
    Key: 'balwinder/fonts/manifest.json',
  }));
  const raw = await result.Body?.transformToString('utf-8');
  if (!raw) return [];
  const manifest = JSON.parse(raw) as { fonts?: Array<{ family?: string }> };
  return Array.from(new Set((manifest.fonts || []).map((f) => String(f.family || '').trim()).filter(Boolean)));
};

const extractOpenAIText = (payload: any): string => {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const chunks: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
};

export const findReferenceFontsWithAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ success: false, message: 'AI Font Finder is not configured. Add OPENAI_API_KEY to the Backend environment.' });
      return;
    }

    const imageUrl = String(req.body?.imageUrl || '').trim();
    if (!/^https?:\/\//i.test(imageUrl)) {
      res.status(400).json({ success: false, message: 'A public reference image URL is required for AI Font Finder.' });
      return;
    }

    const fontFamilies = await getHostedFontFamilies();
    if (!fontFamilies.length) {
      res.status(503).json({ success: false, message: 'Hosted font catalog is empty. Upload/build the custom font manifest first.' });
      return;
    }

    const prompt = [
      'You are an expert typography and font-identification assistant for a name-plate design editor.',
      'Analyze the supplied reference plate image and identify every visually distinct TEXT / LETTERING style that an admin should recreate as an editable text layer.',
      'Do not include decorative icons, arrows, borders, screws, logos, or purely graphical symbols unless they are clearly text characters.',
      'For EVERY visually distinct visible text block or lettering style, identify the text/element if readable and select the CLOSEST matching font family from the supplied hosted-font catalog.',
      'Create a separate row for each distinct text block/style when its typography, size, weight, script, or visual treatment differs. Do not merge different text blocks merely because they may use the same font.',
      'Ignore decorative graphics, but do include actual lettering in Hindi, English, numbers, and other scripts.',
      'You MUST choose fontName from the catalog exactly as written. Never invent a font family that is not in the catalog.',
      'If the exact font is uncertain, choose the closest visual match and lower confidence. Font identification from an image is approximate.',
      'Return ONLY valid JSON in this exact shape: {"fonts":[{"element":"...","fontName":"...","confidence":0.0,"reason":"..."}]}',
      'Keep confidence between 0 and 1. Return up to 12 meaningful text styles/blocks. Do not return rows for decorative-only artwork.'
      '',
      'HOSTED FONT CATALOG:',
      ...fontFamilies.map((name, index) => `${index + 1}. ${name}`),
    ].join('\n');

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FONT_MODEL || 'gpt-5.6-luna',
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl, detail: 'high' },
          ],
        }],
      }),
    });

    const payload = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error('AI Font Finder OpenAI error:', payload);
      res.status(502).json({ success: false, message: 'AI Font Finder could not analyze the reference image.' });
      return;
    }

    const rawText = extractOpenAIText(payload).trim();
    const jsonText = rawText.replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('AI Font Finder returned non-JSON:', rawText);
      res.status(502).json({ success: false, message: 'AI Font Finder returned an unreadable result.' });
      return;
    }

    const allowed = new Set(fontFamilies.map((name) => name.toLowerCase()));
    const fonts = Array.isArray(parsed?.fonts)
      ? parsed.fonts
        .map((item: any) => ({
          id: `ai-font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          element: String(item?.element || '').trim(),
          fontName: String(item?.fontName || '').trim(),
          confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
          reason: String(item?.reason || '').trim(),
        }))
        .filter((item: any) => item.element && allowed.has(item.fontName.toLowerCase()))
      : [];

    res.status(200).json({
      success: true,
      data: { fonts, model: process.env.OPENAI_FONT_MODEL || 'gpt-5.6-luna' },
    });
  } catch (error: any) {
    console.error('findReferenceFontsWithAI error:', error);
    res.status(500).json({ success: false, message: 'AI Font Finder failed. Please try again.' });
  }
};

export const analyzeFixedArtworkWithAI = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) { res.status(503).json({ success:false, message:'AI Artwork Analyzer is not configured. Add OPENAI_API_KEY to the Backend environment.' }); return; }
    const imageUrl = String(req.body?.imageUrl || '').trim();
    if (!/^https?:\/\//i.test(imageUrl)) { res.status(400).json({ success:false, message:'A public reference/template image URL is required.' }); return; }
    const prompt = [
      'You are an expert production artwork analyzer for a customizable metal name plate.',
      'Analyze the supplied plate image and identify the NON-EDITABLE artwork: decorative graphics, borders, ornaments, fixed icons, lines, flourishes and background artwork.',
      'Do NOT include readable customer-replaceable text as fixed artwork. Text should remain editable unless it is clearly part of an unchangeable logo/brand mark.',
      'Return normalized coordinates as percentages of the complete plate: x, y, width, height from 0 to 100.',
      'The complete fixed artwork must preserve its aspect ratio when the customer changes plate size. Recommend contain, never stretch independently in X and Y.',
      'Also return a safe area where editable customer content can be placed.',
      'Return ONLY valid JSON in this exact shape:',
      '{"preserveAspectRatio":true,"fit":"contain","confidence":0.0,"safeArea":{"x":0,"y":0,"width":100,"height":100},"elements":[{"id":"...","label":"...","type":"ornament|border|icon|line|background|other","x":0,"y":0,"width":0,"height":0,"locked":true}]}',
      'Confidence must be between 0 and 1. Do not invent elements that are not visible.'
    ].join('\n');
    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
      body:JSON.stringify({
        model: process.env.OPENAI_ARTWORK_MODEL || 'gpt-5.6-luna',
        input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:imageUrl,detail:'high'}]}],
      }),
    });
    const payload = await aiResponse.json();
    if (!aiResponse.ok) { console.error('AI Artwork Analyzer OpenAI error:',payload); res.status(502).json({success:false,message:'AI Artwork Analyzer could not analyze the image.'}); return; }
    const rawText = extractOpenAIText(payload).trim();
    const jsonText = rawText.replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/i,'').replace(/\s*\`\`\`$/i,'').trim();
    let parsed:any;
    try { parsed=JSON.parse(jsonText); } catch { res.status(502).json({success:false,message:'AI Artwork Analyzer returned an unreadable result.'}); return; }
    const n=(v:any,d=0)=>Math.max(0,Math.min(100,Number(v)||d));
    const elements=Array.isArray(parsed?.elements) ? parsed.elements.map((e:any,i:number)=>({
      id:String(e?.id||`fixed-${i+1}`), label:String(e?.label||'Fixed artwork'), type:String(e?.type||'other'),
      x:n(e?.x), y:n(e?.y), width:n(e?.width), height:n(e?.height), locked:true,
    })).filter((e:any)=>e.width>0&&e.height>0) : [];
    const safe=parsed?.safeArea||{};
    res.status(200).json({success:true,data:{
      model:process.env.OPENAI_ARTWORK_MODEL||'gpt-5.6-luna',
      confidence:Math.max(0,Math.min(1,Number(parsed?.confidence)||0)),
      preserveAspectRatio:true, fit:'contain',
      safeArea:{x:n(safe.x),y:n(safe.y),width:n(safe.width,100),height:n(safe.height,100)},
      elements,
    }});
  } catch (error:any) {
    console.error('analyzeFixedArtworkWithAI error:',error);
    res.status(500).json({success:false,message:'AI Artwork Analyzer failed. Please try again.'});
  }
};

export const getNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const config = await NamePlateConfig.findOne({ productId, isActive: true }).lean();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({ success: true, data: config ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// Public storefront fallback for the Metal Name Plates trial. It resolves the
// preview subcategory by name, so the storefront can use the same configuration
// that was saved from Manage Products without exposing internal IDs.
export const getMetalNamePlateConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const subCategory = await SubCategory.findOne({
      name: /^Metal Name Plates$/i,
      isActive: true,
    }).select('_id name').lean();

    if (!subCategory) {
      res.status(404).json({ success: false, message: 'Metal Name Plates subcategory not found' });
      return;
    }

    const config = await NamePlateConfig.findOne({
      subCategoryId: subCategory._id,
      isActive: true,
    }).lean();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).json({
      success: true,
      data: config ?? null,
      subCategoryId: subCategory._id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch Metal Name Plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    if (!validId(productId)) { res.status(400).json({ success: false, message: 'Invalid product ID' }); return; }
    const payload = { ...req.body, productId: new mongoose.Types.ObjectId(productId) };
    delete payload.subCategoryId;
    payload.isActive = payload.isActive !== false;
    const config = await NamePlateConfig.findOneAndUpdate(
      { productId: payload.productId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.status(200).json({ success: true, message: 'Name plate configuration saved', data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }

    const subCategoryObjectId = new mongoose.Types.ObjectId(subCategoryId);
    const config = await NamePlateConfig.findOne({
      subCategoryId: subCategoryObjectId,
      isActive: true,
    }).lean();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.query.debug === '1') {
      const allMatches = await NamePlateConfig.find({ subCategoryId: subCategoryObjectId })
        .select('_id subCategoryId productId isActive designs finishes sizes symbols layouts basePrice customLayoutSurcharge createdAt updatedAt')
        .lean();

      res.status(200).json({
        success: true,
        data: config ?? null,
        diagnostics: {
          databaseName: mongoose.connection.db?.databaseName ?? null,
          collectionName: NamePlateConfig.collection.name,
          connectionState: mongoose.connection.readyState,
          totalMatches: allMatches.length,
          activeMatches: allMatches.filter((item: any) => item.isActive === true).length,
          records: allMatches.map((item: any) => ({
            _id: item._id,
            subCategoryId: item.subCategoryId,
            productId: item.productId ?? null,
            isActive: item.isActive,
            designs: Array.isArray(item.designs) ? item.designs.length : 0,
            finishes: Array.isArray(item.finishes) ? item.finishes.length : 0,
            sizes: Array.isArray(item.sizes) ? item.sizes.length : 0,
            symbols: Array.isArray(item.symbols) ? item.symbols.length : 0,
            layouts: Array.isArray(item.layouts) ? item.layouts.length : 0,
            basePrice: item.basePrice,
            customLayoutSurcharge: item.customLayoutSurcharge,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
        },
      });
      return;
    }

    res.status(200).json({ success: true, data: config ?? null });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const upsertSubCategoryNamePlateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subCategoryId } = req.params;
    if (!validId(subCategoryId)) { res.status(400).json({ success: false, message: 'Invalid subcategory ID' }); return; }

    const subCategoryObjectId = new mongoose.Types.ObjectId(subCategoryId);
    const payload: any = { ...req.body, subCategoryId: subCategoryObjectId };
    delete payload.productId;
    payload.isActive = payload.isActive !== false;

    const persisted = await NamePlateConfig.findOneAndUpdate(
      { subCategoryId: subCategoryObjectId },
      { $set: payload },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        writeConcern: { w: 'majority' },
      }
    ).lean();

    if (!persisted) throw new Error('Name plate configuration write returned no document');

    const readBack = await NamePlateConfig.findById(persisted._id).lean();
    if (!readBack) throw new Error(`Name plate configuration write succeeded but read-back failed (id ${persisted._id.toString()})`);
    if (readBack.subCategoryId?.toString() !== subCategoryId) throw new Error(`Name plate configuration read-back has unexpected subCategoryId (id ${readBack._id.toString()})`);

    res.status(200).json({
      success: true,
      message: 'Name plate subcategory configuration saved',
      data: readBack,
      diagnostics: process.env.NODE_ENV === 'development' ? {
        databaseName: mongoose.connection.db?.databaseName ?? null,
        collectionName: NamePlateConfig.collection.name,
        persistedId: readBack._id,
        subCategoryId: readBack.subCategoryId,
        isActive: readBack.isActive,
        designs: Array.isArray(readBack.designs) ? readBack.designs.length : 0,
        finishes: Array.isArray(readBack.finishes) ? readBack.finishes.length : 0,
        sizes: Array.isArray(readBack.sizes) ? readBack.sizes.length : 0,
        symbols: Array.isArray(readBack.symbols) ? readBack.symbols.length : 0,
      } : undefined,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: 'Failed to save name plate subcategory configuration', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
