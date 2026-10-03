import { inspectImage } from '../middleware/timeMachineUpload.js';
import { reconstructImage } from '../services/leonardoService.js';
import { parseHistoricalContext } from '../services/historicalContext.js';

export function createTimeMachineController(generate = reconstructImage) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    const dimensions = inspectImage(req.file.buffer, req.file.mimetype);
    const context = parseHistoricalContext(req.body?.historicalContext);
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const result = await generate({ ...req.file, ...dimensions }, { signal: controller.signal, context });
      if (typeof result?.imageUrl !== 'string' || !/^https:\/\//.test(result.imageUrl)) throw Object.assign(new Error('Historical reconstruction could not be generated. Please try again.'), { status: 502 });
      if (!res.destroyed) res.json({ imageUrl: result.imageUrl, historicalContext: context });
    } finally { res.off('close', cancel); }
  };
}
