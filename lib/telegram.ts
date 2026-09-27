type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  reply_to_message?: { text?: string };
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function adminId() {
  return process.env.TELEGRAM_ADMIN_ID || "";
}

async function send(chatId: string | number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    throw new Error("Telegram a refusé l'envoi");
  }
}

function targetOf(reply: string) {
  return reply.match(/^#(\d+)/)?.[1] || "";
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!token()) return;
  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return;

  const chatId = String(message.chat.id);
  const owner = adminId();

  if (owner && chatId === owner && message.reply_to_message?.text) {
    const target = targetOf(message.reply_to_message.text);
    if (target) {
      await send(target, text);
      return;
    }
  }

  if (message.chat.type !== "private") {
    if (text.startsWith("/start") || text.includes("/start")) {
      await send(chatId, "Pour demander un compte, écris-moi en message privé.");
    }
    return;
  }

  if (text === "/start") {
    await send(chatId, "Écris ton message ici. La réponse arrivera dans cette discussion, pour l'ouverture du compte.");
    return;
  }

  if (!owner) return;

  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ");
  const username = message.from?.username ? `@${message.from.username}` : "";
  await send(owner, `#${chatId}\n${[name, username].filter(Boolean).join(" ")}\n\n${text}`);
  await send(chatId, "Message reçu. Tu auras une réponse ici.");
}
