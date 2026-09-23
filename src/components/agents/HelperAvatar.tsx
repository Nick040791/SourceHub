import React from 'react';

type HelperAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<HelperAvatarSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

interface HelperAvatarProps {
  /** Tailwind size override; otherwise use `size`. */
  className?: string;
  size?: HelperAvatarSize;
  title?: string;
}

/**
 * Minimal Helper identity mark — Style D (charcoal fill, muted lime stroke).
 * Soft rounded square + quiet geometric glyph (not a robot emoji).
 */
export const HelperAvatar: React.FC<HelperAvatarProps> = ({
  className,
  size = 'md',
  title = 'Helper',
}) => {
  const dim = className ?? SIZE_CLASS[size];
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={`${dim} shrink-0 text-hub-accent`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {/* Soft rounded square — dark fill, muted lime edge */}
      <rect
        x="3.5"
        y="3.5"
        width="25"
        height="25"
        rx="7.5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.85"
      />
      {/* Quiet geometric glyph: two uprights + crossbar (abstract H) */}
      <path
        d="M11.5 10.5V21.5M20.5 10.5V21.5M11.5 16H20.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.95"
      />
    </svg>
  );
};
