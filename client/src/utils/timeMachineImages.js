export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const formats = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };

export function validatePhotoFile(file) {
  const extension = file?.name?.split('.').at(-1)?.toLowerCase();
  if (!file || !formats[extension] || (file.type && file.type !== formats[extension])) throw new Error('Choose a PNG, JPG, JPEG, or SVG image.');
  if (!file.size) throw new Error('This image is empty. Choose another file.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 5 MB or smaller.');
  return extension;
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(new Error('The image took too long to load. Choose another file.')); }, 10000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('This image could not be read. Choose another file.')); };
    image.src = url;
  });
}

function canvasFor(image, maxSide = 2048) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || width * height > 40000000) throw new Error('Choose an image smaller than 40 megapixels with valid dimensions.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this image. Try another browser.');
  return { canvas, context };
}

function pngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The image could not be converted. Try a PNG or JPEG instead.')), 'image/png');
  });
}

export async function preparePhoto(file) {
  const extension = validatePhotoFile(file);
  const sourceUrl = URL.createObjectURL(file);
  try {
    // SVG stays in the browser's inert image context, never inserted as markup.
    const image = await loadImage(sourceUrl);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose an image smaller than 40 megapixels with valid dimensions.');
    if (extension !== 'svg') return file.type ? file : new File([file], file.name, { type: formats[extension] });
    const { canvas, context } = canvasFor(image);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await pngBlob(canvas);
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('The converted SVG exceeds 5 MB. Choose a smaller image.');
    return new File([blob], 'reference.png', { type: 'image/png' });
  } finally { URL.revokeObjectURL(sourceUrl); }
}

