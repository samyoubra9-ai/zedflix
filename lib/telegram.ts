import {
  findContact,
  getTelegramState,
  rememberContact,
  setActiveTarget,
  type TelegramContact,
} from "@/lib/telegram-state";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: TelegramUser;
  reply_to_message?: { text?: string };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: { chat: { id: number; type: string }; message_id: number };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineButton = { text: string; callback_data: string };

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function adminId() {
  return process.env.TELEGRAM_ADMIN_ID || "";
}

function displayName(user?: TelegramUser | null, contact?: TelegramContact | null) {
  if (contact?.name) return contact.name;
  if (!user) return "Client";
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Client";
}

function usernameOf(user?: TelegramUser | null, contact?: TelegramContact | null) {
  if (contact?.username) return contact.username;
  return user?.username ? `@${user.username}` : "";
}

async function api(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} refusé: ${detail.slice(0, 180)}`);
  }
  return response.json().catch(() => ({}));
}

async function send(
  chatId: string | number,
  text: string,
  extra: {
    buttons?: InlineButton[][];
    replyMarkup?: Record<string, unknown>;
  } = {},
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (extra.buttons?.length) {
    payload.reply_markup = { inline_keyboard: extra.buttons };
  } else if (extra.replyMarkup) {
    payload.reply_markup = extra.replyMarkup;
  }
  await api("sendMessage", payload);
}

async function answerCallback(id: string, text?: string) {
  await api("answerCallbackQuery", {
    callback_query_id: id,
    text: text || "",
    show_alert: false,
  });
}

/** Notify the Minuit admin chat (trial requests, etc.). */
export async function notifyAdmin(text: string) {
  const owner = adminId();
  if (!token() || !owner) {
    throw new Error("Telegram admin indisponible");
  }
  await send(owner, text);
}

function targetOf(reply: string) {
  return reply.match(/^#(\d+)/)?.[1] || "";
}

function contactLabel(contact: TelegramContact) {
  const who = [contact.name, contact.username].filter(Boolean).join(" ");
  return who || `#${contact.id}`;
}

function replyButtons(targetId: string, name: string): InlineButton[][] {
  return [
    [{ text: `Répondre à ${name.slice(0, 28)}`, callback_data: `talk:${targetId}` }],
  ];
}

function sessionButtons(targetId: string): InlineButton[][] {
  return [
    [
      { text: "Fermer la session", callback_data: "stop" },
      { text: "Inbox", callback_data: "inbox" },
    ],
    [{ text: `Resélectionner #${targetId}`, callback_data: `talk:${targetId}` }],
  ];
}

async function openSession(adminChatId: string, targetId: string) {
  const contact = await findContact(targetId);
  await setActiveTarget(targetId);
  const label = contact ? contactLabel(contact) : `#${targetId}`;
  await send(
    adminChatId,
    `Session ouverte avec ${label}.\nTout ce que tu écris maintenant lui est envoyé par le bot (sans ton nom).\n/stop pour fermer.`,
    { buttons: sessionButtons(targetId) },
  );
}

async function closeSession(adminChatId: string, silent = false) {
  const state = await getTelegramState();
  const previous = state.activeTarget;
  await setActiveTarget(null);
  if (!silent) {
    await send(
      adminChatId,
      previous ? `Session fermée (était #${previous}).` : "Aucune session active.",
    );
  }
}

async function showInbox(adminChatId: string) {
  const state = await getTelegramState();
  if (!state.contacts.length) {
    await send(adminChatId, "Inbox vide pour l’instant.");
    return;
  }
  const lines = state.contacts.slice(0, 12).map((contact, index) => {
    const preview = contact.lastText.replace(/\s+/g, " ").slice(0, 60);
    return `${index + 1}. ${contactLabel(contact)}\n   #${contact.id} · ${preview}`;
  });
  const buttons: InlineButton[][] = state.contacts.slice(0, 8).map((contact) => [
    {
      text: `Parler · ${contactLabel(contact).slice(0, 40)}`,
      callback_data: `talk:${contact.id}`,
    },
  ]);
  if (state.activeTarget) {
    buttons.push([{ text: "Fermer la session", callback_data: "stop" }]);
  }
  await send(
    adminChatId,
    `Inbox (${state.contacts.length})\nSession: ${
      state.activeTarget ? `#${state.activeTarget}` : "aucune"
    }\n\n${lines.join("\n\n")}\n\nOu /parler <id>`,
    { buttons },
  );
}

async function handleAdminCommand(adminChatId: string, text: string) {
  if (text === "/start" || text === "/help") {
    await send(
      adminChatId,
      "Support Minuit\n\n/inbox — derniers clients\n/parler <id> — ouvrir une session\n/stop — fermer la session\n/qui — session en cours\n\nOu utilise les boutons sous chaque message.",
    );
    return true;
  }
  if (text === "/inbox") {
    await showInbox(adminChatId);
    return true;
  }
  if (text === "/stop" || text === "/fin") {
    await closeSession(adminChatId);
    return true;
  }
  if (text === "/qui" || text === "/session") {
    const state = await getTelegramState();
    if (!state.activeTarget) {
      await send(adminChatId, "Aucune session active.\n/inbox pour choisir quelqu’un.");
      return true;
    }
    const contact = await findContact(state.activeTarget);
    await send(
      adminChatId,
      `Session active: ${contact ? contactLabel(contact) : "Client"} (#${state.activeTarget})`,
      { buttons: sessionButtons(state.activeTarget) },
    );
    return true;
  }
  const talk = text.match(/^\/(?:parler|talk|reply)\s+(\d+)\s*$/i);
  if (talk) {
    await openSession(adminChatId, talk[1]);
    return true;
  }
  return false;
}

async function handleCallback(query: TelegramCallbackQuery) {
  const owner = adminId();
  const chatId = String(query.message?.chat.id || query.from.id);
  if (!owner || chatId !== owner) {
    await answerCallback(query.id, "Réservé à l’admin");
    return;
  }
  const data = String(query.data || "");
  if (data === "stop") {
    await closeSession(chatId);
    await answerCallback(query.id, "Session fermée");
    return;
  }
  if (data === "inbox") {
    await showInbox(chatId);
    await answerCallback(query.id);
    return;
  }
  const talk = data.match(/^talk:(\d+)$/);
  if (talk) {
    await openSession(chatId, talk[1]);
    await answerCallback(query.id, "Session ouverte");
    return;
  }
  await answerCallback(query.id);
}

async function forwardToAdmin(message: TelegramMessage, text: string) {
  const owner = adminId();
  if (!owner) return;

  const chatId = String(message.chat.id);
  const name = displayName(message.from);
  const username = usernameOf(message.from);
  await rememberContact({
    id: chatId,
    name,
    username,
    lastText: text,
  });

  const state = await getTelegramState();
  const active = state.activeTarget;

  if (active === chatId) {
    await send(
      owner,
      `#${chatId}\n${[name, username].filter(Boolean).join(" ")} · session\n\n${text}`,
    );
    return;
  }

  if (active && active !== chatId) {
    const current = await findContact(active);
    await send(
      owner,
      `Autre client pendant ta session (${
        current ? contactLabel(current) : `#${active}`
      })\n\n#${chatId}\n${[name, username].filter(Boolean).join(" ")}\n\n${text}`,
      {
        buttons: [
          [{ text: `Changer vers ${name.slice(0, 24) || chatId}`, callback_data: `talk:${chatId}` }],
          [{ text: "Garder la session actuelle", callback_data: `talk:${active}` }],
          [{ text: "Inbox", callback_data: "inbox" }],
        ],
      },
    );
    return;
  }

  await send(
    owner,
    `#${chatId}\n${[name, username].filter(Boolean).join(" ")}\n\n${text}`,
    { buttons: replyButtons(chatId, name) },
  );
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (!token()) return;

  if (update.callback_query) {
    try {
      await handleCallback(update.callback_query);
    } catch {
      // ignore callback errors to keep webhook 200
    }
    return;
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return;

  const chatId = String(message.chat.id);
  const owner = adminId();

  // Admin side
  if (owner && chatId === owner) {
    if (await handleAdminCommand(chatId, text)) return;

    // Legacy: reply to a #id message still works
    if (message.reply_to_message?.text) {
      const target = targetOf(message.reply_to_message.text);
      if (target) {
        await send(target, text);
        await send(chatId, `Envoyé à #${target} (via reply).`);
        return;
      }
    }

    const state = await getTelegramState();
    if (state.activeTarget) {
      await send(state.activeTarget, text);
      const contact = await findContact(state.activeTarget);
      await send(
        chatId,
        `→ ${contact ? contactLabel(contact) : `#${state.activeTarget}`}`,
      );
      return;
    }

    await send(
      chatId,
      "Aucune session active.\nOuvre /inbox ou appuie sur « Répondre à … » sous un message.",
    );
    return;
  }

  if (message.chat.type !== "private") {
    if (text.startsWith("/start") || text.includes("/start")) {
      await send(chatId, "Pour demander un compte, écris-moi en message privé.");
    }
    return;
  }

  if (text === "/start" || text === "/help") {
    await send(
      chatId,
      "Bienvenue sur Minuit.\n\nÉcris ici pour demander un compte avec 3 jours d’essai (un essai par appareil).\nExemple : Je veux un essai 3 jours — Android TV.\n\nLa réponse arrivera dans cette discussion.",
    );
    return;
  }

  if (!owner) return;

  await forwardToAdmin(message, text);
  await send(chatId, "Message reçu. Tu auras une réponse ici.");
}
