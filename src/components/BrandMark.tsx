/** Shared Flap mark — envelope glyph in the brand square. */
export default function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 5.2L8 8.8l5.5-3.6V11a1.2 1.2 0 0 1-1.2 1.2H3.7A1.2 1.2 0 0 1 2.5 11V5.2z"
          fill="var(--mark-ink)"
        />
        <path
          d="M2.5 5.2L8 8.8l5.5-3.6L8 3 2.5 5.2z"
          fill="var(--mark-flap)"
        />
      </svg>
    </span>
  );
}
