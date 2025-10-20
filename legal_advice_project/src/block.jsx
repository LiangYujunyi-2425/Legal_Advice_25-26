import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';
import xiaojinglin from './assets/xiaojinglin.webp';

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
  const overlayRef = useRef(null);
  const bubbleTimerRef = useRef(null);

  const [squash, setSquash] = useState(false);
  const [aiMoodLocal, setAiMoodLocal] = useState('neutral'); // fallback local mood
  const aiMood = propAiMood || aiMoodLocal;
  const setAiMood = propSetAiMood || setAiMoodLocal;
  const [facePop, setFacePop] = useState(false);
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

  // 映射簡單 emoji，用於小表情泡泡
  const emoji = aiMood === 'happy' ? '😊'
    : aiMood === 'sad' ? '😢'
    : aiMood === 'thinking' ? '🤔'
    : aiMood === 'excited' ? '🤩'
    : '😐';

  // 每當 aiMood 變更時觸發短暫的 pop 動畫
  useEffect(() => {
    setFacePop(true);
    const t = setTimeout(() => setFacePop(false), 700);
    return () => clearTimeout(t);
  }, [aiMood]);

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

    // collapse 中央泡泡并启动背景泡泡动画流程
    setVisible(false);
    startBubblesFlow(text);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await response.json();
      const answer = data?.answer || data?.reply || JSON.stringify(data || '');
      // 在对话动画过程中可以让泡泡显示部分回答
      setBubbles(prev => prev.map((b, i) => ({ ...b, text: answer.slice(0, Math.max(30, 30 + i * 10)) })));
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

  // Start bubble animation flow: create bubbles, position origin near latest user message,
  // keep them animating for 10s, then dismiss and re-open the dialog.
  const [bubblesActive, setBubblesActive] = useState(false);
  const [bubbles, setBubbles] = useState([]);

  const startBubblesFlow = (text) => {
    // create simple bubble placeholders
    const count = 5;
    const arr = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i,
      text: '思考…',
      delay: i * 0.12,
      angle: Math.random() * Math.PI * 2,
      dist: 80 + Math.random() * 120,
    }));
    setBubbles(arr);
    setBubblesActive(true);

    // allow DOM 更新后找出刚发的 user 消息位置作为动画中心
    setTimeout(() => {
      try {
        const msgs = document.querySelectorAll('.chat-messages .message.user');
        const last = msgs[msgs.length - 1];
        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;
        if (last) {
          const r = last.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        }
        if (overlayRef.current) {
          overlayRef.current.style.setProperty('--origin-x', `${x}px`);
          overlayRef.current.style.setProperty('--origin-y', `${y}px`);
        }
      } catch (e) {
        // ignore
      }
    }, 80);

    // 10 秒后结束动画并恢复对话框
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      setBubblesActive(false);
      setBubbles([]);
      setVisible(true);
    }, 10000);
  };

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

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
      {/* AI 表情（跟隨對話情緒變化），若拍照模式中則隱藏 */}
      <div className="ai-face-outer" aria-hidden={!visible || videoOpen}>
        {!videoOpen && (
          <div
            className={`ai-face ${facePop ? 'pop' : ''} ${aiMood}`}
            ref={eyesRef}
            style={{ position: 'fixed', left: '22%', top: '50px' }}
          >
            <img
              src={xiaojinglin}
              alt="AI 表情"
              style={{ width: '96px', height: '96px', objectFit: 'cover', display: 'block' }}
            />
            <span className="expression" aria-hidden="true">{emoji}</span>
          </div>
        )}
      </div>
      {/* 泡泡动画覆盖层（发送消息时触发） */}
      <div className="bubbles-overlay" ref={overlayRef} aria-hidden={!bubblesActive} style={{ display: bubblesActive ? 'block' : 'none' }}>
        <div className="bubbles-container">
          {bubbles.map((b, i) => {
            const tx = Math.cos(b.angle) * b.dist;
            const ty = Math.sin(b.angle) * b.dist;
            const style = { '--tx': `${tx}px`, '--ty': `${ty}px`, left: 0, top: 0 };
            return (
              <div key={b.id} className={`bubble-agent ${bubblesActive ? 'show' : ''}`} style={style}>
                <div className="orb">
                  <img src={xiaojinglin} alt="agent" />
                </div>
                <div className="btext">{b.text}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
});

export default RightBlock;