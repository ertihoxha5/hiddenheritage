export const CICERONI_ERROR = 'Ciceroni couldn’t respond right now. Please try again.';

export function buildChatHistory(messages) {
  const history = [];
  let characters = 0;
  for (const message of [...messages].reverse()) {
    if (!['user', 'assistant'].includes(message.role) || message.failed) continue;
    const content = message.content.trim().slice(0, 2000);
    if (!content) continue;
    if (history.length === 12 || characters + content.length > 16000) break;
    history.unshift({ role: message.role, content }); characters += content.length;
  }
  return history;
}
