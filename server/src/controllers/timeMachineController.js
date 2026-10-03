import { inspectImage } from '../middleware/timeMachineUpload.js';
import { reconstructImage } from '../services/leonardoService.js';
import { loadHistoricalContext } from '../services/historicalContext.js';

export function createTimeMachineController(generate = reconstructImage) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    const dimensions = inspectImage(req.file.buffer, req.file.mimetype);
    if (Object.keys(req.body || {}).some((key) => key !== 'mode')) return res.status(400).json({ error: 'Upload one image and optionally choose a reconstruction mode.' });
    const context = await loadHistoricalContext(req.body?.mode || 'original-era');
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const result = await generate({ ...req.file, ...dimensions }, { signal: controller.signal, context });
      let imageUrl;
      try { imageUrl = new URL(result?.imageUrl); } catch { /* Invalid provider result. */ }
      if (!imageUrl || imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password) throw Object.assign(new Error('Historical reconstruction could not be generated. Please try again.'), { status: 502 });
      if (!res.destroyed) {
        const { monuments, ...displayContext } = context;
        res.json({ imageUrl: result.imageUrl, historicalContext: displayContext });
      }
    } finally { res.off('close', cancel); }
  };
}
