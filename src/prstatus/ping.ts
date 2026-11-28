// The reply that pings the people a status comment's question asks. Edits of the status comment notify nobody and it names them as plain
// logins, so each new question of an item with a status comment gets one short reply comment: the asked people's @-logins beside the
// recommendation line the status comment shows, how to answer and a link to the status comment. A question is the workflow's
// recommendation at its time (`<workflow id>:<rec_at>`, as Discord alerts key it); `pr_status_comments.pinged` keeps the last one pinged,
// so a question is never pinged twice on one item, nor again on an implementation's PR after its issue. A command's reply on the item that
// showed the question records it the same way (data/workflow markQuestionShown), and the person whose command made the question is not
// pinged about it. A ping that fails PING_TRIES times in a row is given up (`<key> given up`); its failures never hold up the comment's edits.
// An issue's review posts its own comment with its recommendation, and an automatic-rule row asks nobody: neither gets a ping.
import { t } from "../i18n/index.ts";
import { loadAccess } from "../data/access/index.ts";
import type { Db } from "../db/index.ts";
import { openQuestion } from "../workflow/asked.ts";
import { recommendationLine } from "../workflow/status.ts";
import { sameQuestion, type ItemWorkflow, type Recommendation } from "../workflow/types.ts";

export type Ping = { key: string; workflowId: number; recAt: string | null; rec: Recommendation; to: string[] };

/** Failed pings of one question before it is given up. */
export const PING_TRIES = 3;
/** A question written this soon after a person's command was made by that command: its reply told them. */
export const PRODUCED_MS = 10_000;

/** `<key> given up`: the stored value of a question whose pings failed PING_TRIES times. */
export const givenUp = (key: string): string => `${key} given up`;

/** The open question a ping is due for, or null: none open, an issue review's own, or one `pinged` (the item's keys already pinged) holds. */
export function pingDue(wf: ItemWorkflow, pinged: readonly (string | null | undefined)[]): Ping | null {
  if (wf.kind === "issue" && wf.entry === "review") return null;
  const open = openQuestion(wf);
  if (!open) return null;
  const key = `${wf.id}:${wf.recAt ?? ""}`;
  return pinged.some((v) => v === key || v === givenUp(key)) ? null : { key, workflowId: wf.id, recAt: wf.recAt, rec: open.rec, to: open.to };
}

/**
 * How to answer, the same words in the status comment and its pings. Where a yes runs nothing (an implementation's question with no
 * recommended option), the answer is an option's number, or the person's own words when the question has no options.
 */
export function answerHow(slug: string, wf: Pick<ItemWorkflow, "rec" | "plan">): string {
  if (!wf.rec?.question || wf.rec.answer) return t("Answer in a comment that starts with `@{slug}`: go ahead, or say what to do instead.", { slug });
  return wf.plan.some((p) => p.option !== undefined && sameQuestion(p.question, wf.rec!.question))
    ? t("Answer in a comment that starts with `@{slug}`: an option's number, or another command.", { slug })
    : t("Answer in a comment that starts with `@{slug}`: your answer, or another command.", { slug });
}

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9]))*$/;

/** Of `logins`, the GitHub logins of people with an AutoCraft login: no names that are not a GitHub account. */
export async function pingable(db: Db, logins: readonly string[]): Promise<string[]> {
  const shaped = logins.filter((l) => l.length <= 39 && LOGIN.test(l));
  const access = await loadAccess(db, shaped);
  return shaped.filter((l) => access.has(l.toLowerCase()));
}

/** The reply: the pings beside the recommendation line, how to answer, and the link to the status comment (null: none known). */
export function pingBody(to: readonly string[], wf: Pick<ItemWorkflow, "rec" | "plan">, rec: Recommendation, slug: string | null, link: string | null): string {
  const parts = [`${to.map((l) => `@${l}`).join(" ")} ${recommendationLine(rec)!}`];
  const tail = [slug ? answerHow(slug, wf) : null, link ? t("[Status comment]({link})", { link }) : null].filter((x): x is string => x !== null);
  if (tail.length) parts.push(tail.join(" "));
  return parts.join("\n\n");
}
