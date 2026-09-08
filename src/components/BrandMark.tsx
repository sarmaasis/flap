/** Shared Flap mark — charcoal square, paper envelope, orange flap (matches favicon). */
export default function BrandMark({ className = "inline-flex h-4 w-4 items-center justify-center" }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.4 5.1L8 8.7l5.6-3.6V11c0 .77-.63 1.4-1.4 1.4H3.8c-.77 0-1.4-.63-1.4-1.4V5.1z"
          fill="var(--mark-ink, #faf9f6)"
        />
        <path d="M2.4 5.1L8 8.7l5.6-3.6L8 2.8 2.4 5.1z" fill="var(--mark-flap, #f26522)" />
        <path d="M4.2 13.2h7.6" stroke="var(--mark-flap, #f26522)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
