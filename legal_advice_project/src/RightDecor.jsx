import React from 'react';
import './index.css';

export default function RightDecor() {
  // Pure presentational decorative SVG with subtle animations
  return (
    <aside className="right-decor" aria-hidden="true">
      <svg className="decor-svg" viewBox="0 0 200 600" preserveAspectRatio="xMidYMid meet" width="200" height="600" role="img">
        <defs>
          <linearGradient id="g-decor" x1="0" x2="1">
            <stop offset="0" stopColor="#9bd8cf" stopOpacity="0.9" />
            <stop offset="1" stopColor="#4a8b74" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <g className="bubbles">
          <circle className="b1" cx="40" cy="80" r="28" fill="url(#g-decor)" opacity="0.12" />
          <circle className="b2" cx="120" cy="160" r="18" fill="url(#g-decor)" opacity="0.1" />
          <circle className="b3" cx="60" cy="280" r="36" fill="url(#g-decor)" opacity="0.08" />
          <circle className="b4" cx="140" cy="420" r="22" fill="url(#g-decor)" opacity="0.09" />
          <circle className="b5" cx="30" cy="520" r="14" fill="url(#g-decor)" opacity="0.11" />
        </g>

        <g className="streaks">
          <ellipse className="s1" cx="100" cy="40" rx="40" ry="6" fill="#9bd8cf" opacity="0.06" />
          <ellipse className="s2" cx="60" cy="240" rx="28" ry="4" fill="#4a8b74" opacity="0.04" />
        </g>
      </svg>
    </aside>
  );
}
