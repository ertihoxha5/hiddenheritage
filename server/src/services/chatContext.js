import { readFile } from 'node:fs/promises';
import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  monumentId: z.union([z.number().int().positive().safe(), z.string().trim().min(1).max(150).regex(/^[a-z0-9][a-z0-9-]*$/)]).optional(),
  language: z.string().max(20).regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/).default('en'),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }).strict()).max(12).default([]),
}).strict().refine((input) => input.history.reduce((total, turn) => total + turn.content.length, 0) <= 16000, 'Conversation history is too long');

export async function loadChatMonuments() {
  try {
    const records = JSON.parse(await readFile(new URL('../../data/monuments.json', import.meta.url), 'utf8'));
    if (!Array.isArray(records)) throw new Error('Invalid dataset');
    return records;
  } catch { throw Object.assign(new Error('Ciceroni couldn’t respond right now. Please try again.'), { status: 503 }); }
}

const normalize = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function namesFor(monument) {
  return [monument.slug?.replaceAll('-', ' '), monument.name_en, monument.name_sq, ...(Array.isArray(monument.aliases) ? monument.aliases : [])].map(normalize).filter(Boolean);
}
function matches(text, monument) {
  const question = ` ${normalize(text)} `;
  return namesFor(monument).some((name) => {
    if (question.includes(` ${name} `)) return true;
    const words = name.split(' ').filter((word) => word.length > 2);
    return words.length >= 2 && words.every((word) => question.includes(` ${word} `));
  });
}
function findMatches(text, records) {
  const direct = records.filter((monument) => matches(text, monument));
  if (direct.length) return direct;
  const question = ` ${normalize(text)} `;
  const places = records.filter((monument) => {
    const place = normalize(monument.municipality);
    return place && question.includes(` ${place} `);
  });
  if (places.length) return places;
  return records.filter((monument) => {
    const shortName = normalize(monument.slug?.replace(/-(?:fortress|archaeological-site)$/, ''));
    return shortName && question.includes(` ${shortName} `);
  });
}

export async function selectChatContext(input, records, db) {
  let selected;
  if (input.monumentId !== undefined) {
    let slug = String(input.monumentId);
    if (/^\d+$/.test(slug)) {
      const numericId = Number(slug);
      if (!Number.isSafeInteger(numericId) || numericId < 1) throw Object.assign(new Error('Invalid monument ID'), { status: 400 });
      const [rows] = await db.execute('SELECT slug FROM monuments WHERE id = ?', [numericId]);
      slug = rows[0]?.slug;
    }
    selected = records.filter((monument) => monument.slug === slug);
    if (!selected.length) throw Object.assign(new Error('Monument not found'), { status: 404 });
  } else {
    selected = findMatches(input.message, records);
    // Follow-up questions can refer to the most recent named monument.
    if (!selected.length) {
      for (const turn of [...input.history].reverse()) {
        if (turn.role !== 'user') continue;
        selected = findMatches(turn.content, records);
        if (selected.length) break;
      }
    }
  }
  const ambiguous = selected.length > 1;
  // Ambiguity includes only names, so the model asks rather than mixing histories.
  if (ambiguous) return { monuments: [], sources: [], clarify: selected.slice(0, 3).map((monument) => monument.name_en), ambiguous: true };
  const sources = [];
  const monuments = selected.slice(0, 1).map((monument) => {
    const sourceIds = [];
    for (const [index, item] of (monument.sources || []).slice(0, 8).entries()) {
      const urlText = typeof item === 'string' ? item : item?.url;
      let url;
      try { url = new URL(urlText); } catch { continue; }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      const id = `${monument.slug}-${index + 1}`;
      sourceIds.push(id);
      sources.push({ id, title: item?.title || `${monument.name_en} — ${url.hostname}`, url: url.href });
    }
    return {
      name: monument.name_en, name_sq: monument.name_sq, location: monument.municipality,
      type: monument.type, period: monument.built_period, history: monument.history,
      hypotheticalAppearance: monument.original_appearance,
      uncertainties: monument.reconstruction_note || 'Original architectural appearance may be uncertain.', sourceIds,
    };
  });
  return { monuments, sources, clarify: [], ambiguous: false };
}
