import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';
import xiaojinglin from './assets/xiaojinglin.webp';
import judgeAvatar from './assets/judge.webp';
import lawyerAvatar from './assets/lawyer.webp';
import ownerAvatar from './assets/owner.webp';
import managerAvatar from './assets/property_manager.webp';
import leaseMessages from './data/leaseMessages';
import welcomeSound from './assets/welcome.mp3';

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
  const [welcomeAudioAllowed, setWelcomeAudioAllowed] = useState(false);
  const [welcomeAudioError, setWelcomeAudioError] = useState(null);
  const welcomeAudioRef = useRef(null);
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

  // try auto-playing welcome audio on mount; if blocked, show a small play button
  useEffect(() => {
    let mounted = true;
    try {
      // use imported module path (Vite will resolve to correct URL)
      const a = new Audio(welcomeSound);
      a.preload = 'auto';
      welcomeAudioRef.current = a;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          if (!mounted) return;
          setWelcomeAudioAllowed(true);
        }).catch((err) => {
          if (!mounted) return;
          // autoplay blocked by browser policy
          setWelcomeAudioAllowed(false);
          setWelcomeAudioError(err?.message || 'blocked');
        });
      }
    } catch (e) {
      setWelcomeAudioAllowed(false);
      setWelcomeAudioError(e?.message || 'err');
    }

    return () => {
      mounted = false;
      try { welcomeAudioRef.current?.pause(); welcomeAudioRef.current = null; } catch (e) {}
    };
  }, []);

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
        // add message entry with empty display text and alternating side (left/right)
        const side = (idx % 2 === 0) ? 'left' : 'right';
        setOverlayMessagesState(prev => [...prev, { id: m.id || Date.now() + idx, speaker: m.speakerName, role: m.role, text: '', avatarKey: m.avatarKey, side }]);
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

  const sendMessage = async (textArg) => {
    const text = (typeof textArg === 'string' ? textArg : input).trim();
    if (!text) return;
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

  // --- Web Speech API: 语音识别 (兼容 webkit) ---
  const [recognizing, setRecognizing] = useState(false);
  const [selectedLang, setSelectedLang] = useState('yue-HK'); // 默认粤语
  const recognitionRef = useRef(null);
  const supportsSpeech = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!supportsSpeech) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = selectedLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      try {
        let interim = '';
        let finalTrans = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const res = ev.results[i];
          const t = (res[0] && res[0].transcript) ? res[0].transcript : '';
          if (res.isFinal) finalTrans += t;
          else interim += t;
        }
        if (finalTrans) {
          const combined = (input ? input + ' ' : '') + finalTrans;
          setInput(combined);
          // small delay to ensure state update then send
          setTimeout(() => sendMessage(combined), 80);
        } else {
          const combined = (input ? input + ' ' : '') + interim;
          setInput(combined);
        }
      } catch (e) {
        console.warn('speech onresult error', e);
      }
    };

    rec.onerror = (e) => {
      console.warn('SpeechRecognition error', e);
      setRecognizing(false);
    };

    rec.onend = () => {
      setRecognizing(false);
    };

    recognitionRef.current = rec;
    return () => {
      try { recognitionRef.current?.abort(); } catch (e) {}
      recognitionRef.current = null;
    };
  }, [selectedLang]);

  const startRecognition = () => {
    if (!supportsSpeech) {
      setWelcomeAudioError('語音辨識不支援於此瀏覽器');
      return;
    }
    try {
      recognitionRef.current.lang = selectedLang;
      recognitionRef.current.start();
      setRecognizing(true);
    } catch (e) {
      // try to recover
      try { recognitionRef.current?.abort(); recognitionRef.current?.start(); setRecognizing(true); } catch (e2) { setWelcomeAudioError(e2?.message || String(e2)); }
    }
  };

  const stopRecognition = () => {
    try { recognitionRef.current?.stop(); } catch (e) {}
    setRecognizing(false);
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

          <div className="chat-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`mic-button ${recognizing ? 'recording' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); startRecognition(); }}
              onMouseUp={(e) => { e.preventDefault(); stopRecognition(); }}
              onTouchStart={(e) => { e.preventDefault(); startRecognition(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecognition(); }}
              onClick={(e) => { e.preventDefault(); if (!recognizing) startRecognition(); else stopRecognition(); }}
              title={supportsSpeech ? `按住說話 (或點擊開始/停止)。語言: ${selectedLang}` : '瀏覽器不支援語音辨識'}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: recognizing ? '#e74c3c' : undefined, color: recognizing ? '#fff' : undefined }}
            >
              {recognizing ? '● 錄音中…' : '🎤 語音'}
            </button>

            <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} aria-label="選擇語言" style={{ padding: 6, borderRadius: 6 }}>
              <option value="yue-HK">粤语 (yue-HK)</option>
              <option value="zh-HK">繁中-香港 (zh-HK)</option>
              <option value="zh-CN">普通话 (zh-CN)</option>
              <option value="en-US">English (en-US)</option>
            </select>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="問我有關合同或法律的問題..."
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}
            />

            <button onClick={() => sendMessage()} style={{ padding: '6px 10px', borderRadius: 8 }}>送出</button>

            <label className="file-label" style={{ marginLeft: 4 }}>
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
            style={{ position: 'fixed', left: '15%', top: '50px' }}
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
      {/* welcome 音頻手動播放按鈕（在 autoplay 被阻止時顯示） */}
      {!welcomeAudioAllowed && (
        <button
          className="welcome-play"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await welcomeAudioRef.current?.play();
              setWelcomeAudioAllowed(true);
              setWelcomeAudioError(null);
            } catch (err) {
              setWelcomeAudioError(err?.message || 'play failed');
            }
          }}
          style={{ position: 'fixed', right: 18, top: 18, zIndex: 200 }}
        >
          ▶︎ 播放歡迎語音
        </button>
      )}
      {/* 圆桌会话 overlay（Round-table） */}
      <div className="roundtable-overlay" style={{ display: overlayMessagesState.length ? 'flex' : 'none' }} aria-hidden={!overlayMessagesState.length}>
        <style>{`
          .roundtable-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 80; pointer-events: auto; }
          .roundtable-card {position: absolute; top: -50px;border-radius: 20%; background: rgba(255, 255, 255, 0.96); width: min(760px, 92%); max-height: 86vh; position: relative; display: flex; align-items: center; justify-content: center; }
          .center-title{border-radius: 20%; background: rgba(255, 255, 255, 0.96)}
          .roundtable-center {position: absolute;top: -340px;left: 7px;width: 790px; height: 745px; border-radius: 50%;  display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; }
          .roundtable-center .center-text {border-radius: 10%; background: rgba(200, 200, 200, 0.6); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); width: 80%; height: 80%; overflow:auto; padding:8px; text-align:left; }
          /* hide scrollbar but keep scroll functionality */
          .roundtable-center .center-text::-webkit-scrollbar { width: 0; height: 0; }
          .roundtable-center .center-text { -ms-overflow-style: none; scrollbar-width: none; }

          /* message layout and entrance animations */
          .rt-message { display:flex; align-items:flex-start; gap:8px; width:100%; max-width:720px; box-sizing:border-box; }
          .rt-avatar { width:40px; flex-shrink:0; }
          .rt-body { flex:1; display:flex; flex-direction:column; align-items:flex-start; }
          .rt-sender { font-size:12px; color:#333; margin-bottom:6px; }

          /* floating sender name near avatar */
          .rt-sender-floating { position: absolute; font-size:12px; color:#222; background: rgba(255,255,255,0.92); padding:4px 8px; border-radius:8px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); pointer-events: none; }
          .msg-left .rt-sender-floating { transform-origin:left center; left: 56px; top: -6px; animation: nameSlideLeft 420ms cubic-bezier(.2,.9,.2,1) both; }
          .msg-right .rt-sender-floating { transform-origin:right center; right: 56px; top: -6px; animation: nameSlideRight 420ms cubic-bezier(.2,.9,.2,1) both; }

          @keyframes nameSlideLeft { from { opacity:0; transform: translateX(-10px) scale(.98); } to { opacity:1; transform: translateX(0) scale(1); } }
          @keyframes nameSlideRight { from { opacity:0; transform: translateX(10px) scale(.98); } to { opacity:1; transform: translateX(0) scale(1); } }

          .center-message { background: rgba(250,250,250,0.9); padding:10px 12px; border-radius:12px; display:inline-block; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }

          /* left / right variants */
          .msg-left { justify-content:flex-start; transform-origin:left center; animation: slideInLeft 360ms cubic-bezier(.2,.9,.2,1) both; }
          .msg-right { justify-content:flex-end; flex-direction:row-reverse; transform-origin:right center; animation: slideInRight 360ms cubic-bezier(.2,.9,.2,1) both; }

          @keyframes slideInLeft { from { opacity:0; transform: translateX(-26px) scale(0.98); } to { opacity:1; transform: translateX(0) scale(1); } }
          @keyframes slideInRight { from { opacity:0; transform: translateX(26px) scale(0.98); } to { opacity:1; transform: translateX(0) scale(1); } }
          .roundtable-agents { position: absolute; inset: 0; pointer-events: none; }
          .agent-node { position: absolute; width: 84px; height: 84px; border-radius: 50%; display:flex; align-items:center; justify-content:center; transition: transform 300ms cubic-bezier(.2,.9,.2,1), box-shadow 300ms; pointer-events: auto; }
          .agent-node img { width: 64px; height:64px; border-radius:50%; object-fit:cover; }
          .agent-node .name { position: absolute; top: 92px; width: 120px; left: 50%; transform: translateX(-50%); text-align:center; font-size:12px; color:#222; }
          .agent-speaking { transform: scale(1.18) translateY(-6px);background: rgba(255, 255, 255, 0.15); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);backdrop-filter: blur(10px);-webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3);}
          .agent-stretch { transition: transform 420ms cubic-bezier(.2,.9,.2,1); transform: scaleX(1.22) scaleY(1.22); }
          .center-message { background: rgba(250,250,250,0.9); padding:10px 12px; border-radius:12px; display:inline-block; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
          .name{border-radius: 40%; background: rgba(206, 206, 206, 0.9); }
        `}</style>
        <div className="roundtable-card">
          <div className="roundtable-agents" aria-hidden="false">
            {overlayParticipants.map((p, i) => {
              // position agents evenly around circle
              const angle = (i / overlayParticipants.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 385;
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
              {overlayMessagesState.map((m, mi) => (
                <div key={m.id} className={`rt-message ${m.side === 'left' ? 'msg-left' : 'msg-right'}`} style={{ marginBottom: 10 }}>
                  <div className={`rt-avatar`}>
                    <img src={avatarMap[m.avatarKey] || xiaojinglin} alt={m.speaker} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  </div>
                  {/* floating sender name placed near avatar and animated per-side */}
                  <div className="rt-sender-floating">{m.speaker}</div>
                  <div className={`rt-body`}>
                    <div className={`center-message`}>{m.text}</div>
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