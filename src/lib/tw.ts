/** Shared Tailwind class strings. Layout lives on components, not in CSS files. */
export const tw = {
  muted: "text-[13px] text-[var(--foreground-muted)]",
  error: "text-[13px] text-[var(--error-text)]",
  err: "mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--error-text)_35%,transparent)] bg-[color-mix(in_srgb,var(--error-text)_10%,transparent)] px-3 py-2.5 text-[13px] text-[var(--error-text)]",
  notice:
    "mb-4 rounded-[10px] border border-[rgb(var(--accent-rgb)/0.22)] bg-[rgb(var(--accent-rgb)/0.08)] px-3.5 py-3 text-[13px] leading-[1.45] text-[var(--foreground)]",
  noticeWarn:
    "mb-4 rounded-[10px] border border-[rgba(180,120,40,0.28)] bg-[rgba(180,120,40,0.08)] px-3.5 py-3 text-[13px] leading-[1.45] text-[var(--foreground)]",
  stack: "flex flex-col",
  eyebrow:
    "mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]",
  skipLink:
    "absolute left-3 top-3 z-[100] -translate-y-[120%] rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow)] transition-transform focus:translate-y-0 focus:outline-none focus:shadow-[var(--focus-ring)]",
  brand: "inline-flex items-center gap-2.5 font-bold tracking-tight no-underline",
  emptyState: "my-2.5 text-[12.5px] text-[var(--foreground-muted)]",
  textButton:
    "border-0 border-b border-transparent bg-transparent p-0 text-[13px] font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
  domainSwatch: "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
  nativeControl:
    "box-border min-h-9 min-w-0 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  authShell:
    "grid min-h-screen place-items-center bg-[var(--surface)] px-4 py-8 [background-image:radial-gradient(circle_at_15%_15%,rgba(var(--accent-rgb),0.08),transparent_36%),radial-gradient(circle_at_90%_85%,rgba(var(--accent-rgb),0.04),transparent_34%)]",
  authCard:
    "w-full max-w-[420px] rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-7 shadow-[var(--shadow)]",
  settingsCard:
    "w-full min-w-0 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[18px] py-4 shadow-none max-md:px-3.5 max-md:py-3",
  appFeatureCard:
    "rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-4 shadow-none md:px-6 md:py-5",
  rowForm:
    "my-2 flex flex-wrap items-center gap-1.5 [&>input]:h-9 [&>input]:min-w-0 [&>input]:flex-1 [&>select]:h-9 [&>select]:min-w-0 [&>select]:flex-1 [&>button]:h-9 [&>button]:w-auto [&>button]:shrink-0 [&>textarea]:min-w-0 [&>textarea]:flex-1 max-md:[&>input]:min-w-full max-md:[&>select]:min-w-full",
  sectionHeading: "mb-2.5 flex flex-wrap items-start justify-between gap-3",
  mailToast:
    "fixed right-[18px] bottom-[18px] z-[80] flex max-w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-overlay)] px-3.5 py-3 text-[13px] text-[var(--foreground)] shadow-lg [&_strong]:mb-0.5 [&_strong]:block [&_span]:text-[var(--foreground-muted)]",
  mailToastAction:
    "cursor-pointer whitespace-nowrap rounded-lg border-0 bg-[var(--surface-hover)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-active)]",
  mailToastClose:
    "cursor-pointer rounded-lg border-0 bg-transparent px-1.5 py-1 text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  modalBack:
    "fixed inset-0 z-20 grid place-items-end bg-[rgba(2,6,12,0.72)] pr-7 pb-[22px] backdrop-blur-[4px] max-md:place-items-end max-md:p-0",
  modal:
    "w-[min(690px,calc(100vw-32px))] rounded-2xl border border-[var(--line)] bg-[var(--surface-overlay)] px-[22px] pt-[22px] pb-4 shadow-[var(--shadow)] md:w-[min(690px,calc(100vw-280px))]",
  authPasswordToggle:
    "w-full cursor-pointer rounded-[10px] border border-dashed border-[var(--line-strong)] bg-transparent p-2.5 text-[13px] text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
  featureEmptyMock:
    "mx-auto flex w-full max-w-[280px] flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-left",
  featureEmptyRow: "flex min-h-7 items-center gap-2.5",
  featureEmptyLine: "block h-2 min-w-0 flex-1 rounded bg-[var(--surface-hover)]",
  featureEmptyAvatar:
    "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[10px] font-bold text-[var(--accent-text)]",
  featureEmptySwatch:
    "inline-flex h-[22px] w-[22px] shrink-0 rounded-md bg-[color-mix(in_srgb,var(--accent)_35%,var(--surface-hover))]",
  featureEmptyChip:
    "shrink-0 rounded-md bg-[var(--accent-dim)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent-text)] uppercase",
  appFeatureList:
    "m-0 grid list-none gap-2 p-0 [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:justify-between [&_li]:gap-2 [&_li]:rounded-xl [&_li]:border [&_li]:border-[var(--line)] [&_li]:bg-[var(--surface-raised)] [&_li]:px-3.5 [&_li]:py-3",
  skeletonStack: "px-0 py-1",
  featureEmptyCal: "grid grid-cols-7 gap-1",
  featureEmptyDay: "aspect-square rounded-md bg-[var(--surface-hover)]",
  featureEmptyDayHit:
    "aspect-square rounded-md bg-[var(--accent-dim)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_40%,transparent)]",
  skeletonRow:
    "mx-3 mb-2 h-[72px] animate-pulse rounded-[10px] bg-[linear-gradient(110deg,var(--surface)_25%,var(--surface-hover)_40%,var(--surface)_55%)] bg-[length:200%_100%]",
} as const;
