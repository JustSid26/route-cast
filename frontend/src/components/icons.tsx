// Minimal inline SVG line icons (Heroicons-style). No emojis — these scale and
// inherit currentColor for clean, consistent theming.

type IconProps = { className?: string };

function svg(path: React.ReactNode) {
  return function Icon({ className = 'h-5 w-5' }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    );
  };
}

export const Icons = {
  dashboard: svg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  depot: svg(
    <>
      <path d="M3 21V9l9-6 9 6v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M3 21h18" />
    </>
  ),
  vehicle: svg(
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  delivery: svg(
    <>
      <path d="M21 7.5 12 2.25 3 7.5l9 5.25 9-5.25Z" />
      <path d="M3 7.5v9L12 21.75 21 16.5v-9" />
      <path d="M12 12.75v9" />
    </>
  ),
  optimize: svg(<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />),
  map: svg(
    <>
      <path d="M9 4 3.5 6.2v13.6L9 17.6l6 2.2 5.5-2.2V4L15 6.2 9 4Z" />
      <path d="M9 4v13.6" />
      <path d="M15 6.2v13.6" />
    </>
  ),
  route: svg(
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 16.5c6-1 8-3 8-8" strokeDasharray="2 2.4" />
    </>
  ),
  clock: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

export type IconKey = keyof typeof Icons;
