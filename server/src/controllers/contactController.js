import { contactSchema } from '../services/validation.js';

export function createContactController(db) {
  return async (req, res) => {
    const { name, email, message } = contactSchema.parse(req.body);
    await db.execute('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
    res.status(201).json({ message: 'Message received. Thank you for getting in touch.' });
  };
}
