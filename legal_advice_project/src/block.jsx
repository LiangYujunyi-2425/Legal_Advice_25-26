import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';
import xiaojinglin from './assets/xiaojinglin.webp';
import judgeAvatar from './assets/judge.webp';
import lawyerAvatar from './assets/lawyer.webp';
import ownerAvatar from './assets/owner.webp';
import managerAvatar from './assets/property_manager.webp';
import leaseMessages from './data/leaseMessages';

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
  const overlayScrollRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const bubbleTimerRef = useRef(null);
  const playTimersRef = useRef([]);
  const [overlayMessagesState, setOverlayMessagesState] = useState([]);

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

  // compose a concrete final reply based on the conversation (simple template)
  const composeFinalReply = (conversation) => {
    const lines = [];
    lines.push('基於剛才四方的討論，給你一份具體且可執行的建議：');
    lines.push('1) 租期與租金：在合約寫明租期起訖日、租金金額、繳付日期與逾期利息。');
    lines.push('2) 押金：建議押金為兩個月租金，並約定業主在確認物業無損後於十個工作日內退還（可扣除合理維修費）。');
    lines.push('3) 入伙/點交：合約應附入伙點交表（Inventory & Condition Report），雙方簽名並拍照存證。');
    lines.push('4) 修繕責任：明確區分重大結構性維修（業主負責）與日常小修（租客負責）。');
    lines.push('5) 轉租/改裝/養寵物：若允許需在合約列明條件、押金或恢復原狀責任。');
    lines.push('6) 提前終止與違約：列明嚴重違約情形（如連續拖欠租金兩個月）、寬限期（例如14天）與賠償機制。');
    lines.push('7) 爭議解決：先行協商/調解，並約定香港法院管轄或仲裁條款以加速處理。');
    lines.push('8) 保存證據：保留簽署合約原件、點交表、所有收據與通訊記錄。');
    lines.push('如需，我可以把上述要點轉成合約可用的條款範本，或以繁體/英文輸出。');
    return lines.join('\n');
  };

  // play conversation into the center overlay (自动触发于 sendMessage)
  const playConversation = (conversation = leaseMessages, speed = 900) => {
    // clear existing timers
    playTimersRef.current.forEach(t => clearTimeout(t));
    playTimersRef.current = [];
    setOverlayMessagesState([]);
    setAiMood('thinking');

    // hide/缩小中央泡泡以呈现中间对话
    setVisible(false);

    conversation.messages.forEach((m, idx) => {
      const t = setTimeout(() => {
        // trigger flying bubble agents for visual effect
        if (['lawyer','judge','property_manager','owner'].includes(m.role)) {
          startBubblesFlow(m.text);
        }
  setOverlayMessagesState(prev => [...prev, { id: m.id, speaker: m.speakerName, role: m.role, text: m.text, avatarKey: m.avatarKey }]);
        setAiMood(idx % 2 === 0 ? 'thinking' : 'happy');
        setTimeout(() => setAiMood('neutral'), 700);
      }, idx * speed);
      playTimersRef.current.push(t);
    });

    // restore central bubble after conversation finished
    const total = conversation.messages.length * speed;
    const endT = setTimeout(() => {
      setAiMood('neutral');
      setOverlayMessagesState([]);
      // compose and append final concrete reply into central messages
      try {
        const finalReply = composeFinalReply(conversation);
        setMessages(prev => [...prev, { role: 'assistant', content: finalReply }]);
      } catch (e) {
        // fallback simple reply
        setMessages(prev => [...prev, { role: 'assistant', content: '已完成討論，請參考上方要點。' }]);
      }
      setVisible(true);
      playTimersRef.current = [];
    }, total + 800);
    playTimersRef.current.push(endT);
  };

  const avatarMap = {
    judge: judgeAvatar,
    lawyer: lawyerAvatar,
    owner: ownerAvatar,
    manager: managerAvatar,
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

  // auto-scroll main chat to latest message
  useEffect(() => {
    try {
      const el = chatMessagesRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (e) {
      // ignore
    }
  }, [messages.length]);

  // auto-scroll overlay chat to latest message
  useEffect(() => {
    try {
      const el = overlayScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (e) {
      // ignore
    }
  }, [overlayMessagesState.length]);

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
    // play built-in conversation sequence centered on screen
    // for now, use full leaseMessages as demonstration; later can send to API to generate dynamic replies
    startBubblesFlow(text);
    playConversation(leaseMessages);
  };

  // Start bubble animation flow: create bubbles, position origin near latest user message,
  // keep them animating for 10s, then dismiss and re-open the dialog.
  const [bubblesActive, setBubblesActive] = useState(false);
  const [bubbles, setBubbles] = useState([]);

  const startBubblesFlow = (text) => {
    // create simple bubble placeholders
    const count = 5;
    const avatarKeys = Object.keys(avatarMap);
    const arr = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i,
      text: '思考…',
      delay: i * 0.12,
      angle: Math.random() * Math.PI * 2,
      dist: 80 + Math.random() * 120,
      avatarKey: avatarKeys[Math.floor(Math.random() * avatarKeys.length)],
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

  // cleanup play timers on unmount
  useEffect(() => {
    return () => {
      playTimersRef.current.forEach(t => clearTimeout(t));
      playTimersRef.current = [];
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
          <div className="header-right">
            {messages.length} 訊息
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-messages" ref={chatMessagesRef}>
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
      {/* 中央对话 overlay（WeChat 风格） */}
      <div className={`center-overlay-chat`} style={{ display: overlayMessagesState.length ? 'flex' : 'none' }} aria-hidden={!overlayMessagesState.length}>
        <div className="chat-card">
          <div className="chat-card-header">法律精靈四方會議</div>
          <div className="chat-card-messages" ref={overlayScrollRef}>
            {overlayMessagesState.map((m, i) => (
              <div key={m.id} className={`overlay-message ${m.role === 'user' ? 'user' : 'agent'}`}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <img src={avatarMap[m.avatarKey] || xiaojinglin} alt={m.speaker} style={{ width: 36, height: 36, borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div className="overlay-sender">{m.speaker}</div>
                    <div className="overlay-text" style={{ animationDelay: `${i * 120}ms` }}>{m.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                    <img src={avatarMap[b.avatarKey] || xiaojinglin} alt="agent" />
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