/**
 * Curated name-plate-friendly fonts from a local Fonts directory.
 * We intentionally skip huge CJK packs, .fon bitmaps, and full system dumps.
 *
 * `sourceFile` is the filename under FONT_SOURCE_DIR (default ~/Downloads/Fonts).
 */
export interface FontCatalogEntry {
  /** Stable slug used as object key basename on B2 */
  id: string;
  /** CSS font-family name used in overlayConfig.fontFamily */
  family: string;
  /** Filename inside the local Fonts folder */
  sourceFile: string;
}

export const FONT_CATALOG: FontCatalogEntry[] = [
  // Condensed / industrial (common on name plates)
  { id: 'agency-fb', family: 'Agency FB', sourceFile: 'AGENCYR.TTF' },
  { id: 'agency-fb-bold', family: 'Agency FB Bold', sourceFile: 'AGENCYB.TTF' },
  { id: 'engravers-gothic-bt', family: 'Engravers Gothic BT', sourceFile: 'EngraversGothic BT.ttf' },
  { id: 'stencil', family: 'Stencil', sourceFile: 'STENCIL.TTF' },
  { id: 'stencil-std', family: 'Stencil Std', sourceFile: 'StencilStd.otf' },
  { id: 'impact', family: 'Impact', sourceFile: 'impact.ttf' },
  { id: 'playbill', family: 'Playbill', sourceFile: 'PLAYBILL.TTF' },
  { id: 'magneto', family: 'Magneto', sourceFile: 'MAGNETOB.TTF' },
  { id: 'snap-itc', family: 'Snap ITC', sourceFile: 'SNAP____.TTF' },

  // Classic serif / engraved feel
  { id: 'bodoni-bt-book', family: 'Bodoni BT Book', sourceFile: 'Bodoni Bk BT Book.ttf' },
  { id: 'bodoni-bt-bold', family: 'Bodoni BT Bold', sourceFile: 'Bodoni Bd BT Bold.ttf' },
  { id: 'adobe-garamond-pro', family: 'Adobe Garamond Pro', sourceFile: 'AGaramondPro-Regular.otf' },
  { id: 'georgia', family: 'Georgia Custom', sourceFile: 'georgia.ttf' },
  { id: 'algerian', family: 'Algerian', sourceFile: 'ALGER.TTF' },
  { id: 'matura-mt-script', family: 'Matura MT Script Capitals', sourceFile: 'MATURASC.TTF' },

  // Script / decorative
  { id: 'brush-script-mt', family: 'Brush Script MT', sourceFile: 'BRUSHSCI.TTF' },
  { id: 'brush-script-std', family: 'Brush Script Std', sourceFile: 'BrushScriptStd.otf' },
  { id: 'french-script-mt', family: 'French Script MT', sourceFile: 'FRSCRIPT.TTF' },
  { id: 'script-mt-bold', family: 'Script MT Bold', sourceFile: 'SCRIPTBL.TTF' },
  { id: 'pristina', family: 'Pristina', sourceFile: 'PRISTINA.TTF' },
  { id: 'rage-italic', family: 'Rage Italic', sourceFile: 'RAGE.TTF' },
  { id: 'mistral', family: 'Mistral', sourceFile: 'MISTRAL.TTF' },
  { id: 'viner-hand-itc', family: 'Viner Hand ITC', sourceFile: 'VINERITC.TTF' },
  { id: 'vivaldi', family: 'Vivaldi', sourceFile: 'VIVALDII.TTF' },
  { id: 'vladimir-script', family: 'Vladimir Script', sourceFile: 'VLADIMIR.TTF' },
  { id: 'kunstler-script', family: 'Kunstler Script', sourceFile: 'KUNSTLER.TTF' },
  { id: 'edwardian-script', family: 'Edwardian Script ITC', sourceFile: 'ITCEDSCR.TTF' },

  // Display
  { id: 'birch-std', family: 'Birch Std', sourceFile: 'BirchStd.otf' },
  { id: 'blackoak-std', family: 'Blackoak Std', sourceFile: 'BlackoakStd.otf' },
  { id: 'chiller', family: 'Chiller', sourceFile: 'CHILLER.TTF' },
  { id: 'forte', family: 'Forte', sourceFile: 'FORTE.TTF' },
  { id: 'jokerman', family: 'Jokerman', sourceFile: 'JOKERMAN.TTF' },
  { id: 'papyrus', family: 'Papyrus', sourceFile: 'PAPYRUS.TTF' },
];

export function contentTypeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.otf') return 'font/otf';
  if (e === '.woff') return 'font/woff';
  if (e === '.woff2') return 'font/woff2';
  return 'font/ttf';
}

export function formatForExt(ext: string): 'opentype' | 'truetype' | 'woff' | 'woff2' {
  const e = ext.toLowerCase();
  if (e === '.otf') return 'opentype';
  if (e === '.woff') return 'woff';
  if (e === '.woff2') return 'woff2';
  return 'truetype';
}
