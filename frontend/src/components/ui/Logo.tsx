/**
 * The JagoBridge brand mark — the same artwork as the browser-tab favicon in
 * index.html, so the tab icon and the in-app header can never drift apart.
 *
 * The SVG is inlined (rather than an <img src>) so it inherits sizing from
 * className and needs no extra network request.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="#0d26de" />
      <path
        d="M7 20c0-4 3-7 9-7s9 3 9 7"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M7 24h18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
