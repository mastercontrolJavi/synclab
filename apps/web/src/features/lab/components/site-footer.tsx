import { GithubIcon } from "@/components/brand/github-icon";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 border-t border-line px-4 pt-4 pb-36 text-[12.5px] text-ink-faint sm:flex-row sm:items-center sm:justify-between lg:pb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Built by <span className="text-ink-muted">{SITE.author}</span>
        </span>
        <a
          href={SITE.github}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GithubIcon className="size-3.5" />
          Source on GitHub
        </a>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Tech stack">
        {SITE.stack.map((item) => (
          <li key={item} className="rounded-md border border-line bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
            {item}
          </li>
        ))}
      </ul>
    </footer>
  );
}
