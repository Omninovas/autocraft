// Help → Get started: the steps a new maintainer goes through, each with a link to its reference page. The sample replies come
// from the workflow's own parser and confirmation (src/workflow), so they read as AutoCraft answers.
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, CheckSquareIcon } from "@phosphor-icons/react";
import { t } from "../../../../src/i18n/index.ts";
import { parse } from "../../../../src/workflow/parse.ts";
import { resolve } from "../../../../src/workflow/resolve.ts";
import { attributionLines, confirmLine, currentStep, stateLine, stepLines, workflowSteps } from "../../../../src/workflow/status.ts";
import type { ItemKind, ItemWorkflow } from "../../../../src/workflow/types.ts";
import { COMMANDS, WEIGHT_HELP } from "../../../../src/workflow/vocab.ts";
import { useQuery } from "../../api/client";
import type { ChatEntry } from "../../api/types";
import type { ViewProps } from "../../registry/types";
import { useSetupProgress, type SetupCheck } from "../../lib/setupProgress";
import { LinkDiscordDialog } from "../../shell/LinkDiscord";
import { Button } from "../../ui/atoms/Button";
import { ItemIcon } from "../../ui/atoms/ItemIcon";
import { CodeBlock } from "../../ui/molecules/CodeBlock";
import { Segmented } from "../../ui/molecules/Segmented";
import { AutoCraftMessage, AutoCraftTurn } from "../../ui/molecules/chat/AutoCraftMessage";
import { ChatBubble } from "../../ui/molecules/chat/ChatBubble";
import { ChannelMock } from "../../ui/organisms/ChannelMock";
import { CommentThreadMock } from "../../ui/organisms/CommentThreadMock";
import { TutorialStep } from "../../ui/organisms/TutorialStep";

const WHO = "mira";
const AT = "2026-11-28T09:31:00.000Z";
const REPO = "photocraft";
const ITEMS = [
  { number: 803, title: "Keep the alpha channel in PNG previews" },
  { number: 19, title: "Brush preview lags on large canvases" },
];
const SAID = "review and merge";
const MAIN = COMMANDS.filter((c) => !c.more);

/** What AutoCraft answers `text` with on an item nobody started, read and resolved as the server does. */
function confirmation(text: string, kind: ItemKind = "pr"): string {
  const r = resolve(parse(text, { repo: REPO }), { kind, workflow: null });
  return r.kind === "run" ? confirmLine(r.run, WHO, AT) : r.understood;
}

/** The status comment of the sample pull request after `review and merge`, while the review runs. */
function statusLines(): { head: string; rest: string[] } {
  const wf: ItemWorkflow = {
    id: 1, repo: REPO, number: ITEMS[0]!.number, kind: "pr", entry: "review", weight: 5, state: "running",
    startedBy: WHO, startedAt: AT, startedVia: "github", baseHead: null, acceptedHead: null,
    approvedBy: WHO, approvedAt: AT, approvedVia: "github", stoppedBy: null, stoppedAt: null, takenBy: null,
    blocker: null, blockerParams: null, rec: null, recAt: null, recHead: null,
    plan: [], step: "review",
    prNumber: null, reviewAskedAt: null, legacyPreapprovalId: null, version: 3, updatedAt: AT,
  };
  const steps = workflowSteps(wf, "reviewing");
  return { head: stateLine(wf, currentStep(steps)), rest: [...attributionLines(wf), ...stepLines(steps)] };
}

const Code = ({ children }: { children: ReactNode }) => <code className="code rounded bg-ink/[0.07] px-1 py-0.5 text-[0.9em]">{children}</code>;
const ref = (n: number) => `${REPO}#${n}`;
const linkCls = "rounded text-accent-ink underline underline-offset-2";

type Harness = "linux" | "mac" | "codex";
const HARNESS: Record<Harness, string> = {
  linux: "autocraft harness claude --config-dir",
  mac: "autocraft harness claude --keychain",
  codex: "autocraft harness codex\n# on a machine without a browser: autocraft harness codex --device-auth",
};

function RunnerStep({ done }: { done?: boolean }) {
  const [harness, setHarness] = useState<Harness>(typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "mac" : "linux");
  const text = [`autocraft login ${location.origin}`, HARNESS[harness], "autocraft doctor", "autocraft service install"].join("\n");
  return (
    <TutorialStep id="runner" n={2} title={t("Connect a Task Runner")} done={done} refs={[{ to: "/connect/setup", label: t("Setup guide") }, { to: "/runner", label: t("Runner page") }, { to: "/help/start", label: t("Overview") }]}>
      <p>{t("Model work runs on Task Runners: maintainers' own machines, on their own Claude or Codex subscription. What you start and what you ask the model runs on yours.")}</p>
      <p>
        {t("Install the runner with the first command of the")}{" "}
        <Link to="/connect/setup" className={linkCls}>{t("Setup guide")}</Link>
        {t(". With it installed, these log it in to this server, pick the model login, check it and keep it running:")}
      </p>
      <Segmented label={t("Model login")} value={harness} onChange={(v) => setHarness(v as Harness)} options={[{ value: "linux", label: t("Claude on Linux") }, { value: "mac", label: t("Claude on macOS") }, { value: "codex", label: "Codex" }]} />
      <CodeBlock compact title={t("Task Runner commands")} text={text} />
      <p>
        <Code>autocraft login</Code> {t("prints a link with a code. Open it and approve the code.")}{" "}
        <Code>autocraft work</Code> {t("runs it in a terminal instead of as a service.")}
      </p>
      <p>
        {t("On the")} <Link to="/runner" className={linkCls}>{t("Runner page")}</Link>, {t("My settings decide what it takes:")}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-semibold">{t("Manual only")}</dt>
        <dd>{t("only what you start or pick")}</dd>
        <dt className="font-semibold">{t("My repos, task kinds")}</dt>
        <dd>{t("the other work it may take")}</dd>
        <dt className="font-semibold">{t("Keep free")}</dt>
        <dd>{t("the share of your 5-hour and weekly plan usage it leaves unused")}</dd>
        <dt className="font-semibold">{t("Max calls at once")}</dt>
        <dd>{t("the most calls all your runners run together")}</dd>
      </dl>
      <p>
        {t("Open your runner's row on the")} <Link to="/connect" className={linkCls}>{t("Connect page")}</Link> {t("to rename it, set its access, or see its calls on the")}{" "}
        <Link to="/agents" className={linkCls}>{t("Agents page")}</Link>.
      </p>
      {done === false && <p className="text-sm text-ink/70">{t("Done when one of your Task Runners is connected and ready.")}</p>}
    </TutorialStep>
  );
}

function DiscordStep({ check }: { check?: SetupCheck }) {
  const [linking, setLinking] = useState(false);
  return (
    <TutorialStep id="discord" n={3} title={t("Link Discord")} done={check?.done} refs={[{ to: "/help/start", label: t("Overview") }]}>
      <p>
        {t("Link your Discord account, so")} <Code>@AutoCraft</Code> {t("and")} <Code>/autocraft do</Code> {t("act as you. Link Discord shows a code; run the command it shows in Discord:")}
      </p>
      <p>
        <Code>/autocraft account action:link code:…</Code>
      </p>
      {check && !check.done && (
        <>
          <Button variant="primary" className="w-fit max-md:h-11" onClick={() => setLinking(true)}>{t("Link Discord")}</Button>
          <LinkDiscordDialog open={linking} linked={check.done} onClose={() => setLinking(false)} />
        </>
      )}
    </TutorialStep>
  );
}

function Commands({ mention }: { mention: string }) {
  const one = confirmation(SAID);
  const status = statusLines();
  const many = ITEMS.map((i) => `${ref(i.number)}: ${confirmation(`${SAID} ${ref(i.number)}`)}`);
  const said: Extract<ChatEntry, { t: "said" }> = { t: "said", id: "s1", at: AT, login: WHO, via: "dashboard", body: SAID, url: null };
  const confirmed: Extract<ChatEntry, { t: "reply" }> = { t: "reply", id: "c1", at: AT, body: one, findings: [], ask: null };
  return (
    <TutorialStep id="commands" n={4} title={t("Send a command")} refs={[{ to: "/help/commands", label: t("Commands") }, { to: "/help/after", label: t("After a command") }, { to: "/help/examples", label: t("Examples") }]}>
      <p>{t("The same words work on GitHub, on Discord, in your agent and here. Combine them in one message.")}</p>
      <ul aria-label={t("Commands")} className="flex flex-wrap gap-1.5">
        {MAIN.map((c) => (
          <li key={c.word}>
            <Link to={`/help/commands#cmd-${c.word.split(" ")[0]}`} className="code inline-flex h-8 items-center rounded border border-line px-2.5 text-sm hover:bg-ink/[0.06] max-md:h-11">
              {c.word}
            </Link>
          </li>
        ))}
      </ul>
      <p>
        {t("A weight orders the queues:")} {WEIGHT_HELP.filter((w) => w.word !== "(none)").map((w, i) => <span key={w.word}>{i > 0 && ", "}<Code>{w.word}</Code></span>)}.
      </p>
      <p>
        {t("When AutoCraft asks, answer in your own words:")} <Code>yes</Code>, <Code>approve</Code> {t("or")} <Code>lgtm</Code> {t("run its recommendation; anything else says what to do instead.")}{" "}
        <Code>hold</Code> {t("(or stop, pause, wait) halts the item at once. When AutoCraft is not sure what you mean, nothing runs and it says what it understood.")}
      </p>
      <p>{t("Every accepted command gets one line back, the same on every surface:")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <CommentThreadMock
          label={t("On GitHub")}
          title={
            <span className="flex items-start gap-2">
              <ItemIcon kind="pr" state="open" tip={false} />
              <span>
                {ITEMS[0]!.title} <span className="code font-normal text-ink/60">#{ITEMS[0]!.number}</span>
              </span>
            </span>
          }
          comments={[
            { author: WHO, when: "09:30", body: <p className="code">@{mention} {SAID}</p> },
            { author: mention, tag: t("bot"), when: "09:31", body: <p>@{WHO} {one}</p> },
            {
              author: mention, tag: t("bot"), when: t("09:48, edited"),
              body: (
                <>
                  <p className="font-semibold">{status.head}</p>
                  {status.rest.map((l) => <p key={l}>{l}</p>)}
                  <p>
                    {t("Details for maintainers:")} <span className="text-accent-ink underline underline-offset-2">{t("this item")}</span>
                  </p>
                </>
              ),
            },
          ]}
        />
        <ChannelMock
          label={t("On Discord")}
          channel={REPO}
          messages={[
            {
              author: WHO, when: "09:30",
              body: (
                <p>
                  <span className="code rounded bg-accent/15 px-1 py-0.5 text-accent-ink">/autocraft do</span> <span className="code">text: {SAID} {ref(ITEMS[0]!.number)}</span>
                </p>
              ),
            },
            { author: "AutoCraft", tag: t("bot"), when: "09:30", body: <p>{one}</p>, note: t("A private reply: only {login} sees it.", { login: WHO }) },
          ]}
        />
      </div>
      <p className="text-sm">
        {t("On GitHub the comment starts with the app's name and acts on that item; AutoCraft keeps one status comment up to date. On Discord, mentioning the bot works too:")}{" "}
        <Code>@AutoCraft {SAID} {ref(ITEMS[0]!.number)}</Code>. {t("It answers in a thread, where a command that names no item acts on the thread's items.")}
      </p>
      <figure className="flex min-w-0 flex-col gap-2">
        <figcaption className="text-sm font-semibold">{t("In AutoCraft")}</figcaption>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 rounded-md border border-line p-3">
            <p className="text-sm text-ink/70">{t("Items: tick the rows; the command box opens. Type only the words: each ticked item gets the command.")}</p>
            <div className="flex flex-col gap-2 rounded-lg border border-line-strong bg-raised p-3">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{t("Command")}</span>
                <span className="num text-ink/70">{t("{n} items selected", { n: ITEMS.length })}</span>
              </p>
              <p className="code rounded border border-line bg-sunken px-2 py-1.5 text-sm">{SAID}</p>
              <span aria-hidden className="inline-flex h-8 w-fit items-center rounded border border-accent bg-accent px-3 text-sm font-medium text-white">{t("Run")}</span>
              {many.map((l) => <p key={l} className="text-sm text-ink/80">{l}</p>)}
            </div>
            <ul aria-label={t("Ticked items")} className="flex flex-col divide-y divide-line rounded border border-line">
              {ITEMS.map((i) => (
                <li key={i.number} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                  <CheckSquareIcon role="img" aria-label={t("Ticked")} weight="fill" className="mt-0.5 shrink-0 text-accent-ink" />
                  <ItemIcon kind="pr" state="open" tip={false} />
                  <span className="min-w-0 break-words">
                    <span className="code text-ink/70">{ref(i.number)}</span> {i.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-2 rounded-md border border-line p-3">
            <p className="text-sm text-ink/70">{t("An item's page: type in its chat.")}</p>
            <ol aria-label={t("Sample chat")} className="flex flex-col gap-4">
              <ChatBubble e={said} />
              <AutoCraftTurn at={confirmed.at} text={confirmed.body}>
                <AutoCraftMessage e={confirmed} open={false} />
              </AutoCraftTurn>
            </ol>
          </div>
        </div>
      </figure>
    </TutorialStep>
  );
}

function TalkStep() {
  const question: Extract<ChatEntry, { t: "said" }> = { t: "said", id: "q1", at: "2026-11-28T10:02:00.000Z", login: WHO, via: "dashboard", body: t("Why does the preview lose the alpha channel?"), url: null };
  const answer: Extract<ChatEntry, { t: "reply" }> = {
    t: "reply", id: "r1", at: "2026-11-28T10:03:00.000Z", findings: [], ask: null,
    body: t("The preview encoder converts to RGB before writing the PNG (`preview/encode.rs`, line 88). Writing RGBA there keeps the alpha channel; the full export already does that."),
  };
  return (
    <TutorialStep id="talk" n={5} title={t("Ask the model about an item")} refs={[{ to: "/help/after", label: t("After a command") }, { to: "/help/roles", label: t("Who can do what") }]}>
      <p>{t("Ask a question in an item's chat, with a question mark. Opus answers there. It reads the item, the chat so far and the repository's code, and changes nothing.")}</p>
      <p>{t("Your question runs on your own Task Runner, so it must be connected and ready. Everyone who can see the repository reads the answer. A message that is not a question is read as a command.")}</p>
      <p>{t("Opus may recommend a command; nothing runs until someone sends it. Until Opus answers, you can withdraw your question.")}</p>
      <ol aria-label={t("Sample chat")} className="flex flex-col gap-4 rounded-md border border-line p-3">
        <ChatBubble e={question} />
        <AutoCraftTurn at={answer.at} text={answer.body}>
          <AutoCraftMessage e={answer} open={false} />
        </AutoCraftTurn>
      </ol>
    </TutorialStep>
  );
}

function FollowStep() {
  const q = (query: string) => (
    <Link to={`/items?q=${encodeURIComponent(query)}`} className="code rounded text-accent-ink underline underline-offset-2">
      {query}
    </Link>
  );
  return (
    <TutorialStep id="follow" n={6} title={t("Follow the work")} refs={[{ to: "/help/after", label: t("After a command") }, { to: "/help/workflows", label: t("Workflows") }]}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>
          <Link to="/" className={linkCls}>{t("Home")}</Link>: {t("your items with their last message; an item with a question for you is marked.")}
        </li>
        <li>
          <Link to="/items" className={linkCls}>{t("Items")}</Link>: {t("search with qualifiers such as")} {q("is:draft")}, {q("is:ready")}, {q("is:asked")} {t("or")} {q("autocraft:waiting")}.
        </li>
        <li>
          <Link to="/queue" className={linkCls}>{t("Work queue")}</Link>: {t("what runs, what waits and why.")}
        </li>
        <li>
          <Link to="/agents" className={linkCls}>{t("Agents")}</Link>
          {t(", in the sidebar: the model calls that are running, waiting and finished. A waiting call says why, such as no Task Runner ready or all of them busy.")}
        </li>
        <li>{t("An item's page: the chat, and beside it the GitHub and Events tabs with everything that happened to the item.")}</li>
      </ul>
    </TutorialStep>
  );
}

function AgentStep() {
  return (
    <TutorialStep id="agent" n={7} title={t("Use AutoCraft from your own agent")} refs={[{ to: "/connect", label: t("Connect") }]}>
      <p>
        {t("Make a token in the MCP Connector block of the")} <Link to="/connect" className={linkCls}>{t("Connect page")}</Link>
        {t(". It shows the command that adds AutoCraft to Claude Code, and a config for other clients. Your agent then reads your items and questions, and with a token that may send commands, it sends the same commands as you.")}
      </p>
    </TutorialStep>
  );
}

const STEPS = [
  ["intro", () => t("What AutoCraft does for you")],
  ["runner", () => t("Connect a Task Runner")],
  ["discord", () => t("Link Discord")],
  ["commands", () => t("Send a command")],
  ["talk", () => t("Ask the model about an item")],
  ["follow", () => t("Follow the work")],
  ["agent", () => t("Use AutoCraft from your own agent")],
] as const;

export function TutorialView({ user }: ViewProps) {
  const { data } = useQuery("mention", (api) => api.mention());
  const mention = data?.mention ?? "app";
  const setup = useSetupProgress(user);
  const check = (id: SetupCheck["id"]) => setup.checks?.find((c) => c.id === id);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 text-md leading-relaxed">
        <Link to="/help" className="inline-flex h-11 w-fit items-center gap-1.5 rounded text-sm text-ink/70 hover:text-ink">
          <ArrowLeftIcon aria-hidden /> {t("Help")}
        </Link>
        <h1 className="text-xl font-semibold">{t("Get started")}</h1>
        <p>{t("Set up once, then send your first command. Each step links to its full reference in Help.")}</p>
        {setup.checks && <p className="text-sm text-ink/70">{t("Setup: {done} of {all} done", { done: setup.done, all: setup.checks.length })}</p>}
        <nav aria-label={t("Steps")}>
          <ol className="flex list-decimal flex-col gap-0.5 pl-6 text-sm">
            {STEPS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-7 items-center rounded text-accent-ink hover:underline max-md:min-h-11">
                  {title()}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <TutorialStep id="intro" n={1} title={t("What AutoCraft does for you")} refs={[{ to: "/help/workflows", label: t("Workflows") }, { to: "/help/after", label: t("After a command") }]}>
          <p>{t("Start an issue or pull request with a command, such as review, fix-up or implement. AutoCraft does the work and posts what it found.")}</p>
          <p>{t("Add merge to approve the merge. It works like pressing the merge button yourself: AutoCraft reviews, fixes what the review finds and merges in your name when CI is green. It comes back to you only when it cannot get there on its own.")}</p>
          <p>{t("Without merge, it comes back with one recommendation when the steps are done.")}</p>
        </TutorialStep>
        <RunnerStep done={check("runner")?.done} />
        <DiscordStep check={check("discord")} />
        <Commands mention={mention} />
        <TalkStep />
        <FollowStep />
        <AgentStep />
      </div>
    </div>
  );
}

