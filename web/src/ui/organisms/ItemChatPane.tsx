import type { ReactNode } from "react";
import { ChatsIcon } from "@phosphor-icons/react";
import type { ItemChat } from "../../api/types";
import { t } from "../../../../src/i18n/index.ts";
import { EmptyState } from "../atoms/EmptyState";
import { Pending } from "../atoms/Pending";
import { ItemConversation } from "./ItemConversation";

/**
 * An item's chat with AutoCraft as one column: its main conversation with the composer, or one line while it has none, with the
 * item's holds (`holds`) right above the composer either way.
 */
export function ItemChatPane({ chat, error, holds, onSend, onWithdraw, onEvent, onGithub }: {
  chat: ItemChat | undefined;
  error?: Error;
  holds: ReactNode;
  onSend: (text: string) => Promise<string[]>;
  onWithdraw: () => Promise<void>;
  onEvent: (id: string) => void;
  onGithub: () => void;
}) {
  if (!chat)
    return (
      <div className="flex-1">
        <Pending error={error} />
      </div>
    );
  const conv = chat.conversations[0];
  if (conv) return <ItemConversation c={conv} onSend={onSend} onWithdraw={onWithdraw} onEvent={onEvent} onGithub={onGithub} notice={holds} />;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-4">
        <EmptyState icon={ChatsIcon}>{t("No conversation yet.")}</EmptyState>
      </div>
      {holds}
    </div>
  );
}
