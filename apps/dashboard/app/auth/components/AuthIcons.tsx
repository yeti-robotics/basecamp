import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function DiscordIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M19.5 5.3A18 18 0 0 0 15 3.9l-.6 1.2a16.2 16.2 0 0 0-4.8 0L9 3.9a18 18 0 0 0-4.5 1.4C1.6 9.6.8 13.8 1.2 18a18.2 18.2 0 0 0 5.5 2.8L8 19a11.7 11.7 0 0 1-2.1-1c.2-.2.3-.3.5-.4 4 1.8 8.2 1.8 12.2 0l.5.4c-.7.4-1.4.7-2.1 1l1.3 1.8a18.2 18.2 0 0 0 5.5-2.8c.5-4.9-.8-9.1-4.3-12.7ZM8.7 15.5c-1.2 0-2.2-1.1-2.2-2.5s1-2.5 2.2-2.5S11 11.6 11 13s-1 2.5-2.3 2.5Zm6.6 0C14 15.5 13 14.4 13 13s1-2.5 2.3-2.5 2.2 1.1 2.2 2.5-1 2.5-2.2 2.5Z"
      />
    </svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="15.5" cy="7.5" r="4.5" />
      <path d="m12.3 10.7-7.8 7.8v2h2.8v-2.3h2.3v-2.3h2.3l1.5-1.5" />
    </svg>
  );
}
