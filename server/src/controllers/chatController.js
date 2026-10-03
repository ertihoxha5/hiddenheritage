import { chatSchema, loadChatMonuments, selectChatContext } from '../services/chatContext.js';
import { answerChat } from '../services/groqService.js';

export function createChatController(db, generate = answerChat) {
  return {
    async list(_req, res) {
      const records = await loadChatMonuments();
      res.json(records.map((monument) => ({ id: monument.slug, name_en: monument.name_en, name_sq: monument.name_sq })));
    },
    async chat(req, res) {
      const input = chatSchema.parse(req.body);
      const records = await loadChatMonuments();
      const context = await selectChatContext(input, records, db);
      const controller = new AbortController();
      const cancel = () => { if (!res.writableEnded) controller.abort(); };
      res.on('close', cancel);
      try {
        const result = await generate(input, context, { signal: controller.signal });
        if (!res.destroyed) res.json(result);
      } finally { res.off('close', cancel); }
    },
  };
}
