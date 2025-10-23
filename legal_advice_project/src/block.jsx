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
  const [overlayParticipants, setOverlayParticipants] = useState([]);
  const [speakingAgentId, setSpeakingAgentId] = useState(null);

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
    // clear existing timers/intervals
    playTimersRef.current.forEach(t => clearTimeout(t));
    playTimersRef.current = [];
    setOverlayMessagesState([]);
    setAiMood('thinking');

    // hide/缩小中央泡泡以呈现中间对话（圆桌）
    setVisible(false);

    // build participants from conversation (unique speakers)
    const parts = [];
    const seen = new Set();
    conversation.messages.forEach(m => {
      const key = (m.avatarKey || m.role || m.speakerName || 'guest') + '::' + (m.speakerName || '');
      if (!seen.has(key)) {
        seen.add(key);
        parts.push({ id: Date.now() + Math.random(), avatarKey: m.avatarKey || m.role || 'lawyer', name: m.speakerName || m.role });
      }
    });
    setOverlayParticipants(parts);

    // helper: type one message char-by-char and animate speaker
    const typeMessage = (m, idx, perChar = 28) => {
      return new Promise((resolve) => {
        // add message entry with empty display text
        setOverlayMessagesState(prev => [...prev, { id: m.id || Date.now() + idx, speaker: m.speakerName, role: m.role, text: '', avatarKey: m.avatarKey }]);
        // find participant id to map speaking animation
        const p = parts.find(p => (p.avatarKey === m.avatarKey) || (p.name === m.speakerName));
        const speakingId = p?.id || null;
        if (speakingId) setSpeakingAgentId(speakingId);

        // optionally trigger bubbles flow for certain roles
        if (['lawyer','judge','property_manager','owner'].includes(m.role)) {
          startBubblesFlow(m.text);
        }

        // gradually append characters
        const chars = Array.from(m.text || '');
        chars.forEach((ch, ci) => {
          const t = setTimeout(() => {
            setOverlayMessagesState(prev => {
              const copy = [...prev];
              const idxIn = copy.findIndex(x => x.id === (m.id || Date.now() + idx));
              if (idxIn !== -1) {
                copy[idxIn] = { ...copy[idxIn], text: copy[idxIn].text + ch };
              }
              return copy;
            });
            // small mood flicker
            setAiMood(ci % 2 === 0 ? 'thinking' : 'happy');
            // keep speaking animation active during typing
          }, ci * perChar);
          playTimersRef.current.push(t);
        });

        // finish after all chars
        const finishT = setTimeout(() => {
          setSpeakingAgentId(null);
          setAiMood('neutral');
          resolve();
        }, (chars.length * perChar) + 120);
        playTimersRef.current.push(finishT);
      });
    };

    // play messages sequentially
    (async () => {
      for (let i = 0; i < conversation.messages.length; i++) {
        const m = conversation.messages[i];
        try {
          await typeMessage(m, i, Math.max(20, Math.floor(speed / 30)));
        } catch (e) {
          // continue on error
        }
        // small pause between messages
        const pauseT = setTimeout(() => {}, 220);
        playTimersRef.current.push(pauseT);
        await new Promise(res => setTimeout(res, 220));
      }

      // done: compose final reply and restore
      setAiMood('neutral');
      const finalReply = (() => {
        try { return composeFinalReply(conversation); } catch { return '已完成討論，請參考上方要點。'; }
      })();
      setMessages(prev => [...prev, { role: 'assistant', content: finalReply }]);
      // short delay then restore central bubble
      const endDelay = setTimeout(() => {
        setOverlayMessagesState([]);
        setOverlayParticipants([]);
        setVisible(true);
        playTimersRef.current = [];
      }, 800);
      playTimersRef.current.push(endDelay);
    })();
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
      {/* 圆桌会话 overlay（Round-table） */}
      <div className="roundtable-overlay" style={{ display: overlayMessagesState.length ? 'flex' : 'none' }} aria-hidden={!overlayMessagesState.length}>
        <style>{`
          .roundtable-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 80; pointer-events: auto; }
          .roundtable-card {position: absolute; top: -50px;border-radius: 20%; background: rgba(255, 255, 255, 0.96); width: min(760px, 92%); max-height: 86vh; position: relative; display: flex; align-items: center; justify-content: center; }
          .center-title{border-radius: 20%; background: rgba(255, 255, 255, 0.96)}
          .roundtable-center {position: absolute;top: -320px;left: 50px;width: 700px; height: 700px; border-radius: 50%;  display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; }
          .roundtable-center .center-text {border-radius: 10%; background: rgba(255, 255, 255, 0.96);box-shadow: 0 10px 40px rgba(0,0,0,0.18); width: 80%; height: 80%; overflow:auto; padding:8px; text-align:left; }
          .roundtable-agents { position: absolute; inset: 0; pointer-events: none; }
          .agent-node { position: absolute; width: 84px; height: 84px; border-radius: 50%; display:flex; align-items:center; justify-content:center; transition: transform 300ms cubic-bezier(.2,.9,.2,1), box-shadow 300ms; pointer-events: auto; }
          .agent-node img { width: 64px; height:64px; border-radius:50%; object-fit:cover; }
          .agent-node .name { position: absolute; top: 92px; width: 120px; left: 50%; transform: translateX(-50%); text-align:center; font-size:12px; color:#222; }
          .agent-speaking { transform: scale(1.18) translateY(-6px); box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
          .agent-stretch { transition: transform 420ms cubic-bezier(.2,.9,.2,1); transform: scaleX(1.22) scaleY(1.02); }
          .center-message { background: rgba(250,250,250,0.9); padding:10px 12px; border-radius:12px; display:inline-block; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
        `}</style>
        <div className="roundtable-card">
          <div className="roundtable-agents" aria-hidden="false">
            {overlayParticipants.map((p, i) => {
              // position agents evenly around circle
              const angle = (i / overlayParticipants.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 360;
              const left = `calc(50% + ${Math.cos(angle) * radius}px)`;
              const top = `calc(50% + ${Math.sin(angle) * radius}px)`;
              const isSpeaking = speakingAgentId === p.id;
              return (
                <div key={p.id} className={`agent-node ${isSpeaking ? 'agent-speaking' : ''} ${isSpeaking ? 'agent-stretch' : ''}`} style={{ left, top }}>
                  <img src={avatarMap[p.avatarKey] || xiaojinglin} alt={p.name} />
                  <div className="name">{p.name}</div>
                </div>
              );
            })}
          </div>

          <div className="roundtable-center" role="dialog" aria-label="圓桌會議">
            <div className="center-title">法律精靈圓桌會議</div>
            <div className="center-text" ref={overlayScrollRef}>
              {overlayMessagesState.map((m) => (
                <div key={m.id} style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, flexShrink: 0 }}>
                    <img src={avatarMap[m.avatarKey] || xiaojinglin} alt={m.speaker} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>{m.speaker}</div>
                    <div className="center-message">{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
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