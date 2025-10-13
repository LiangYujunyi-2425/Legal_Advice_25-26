import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';

// 居中泡泡聊天（保留 API / 上傳 邏輯），帶 banner 波動與右側 AI 表情互動
const RightBlock = forwardRef(({ visible, setVisible, videoOpen, aiMood: propAiMood, setAiMood: propSetAiMood }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || '';
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    addMessage(role, content) {
      setMessages(prev => [...prev, { role, content }]);
    }
  }));

  const eyesRef = useRef(null);

  const [squash, setSquash] = useState(false);
  const [aiMoodLocal, setAiMoodLocal] = useState('neutral'); // fallback local mood
  const aiMood = propAiMood || aiMoodLocal;
  const setAiMood = propSetAiMood || setAiMoodLocal;
  const toggleVisible = () => {
    setVisible(prev => !prev);
    // 当弹窗打开时聚焦输入框并展开灵动岛
    setTimeout(() => {
      if (!visible) {
        setIsIslandExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 160);
      } else {
        setIsIslandExpanded(false);
      }
    }, 120);
  };

  useEffect(() => {
    // banner 波动 - 每当有新消息时触发一次波动动画
    const banner = document.querySelector('.banner');
    if (!banner) return;
    banner.classList.add('wave');
    const t = setTimeout(() => banner.classList.remove('wave'), 700);
    return () => clearTimeout(t);
  }, [messages.length]);

  // Random blink: add `blink` class to eyes group at random intervals
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    const schedule = () => {
      const delay = 2000 + Math.random() * 6000; // 2-8s
      timeoutId = setTimeout(() => {
        if (!mounted) return;
        const eyes = eyesRef.current;
        if (!eyes) { schedule(); return; }
        eyes.classList.add('blink');
        // short blink
        setTimeout(() => {
          eyes.classList.remove('blink');
          if (mounted) schedule();
        }, 140);
      }, delay);
    };

    schedule();
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAiMood('thinking');
    setSquash(true);
    setTimeout(() => setSquash(false), 160);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await response.json();
      const answer = data?.answer || data?.reply || JSON.stringify(data || '');
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      setAiMood('happy');
      setTimeout(() => setAiMood('neutral'), 1200);
    } catch (error) {
      console.error('AI 回覆失敗', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 回覆失敗，請稍後再試。' }]);
      setAiMood('sad');
      setTimeout(() => setAiMood('neutral'), 1200);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setAiMood('excited');
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `📄 合同分析完成：\n\n摘要：${data.summary || '無摘要'}\n\n風險：${(data.risks || []).join('、')}` }
      ]);
      setAiMood('happy');
      setTimeout(() => setAiMood('neutral'), 900);
    } catch (error) {
      console.error('上傳失敗', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ 文件分析失敗，請稍後再試。' }
      ]);
      setAiMood('sad');
      setTimeout(() => setAiMood('neutral'), 1200);
    }
  };

  return (
    <>
      {/* 浮動右下開關 */}
      <button
        className={`openbutt island ${isIslandExpanded ? 'expanded' : ''}`}
        onClick={toggleVisible}
        aria-label="開啟聊天"
      >
        <div className="island-content">
          <div className="dot" />
        </div>
      </button>

      {/* 中央泡泡對話框 */}
  <div className={`center-overlay ${visible ? 'visible' : 'hidden'}`} onClick={() => setVisible(false)} />
  <div className={`center-bubble ${visible ? 'open' : 'closed'} ${squash ? 'squash' : ''} ${videoOpen ? 'compressed' : ''}`} role="dialog" aria-hidden={!visible}>
        <div className={`bubble-header ${isIslandExpanded ? 'stretch' : ''}`} onClick={(e) => { e.stopPropagation(); setIsIslandExpanded(s => !s); }}>
          <div className="header-left">
            <div className="avatar-bubble" />
            <div className="title">法律助理</div>
          </div>
          <div className="header-right">{messages.length} 訊息</div>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="問我有關合同或法律的問題..."
            />
            <button onClick={sendMessage}>送出</button>
            <label className="file-label">
              📎
              <input className="file-input" type="file" accept="application/pdf" onChange={uploadFile} />
            </label>
          </div>
        </div>
      </div>
      {/* 右側 AI 表情（跟隨對話情緒變化），若拍照模式中則隱藏 */}
      <div className="ai-face-outer" aria-hidden={!visible || videoOpen}>
        {!videoOpen && (
          <svg className={`ai-face-svg cyberpunk mood-${aiMood}`} viewBox="0 0 200 200" width="120" height="120" role="img" aria-label={`賽博風女AI 表情 ${aiMood}`}>
            <defs>
              <linearGradient id="neon1" x1="0" x2="1">
                <stop offset="0" stopColor="#72f0ff" />
                <stop offset="1" stopColor="#8affc7" />
              </linearGradient>
              <linearGradient id="neon2" x1="0" x2="1">
                <stop offset="0" stopColor="#ff7bda" />
                <stop offset="1" stopColor="#9b7bff" />
              </linearGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="4" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>

            <g className="cp-background">
              <rect x="0" y="0" width="200" height="200" rx="40" fill="#061019" />
              <rect x="6" y="6" width="188" height="188" rx="34" fill="url(#neon1)" opacity="0.04" />
            </g>

            <g transform="translate(0,8)">
              {/* visor / hairband */}
              <rect x="32" y="34" width="136" height="26" rx="12" fill="url(#neon2)" opacity="0.18" filter="url(#glow)" />

              {/* face base */}
              <ellipse cx="100" cy="106" rx="44" ry="46" fill="#08121a" stroke="#0ff8d6" strokeOpacity="0.08" />

              {/* cyber eyes - with inner glow and pulse rects */}
              <g className="cp-eyes" ref={eyesRef}>
                <rect className="cp-eye left" x="70" y="86" width="20" height="12" rx="3" fill="#00f6ff" opacity="0.95" />
                <rect className="cp-eye right" x="110" y="86" width="20" height="12" rx="3" fill="#9b7bff" opacity="0.95" />
                <rect className="cp-eye-core left" x="76" y="88" width="6" height="6" rx="2" fill="#001" opacity="0.85" />
                <rect className="cp-eye-core right" x="118" y="88" width="6" height="6" rx="2" fill="#001" opacity="0.85" />
              </g>

              {/* mouth - thin neon bar that can pulse */}
              <rect className="cp-mouth" x="86" y="128" width="28" height="6" rx="3" fill="#ff6bdb" opacity="0.96" />

              {/* little HUD accents */}
              <rect x="44" y="60" width="6" height="6" rx="1" fill="#72f0ff" opacity="0.7" />
              <rect x="150" y="60" width="6" height="6" rx="1" fill="#ff7bda" opacity="0.7" />
            </g>
          </svg>
        )}
      </div>
    </>
  );
});

export default RightBlock;