import { type RefObject, useEffect, useState } from 'react';

interface ScrollIndicatorProps {
  targetRef: RefObject<HTMLDivElement | null>;
}

/** Animated mouse icon with scroll-wheel dot, fades out as user scrolls */
export function ScrollIndicator({ targetRef }: ScrollIndicatorProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    targetRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 cursor-pointer transition-opacity duration-500 ${visible ? 'opacity-70 hover:opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-label="Scroll to dashboard"
    >
      {/* Mouse outline with animated scroll dot */}
      <svg
        width="24"
        height="38"
        viewBox="0 0 24 38"
        fill="none"
        className="text-white drop-shadow-lg"
      >
        {/* Mouse body */}
        <rect
          x="1"
          y="1"
          width="22"
          height="36"
          rx="11"
          stroke="currentColor"
          strokeWidth="2"
        />
        {/* Scroll wheel dot — animated */}
        <circle
          cx="12"
          cy="10"
          r="2"
          fill="currentColor"
          className="animate-scroll-dot"
        />
      </svg>
    </button>
  );
}
