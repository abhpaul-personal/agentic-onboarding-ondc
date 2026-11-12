export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--bg)]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-[var(--ink3)]">
        <p className="max-w-[60ch]">
          Personal case-study project. Not affiliated with ONDC or any network participant. All sellers
          and identifiers are fictional test data.
        </p>
        <nav className="flex gap-3">
          <a
            href="https://github.com/abhpaul-personal/agentic-onboarding-ondc"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/abhpaul"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            LinkedIn
          </a>
          <a
            href="https://abhijit-paul-portfolio-pm.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--ink2)] hover:text-[var(--ink)]"
          >
            Portfolio
          </a>
        </nav>
      </div>
    </footer>
  );
}
