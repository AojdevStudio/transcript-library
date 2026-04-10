import Link from "next/link";
import { Badge } from "@/components/Badge";
import { SearchBar } from "@/components/SearchBar";
import {
  searchTranscriptLibrary,
  type SearchEntityType,
  type SearchGroup,
  type SearchMatchSource,
} from "@/modules/search";

export const dynamic = "force-dynamic";

const sourceCopy: Record<
  SearchMatchSource,
  { label: string; tone: "neutral" | "quiet" | "amber" }
> = {
  title: { label: "Title", tone: "neutral" },
  topic: { label: "Topic", tone: "quiet" },
  channel: { label: "Channel", tone: "quiet" },
  transcript: { label: "Transcript", tone: "quiet" },
  summary: { label: "Summary", tone: "amber" },
  takeaway: { label: "Takeaway", tone: "amber" },
  "action-item": { label: "Action Item", tone: "amber" },
  "notable-point": { label: "Notable Point", tone: "neutral" },
  knowledge: { label: "Knowledge", tone: "neutral" },
};

function pickQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightSnippet(snippet: string, query: string) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return snippet;

  const regex = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const normalizedTokens = new Set(tokens.map((token) => token.toLowerCase()));
  return snippet.split(regex).map((part, index) =>
    normalizedTokens.has(part.toLowerCase()) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-[0.35rem] bg-[var(--accent)]/16 px-1 py-0.5 text-[var(--ink)]"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function sectionLabel(entityType: SearchEntityType): string {
  return entityType === "video" ? "Video result" : "Knowledge result";
}

function actionLabel(entityType: SearchEntityType): string {
  return entityType === "video" ? "Open video" : "Open document";
}

function ResultCard({ group, query }: { group: SearchGroup; query: string }) {
  const isKnowledge = group.entityType === "knowledge";

  return (
    <article
      className={
        isKnowledge
          ? "rounded-[28px] border border-[var(--line)] bg-[var(--accent-soft)]/45 p-6 shadow-[var(--shadow-card)]"
          : "rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
              {sectionLabel(group.entityType)}
            </div>
            <Link
              href={group.href}
              className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)] transition hover:text-[var(--accent)]"
            >
              {group.title}
            </Link>
            {group.subtitle && <p className="text-sm text-[var(--muted)]">{group.subtitle}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {group.topic && <Badge tone="quiet">{group.topic}</Badge>}
            {group.category && <Badge tone="neutral">{group.category}</Badge>}
            {group.matchedSources.map((source) => (
              <Badge key={source} tone={sourceCopy[source].tone}>
                {sourceCopy[source].label}
              </Badge>
            ))}
          </div>
        </div>

        <Link
          href={group.href}
          className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-white"
        >
          {actionLabel(group.entityType)}
        </Link>
      </div>

      <div className="mt-5 grid gap-3">
        {group.topMatches.map((match, index) => (
          <div
            key={`${group.id}-${match.source}-${index}`}
            className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
                {sourceCopy[match.source].label}
              </div>
              <div className="text-xs text-[var(--muted)]">{match.matchedIn}</div>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              {highlightSnippet(match.snippet, query)}
            </p>
          </div>
        ))}
      </div>

      {group.allMatches.length > group.topMatches.length && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          {group.allMatches.length - group.topMatches.length} more matching sections are available
          for this result.
        </p>
      )}
    </article>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = pickQuery(params.q).trim();
  const response = query.length >= 2 ? searchTranscriptLibrary(query) : null;
  const blended = response?.blended ?? [];
  const grouped = response?.grouped ?? { videos: [], knowledge: [] };
  const totalResults = response?.meta.totalResults ?? 0;

  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-5 pt-4">
        <div className="space-y-3">
          <h1 className="font-display text-4xl tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">
            Search the transcript library
          </h1>
          <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--muted)]">
            Search across video metadata, transcript text, curated insight summaries, action items,
            and knowledge documents. Use this when you remember the idea but not where it lives.
          </p>
        </div>

        <SearchBar variant="hero" autoFocus className="max-w-4xl" defaultQuery={query} />

        {query.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Try a phrase like{" "}
            <span className="font-medium text-[var(--ink)]">cloudflare tunnel</span>,{" "}
            <span className="font-medium text-[var(--ink)]">vector database</span>, or{" "}
            <span className="font-medium text-[var(--ink)]">retry queue</span>.
          </p>
        ) : query.length < 2 ? (
          <p className="text-sm text-[var(--muted)]">
            Enter at least two characters so the results stay useful.
          </p>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Found <span className="font-semibold text-[var(--ink)]">{totalResults}</span>{" "}
            {totalResults === 1 ? "result" : "results"} for{" "}
            <span className="font-semibold text-[var(--ink)]">&quot;{query}&quot;</span>.
          </p>
        )}
      </section>

      {query.length >= 2 && totalResults === 0 && (
        <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)]">
            No matches yet
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Try a shorter phrase, a synonym, or a more distinctive noun from the transcript, insight
            summary, or knowledge document.
          </p>
        </section>
      )}

      {blended.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)]">
                Top results
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Best blended matches across videos and knowledge.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {blended.map((group) => (
              <ResultCard key={`blended-${group.id}`} group={group} query={query} />
            ))}
          </div>
        </section>
      )}

      {query.length >= 2 && (grouped.videos.length > 0 || grouped.knowledge.length > 0) && (
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)]">Videos</h2>
              <p className="text-sm text-[var(--muted)]">
                Matches from video metadata, transcripts, and curated insights.
              </p>
            </div>

            <div className="grid gap-4">
              {grouped.videos.map((group) => (
                <ResultCard key={`video-${group.id}`} group={group} query={query} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="font-display text-2xl tracking-[-0.03em] text-[var(--ink)]">
                Knowledge
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Matches from the shared markdown knowledge base.
              </p>
            </div>

            <div className="grid gap-4">
              {grouped.knowledge.map((group) => (
                <ResultCard key={`knowledge-${group.id}`} group={group} query={query} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
