import type { ReactNode } from "react";
import { Avatar } from "../atoms/Avatar";
import { Badge } from "../atoms/Badge";

export type MockComment = { author: string; /** A small pill after the name, such as "bot". */ tag?: string; when: string; body: ReactNode };

/**
 * A drawn issue or pull request thread, in a neutral code-host look of our own: avatar, name, and the comment in a bordered box.
 * Nothing in it is interactive; `label` names the figure ("On GitHub").
 */
export function CommentThreadMock({ label, title, comments }: { label: string; /** The item's title line, above the thread. */ title: ReactNode; comments: MockComment[] }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-semibold">{label}</figcaption>
      <div className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-panel p-3">
        <p className="min-w-0 break-words border-b border-line pb-2 text-md font-semibold">{title}</p>
        <ol className="flex flex-col gap-3">
          {comments.map((c, i) => (
            <li key={i} className="flex min-w-0 gap-2.5">
              <Avatar login={c.author} size={28} className="mt-0.5" />
              <div className="min-w-0 flex-1 overflow-hidden rounded border border-line">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line bg-sunken px-3 py-1.5 text-xs text-ink/70">
                  <span className="font-semibold text-ink">{c.author}</span>
                  {c.tag && <Badge>{c.tag}</Badge>}
                  <span>{c.when}</span>
                </p>
                <div className="flex min-w-0 flex-col gap-1.5 break-words px-3 py-2 text-sm leading-5">{c.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
