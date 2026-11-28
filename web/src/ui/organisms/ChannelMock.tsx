import type { ReactNode } from "react";
import { HashIcon } from "@phosphor-icons/react";
import { Avatar } from "../atoms/Avatar";
import { Badge } from "../atoms/Badge";

export type MockMessage = { author: string; /** A small pill after the name, such as "bot". */ tag?: string; when: string; body: ReactNode; /** A muted line under the message. */ note?: string };

/**
 * A drawn chat channel, in a neutral look of our own: the channel name on top, then messages with avatar, name and time.
 * Nothing in it is interactive; `label` names the figure ("On Discord").
 */
export function ChannelMock({ label, channel, messages }: { label: string; channel: string; messages: MockMessage[] }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-semibold">{label}</figcaption>
      <div className="min-w-0 overflow-hidden rounded-md border border-line bg-raised">
        <p className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-sm font-semibold">
          <HashIcon aria-hidden className="text-ink/60" />
          {channel}
        </p>
        <ol className="flex flex-col gap-3 px-3 py-3">
          {messages.map((m, i) => (
            <li key={i} className="flex min-w-0 gap-2.5">
              <Avatar login={m.author} size={28} className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm leading-5">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink/70">
                  <span className="text-sm font-semibold text-ink">{m.author}</span>
                  {m.tag && <Badge>{m.tag}</Badge>}
                  <span>{m.when}</span>
                </p>
                <div className="min-w-0 break-words">{m.body}</div>
                {m.note && <p className="text-xs text-ink/60">{m.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
