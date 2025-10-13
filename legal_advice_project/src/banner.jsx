import React, { useState, useEffect } from 'react';
import './index.css';

export default function Banner({ aiMood, setAiMood, setVisible }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (aiMood === 'excited') setExpanded(true);
    else setExpanded(false);
  }, [aiMood]);

  return (
    <header className={`banner ai-island ${expanded ? 'expanded' : ''}`} role="banner">
      <button className="ai-island-btn" aria-pressed={expanded} onClick={() => { setVisible(prev => !prev); setExpanded(s => !s); }} aria-label="切換聊天視窗">
        <svg viewBox="0 0 220 64" width="420" height="64" role="img" aria-label={`AI 靈動島，狀態 ${aiMood}`}>
          <defs>
            <linearGradient id="islandGrad" x1="0" x2="1">
              <stop offset="0" stopColor="#b8ffea" />
              <stop offset="1" stopColor="#5dd4a7" />
            </linearGradient>
          </defs>
          <g>
            <rect x="0" y="0" width="220" height="64" rx="32" fill="url(#islandGrad)" opacity="0.14" />
            <g transform="translate(18,10)">
              {/* face */}
              <circle cx="20" cy="22" r="18" fill="#fff" opacity="0.95" />
              <circle cx="20" cy="22" r="17" fill="#bff3e6" />
              <ellipse cx="12" cy="20" rx="3" ry="3" fill="#022" />
              <ellipse cx="28" cy="20" rx="3" ry="3" fill="#022" />
              <path className={`banner-mouth mood-${aiMood}`} d="M10,30 Q20,36 30,30" stroke="#022" strokeWidth="3" fill="transparent" strokeLinecap="round" />
            </g>
            <text x="68" y="36" fill="rgba(0,0,0,0.6)" fontSize="14" fontWeight="700">AI 助手</text>
          </g>
        </svg>
      </button>
    </header>
  );
}