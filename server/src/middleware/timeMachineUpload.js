import path from 'node:path';
import multer from 'multer';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const invalidImage = (message) => Object.assign(new Error(message), { status: 400 });
const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export const timeMachineUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, fieldSize: 32, parts: 2 },
  fileFilter(_req, file, callback) {
    const type = types[path.extname(file.originalname).toLowerCase()];
    callback(type && type === file.mimetype ? null : invalidImage('Upload a PNG or JPEG image. SVG files must be converted to PNG first.'), !!type && type === file.mimetype);
  },
}).single('image');

// Check bytes and dimensions as well as the browser-supplied MIME/extension.
export function inspectImage(buffer, mimetype) {
  let width;
  let height;
  if (mimetype === 'image/png' && buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR') {
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (mimetype === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer.at(-2) === 255 && buffer.at(-1) === 217) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset++] !== 255) break;
      while (buffer[offset] === 255) offset++;
      const marker = buffer[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        height = buffer.readUInt16BE(offset + 3);
        width = buffer.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (!width || !height) throw invalidImage('This file is not a valid PNG or JPEG image.');
  if (width * height > 40000000) throw invalidImage('Choose an image smaller than 40 megapixels.');
  return { width, height };
}
