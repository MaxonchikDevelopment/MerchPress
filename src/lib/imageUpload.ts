import { supabase } from './supabase';

// Client-side prep for design photos. The `designs` bucket accepts only
// jpeg/png/webp up to 5 MB, and phone photos are bigger than that.

const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;
const JPEG_QUALITY = 0.85;

export const DECODE_ERROR = 'Use a JPEG or PNG image.';
export const TOO_BIG_ERROR = 'This photo is still over 5 MB after resizing. Use a smaller image.';

// Errors with a message that is already fit to show to the admin.
export class ImageError extends Error {}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  try {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
  } catch {
    // Older browsers without createImageBitmap(Blob): fall back to <img>.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError(DECODE_ERROR);
  }
}

export interface PreparedImage {
  blob: Blob;
  contentType: 'image/png' | 'image/jpeg';
  ext: 'png' | 'jpg';
}

// Decode, scale so the longest side is at most 1600 px (never upscale), re-encode.
// PNG and WebP sources become PNG to keep transparency; everything else JPEG.
export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new ImageError(DECODE_ERROR);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError(DECODE_ERROR);

    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp';
    if (!keepAlpha) {
      ctx.fillStyle = '#fff'; // JPEG has no alpha; transparent areas would turn black
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img.source, 0, 0, w, h);

    const contentType = keepAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, contentType, keepAlpha ? undefined : JPEG_QUALITY),
    );
    if (!blob) throw new ImageError(DECODE_ERROR);
    if (blob.size > MAX_BYTES) throw new ImageError(TOO_BIG_ERROR);
    return { blob, contentType, ext: keepAlpha ? 'png' : 'jpg' };
  } finally {
    img.release();
  }
}

export type UploadStage = 'preparing' | 'uploading';

// Compresses and uploads one design photo under the event's folder. Returns the object path.
export async function uploadDesignPhoto(
  eventId: string,
  file: File,
  side: 'front' | 'back',
  onStage?: (stage: UploadStage) => void,
): Promise<string> {
  onStage?.('preparing');
  const { blob, contentType, ext } = await prepareImage(file);
  onStage?.('uploading');
  const path = `${eventId}/${crypto.randomUUID()}-${side}.${ext}`;
  const { error } = await supabase.storage.from('designs').upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// Best-effort removal of storage objects; a failure is logged, never thrown.
export async function removePhotos(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  try {
    const { error } = await supabase.storage.from('designs').remove(list);
    if (error) console.warn('Could not delete design photo(s):', list, error.message);
  } catch (e) {
    console.warn('Could not delete design photo(s):', list, e);
  }
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ImageError) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message;
  return fallback;
}
