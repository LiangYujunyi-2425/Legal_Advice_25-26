import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';
import xiaojinglin from './assets/xiaojinglin.webp';
import judgeAvatar from './assets/judge.webp';
import lawyerAvatar from './assets/lawyer.webp';
import ownerAvatar from './assets/owner.webp';
import managerAvatar from './assets/property_manager.webp';
import welcomeSound from './assets/welcome.mp3';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import SuggestionBar from './components/SuggestionBar';
import { useSuggestions } from './hooks/useSuggestions';
import AiMessage from './components/AiMessage';
import DebatePanel from './components/DebatePanel';
import './components/DebatePanel.css';


// 居中泡泡聊天（保留 API / 上傳 邏輯），帶 banner 波動與右側 AI 表情互動
const RightBlock = forwardRef(({ visible, setVisible, videoOpen, aiMood: propAiMood, setAiMood: propSetAiMood, voiceEnabled }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const [pendingPdfText, setPendingPdfText] = useState(null); // 待发送的 PDF 文本
  const [showDebate, setShowDebate] = useState(false);
  const [overlayMessagesState] = useState([]);
  const [overlayParticipants] = useState([]);
  const [speakingAgentId] = useState(null);
  const [overlayActive] = useState(false);
  const [squash, setSquash] = useState(false);
  const [aiMoodLocal, setAiMoodLocal] = useState('neutral'); // fallback local mood
  const [facePop, setFacePop] = useState(false);
  const [welcomeAudioAllowed, setWelcomeAudioAllowed] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [selectedLang, setSelectedLang] = useState('yue-HK');
  
  const aiMood = propAiMood || aiMoodLocal;
  const setAiMood = propSetAiMood || setAiMoodLocal;
  const eyesRef = useRef(null);
  const overlayScrollRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const debateTimerRef = useRef(null);
  const welcomeAudioRef = useRef(null);
  const recognitionRef = useRef(null);
  const supportsSpeech = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

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

  const [sessionId] = useState(() => {
    try {
      let id = localStorage.getItem('la_session_id');
      if (!id) {
        id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem('la_session_id', id);
      }
      return id;
    } catch (e) { return 's_default'; }
  });

  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    addMessage(role, content) {
      setMessages(prev => [...prev, { role, content }]);
    }
  }));

  // try auto-playing welcome audio on mount; if blocked, show a small play button
  useEffect(() => {
    const a = new Audio(welcomeSound);
    a.preload = 'auto';
    welcomeAudioRef.current = a;

    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => setWelcomeAudioAllowed(true))
      .catch(err => {
        setWelcomeAudioAllowed(false);
        setWelcomeAudioError(err?.message || 'blocked');
      });
    }

    return () => {
      a.pause();
      welcomeAudioRef.current = null;
    };
  }, []);

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

  // 監聽 OCR 分析結果事件
  useEffect(() => {
    const handleOcrAnalysis = (event) => {
      const data = event.detail;
      if (!data) return;

      // 如果有 OCR 文本，先顯示識別結果
      if (data.ocr_text) {
        const ocrMessage = `🔍 識別的文本：\n${data.ocr_text}`;
        setMessages(prev => [...prev, { role: 'assistant', content: ocrMessage }]);
      }

      // 顯示 AI 分析結果
      if (data.summary) {
        const analysisMessage = `📋 分析結果：\n${data.summary}`;
        setMessages(prev => [...prev, { role: 'assistant', content: analysisMessage }]);
      }

      // 如果有風險提示
      if (data.risks && data.risks.length > 0) {
        const riskMessage = `⚠️ 潛在風險：\n${data.risks.join('\n')}`;
        setMessages(prev => [...prev, { role: 'assistant', content: riskMessage }]);
      }

      // 打開聊天窗口以顯示結果
      try { setVisible(true); } catch (e) {}
    };

    window.addEventListener('ocr:analysisResult', handleOcrAnalysis);
    return () => window.removeEventListener('ocr:analysisResult', handleOcrAnalysis);
  }, [setVisible]);

  // 監聽 PDF 文本提取事件 - 将识别的文本直接添加到聊天框
  useEffect(() => {
    const handlePdfTextExtracted = (event) => {
      const { detail } = event;
      if (!detail || !detail.text) return;

      const { text} = detail;
      
      // 打開聊天窗口
      try { setVisible(true); } catch (e) {}
      
      // 存储待发送的文本
      setPendingPdfText(text);
    };

    window.addEventListener('pdf:textExtracted', handlePdfTextExtracted);
    return () => window.removeEventListener('pdf:textExtracted', handlePdfTextExtracted); 
  }, []);

  // 处理待发送的 PDF 文本 - 在 sendMessage 定义后自动发送
  useEffect(() => {
    if (!pendingPdfText) return;

    // 延迟确保 UI 已更新，再尝试自动发送
    const timer = setTimeout(async () => {
      try {
        // 优先直接调用 sendMessage 自动发送到 AI
        if (typeof sendMessage === 'function') {
          await sendMessage(pendingPdfText);
        } else {
          // 回退：把文本填入输入框以便手动发送
        }
      } catch (e) {
      } finally {
        setPendingPdfText(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [pendingPdfText]);

  // auto-scroll main chat to latest message
  useEffect(() => {
    try {
      const el = chatMessagesRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (e) {
      // ignore
    }
  }, [messages.length]);

  const sendMessage = async (textArg) => {
    const text = (typeof textArg === 'string' ? textArg : input).trim();
    if (!text) return;

    // push user message and placeholder assistant message
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '智律助手正在分析你的問題…' }]);

    setInput('');
    setAiMood('thinking');
    setSquash(true);
    setTimeout(() => setSquash(false), 160);

    // 顯示模擬討論動畫（短暫）
    try {
      setShowDebate(true);
      if (debateTimerRef.current) clearTimeout(debateTimerRef.current);
      debateTimerRef.current = setTimeout(() => setShowDebate(false), 8000);
    } catch (e) { }

    // 呼叫 Cloud Run API，而不是本地 cache
    try {
      const resp = await fetch("https://guideagent-926721049029.us-central1.run.app/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_question: text
        })
      });
      const data = await resp.json();

      // 更新最後一個 assistant message
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: data.answer || '抱歉，AI沒有回覆' };
        return copy;
      });

      setAiMood('neutral');
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `伺服器暫時無法回應，請稍後再試` };
        return copy;
      });
      setAiMood('sad');
      setTimeout(() => setAiMood('neutral'), 1200);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setAiMood('excited');
      // 注：后端 API 只有 /predict 端点，不支持 /analyze
      // 文件上传功能已在 Title.jsx 中通过 OCR 处理
      alert('合同分析功能已集成到 PDF/图片上传流程中。请通过左侧面板上传 PDF 或拍照。');
      setAiMood('neutral');
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ 文件分析失敗，請稍後再試。' }
      ]);
      setAiMood('sad');
      setTimeout(() => setAiMood('neutral'), 1200);
    }
  };

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
          setTimeout(() => sendMessage(combined));
        } else {
          const combined = (input ? input + ' ' : '') + interim;
          setInput(combined);
        }
      } catch (e) {
      }
    };

    rec.onerror = (e) => {
      setRecognizing(false);
    };

    rec.onend = () => {
      setRecognizing(false);
    };

    recognitionRef.current = rec;
    return () => {
      try { recognitionRef.current?.abort(); } catch (e) {}
      recognitionRef.current = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort?.();
    };
  }, [selectedLang]);

  const startRecognition = () => {
    if (!supportsSpeech) {
      setWelcomeAudioError('語音辨識不支援於此瀏覽器');
      return;
    };
    if (recognizing) return;

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

  // 当中央泡泡（visible）打开时，且使用者已开启智能語音輔助（voiceEnabled）才会自动启动语音识别；关闭或关闭语音辅助时停止。
  // 注意：某些浏览器要求用户手势才能开启麦克风访问，若被浏览器阻止，用户需手动点击语音按钮。
  useEffect(() => {
    if (visible && voiceEnabled) {
      try { startRecognition(); } catch (e) { /* ignore */ }
    } else {
      try { stopRecognition(); } catch (e) { /* ignore */ }
    }
  }, [visible, voiceEnabled]);

  // --- Text-to-Speech: 用於讀出 assistant 回覆，優先選擇廣東話/HK 聲音 ---
  // 默认允许 TTS，但从 localStorage 读取用户偏好以便记住开关状态
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('ttsEnabled');
      return v === null ? true : v === 'true';
    } catch (e) {
      return true;
    }
  });
  const ttsVoicesRef = useRef([]);
  const ttsVoiceRef = useRef(null);
  const lastSpokenContentRef = useRef(''); // Track last spoken content to avoid duplicate speech on re-render

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      try {
        const vs = window.speechSynthesis.getVoices() || [];
        ttsVoicesRef.current = vs;
        // prefer voices that indicate Cantonese or Hong Kong
        const pref = vs.find(v => (v.lang && v.lang.toLowerCase().includes('yue')) || (v.lang && v.lang.toLowerCase().includes('hk')) || (v.name && v.name.toLowerCase().includes('canton')));
        const zhPref = vs.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
        ttsVoiceRef.current = pref || zhPref || vs[0] || null;
      } catch (e) {
        // ignore
      }
    };

    loadVoices();
    // some browsers load voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch (e) {} };
  }, []);

  const speakText = (text) => {
    if (!ttsEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;  
    try {
      // stop any ongoing recognition to avoid mic feedback during TTS
      try { stopRecognition(); } catch (e) { /* ignore */ }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);

      // select voice based on selectedLang preference
      const vs = ttsVoicesRef.current || [];
      const lc = (selectedLang || '').toLowerCase();
      let chosen = null;
      if (vs.length) {
        if (lc.includes('yue')) {
          chosen = vs.find(v => (v.lang && v.lang.toLowerCase().includes('yue')) || (v.lang && v.lang.toLowerCase().includes('hk')) || (v.name && v.name.toLowerCase().includes('canton')));
        } else if (lc.startsWith('zh')) {
          chosen = vs.find(v => v.lang && v.lang.toLowerCase().startsWith(lc)) || vs.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'));
        } else if (lc.startsWith('en')) {
          chosen = vs.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) || vs.find(v => v.name && v.name.toLowerCase().includes('english'));
        }
        if (!chosen) chosen = ttsVoiceRef.current || vs[0];
      } else {
        chosen = ttsVoiceRef.current;
      }

      if (chosen) u.voice = chosen;
      u.lang = (chosen && chosen.lang) ? chosen.lang : (lc.startsWith('en') ? 'en-US' : (lc.includes('yue') ? 'yue-HK' : (lc.startsWith('zh') ? selectedLang : 'zh-HK')));
      u.rate = 1;
      u.pitch = 1;
      u.onstart = () => { try { setAiMood('excited'); } catch (e) {} };
      u.onend = () => {
        try { setAiMood('neutral'); } catch (e) {}
        // After speech finished, attempt to restart recognition if supported
        try {
          if (supportsSpeech && visible) {
            // small delay to avoid racing with other UI updates
            setTimeout(() => {
              try { startRecognition(); } catch (e) { /* ignore start errors (may require user gesture) */ }
            }, 260);
          }
        } catch (e) { /* ignore */ }
      };
      u.onerror = () => { try { setAiMood('neutral'); } catch (e) {} };
      window.speechSynthesis.speak(u);
    } catch (e) {
      // ignore TTS errors
    }
  };

  // 当 assistant 消息内容改变时自动读出
  useEffect(() => {
    if (!messages || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.content) {
      // Only speak if content has changed (避免重复播報)
      if (last.content !== lastSpokenContentRef.current) {
        lastSpokenContentRef.current = last.content;
        // small delay to avoid racing with animations
        setTimeout(() => speakText(last.content), 120);
      }
    }
  }, [messages]); // Monitor entire messages array to catch content changes


  // 监听全局语音命令事件（由 useVoiceCommands 发出）
  useEffect(() => {
    const onOpenUpload = (e) => {
      try {
        // 确保中央泡泡打开并放大以便使用者看到上传区域
        try { setVisible(true); } catch (err) {}
        try { setIsIslandExpanded(true); } catch (err) {}
        // 等待短暫時間讓 DOM 更新並聚焦，再觸發檔案輸入
        setTimeout(() => {
          try {
            const inp = document.getElementById('rb-file-input') || document.querySelector('.file-input');
            if (inp) inp.click();
          } catch (e) { /* ignore */ }
        }, 140);
      } catch (err) { /* ignore */ }
    };
    const onOpenAi = (e) => {
      try {
        setVisible(true);
        // focus input when opening
        setTimeout(() => {
          const el = document.querySelector('.chat-input input[type="text"]');
          if (el) el.focus();
        }, 120);
      } catch (err) { /* ignore */ }
    };
    const onGoHome = (e) => { try { window.location.hash = '#/'; } catch (err) {} };

    window.addEventListener('voice:open-upload', onOpenUpload);
    window.addEventListener('voice:open-ai', onOpenAi);
    window.addEventListener('voice:go-home', onGoHome);
    return () => {
      window.removeEventListener('voice:open-upload', onOpenUpload);
      window.removeEventListener('voice:open-ai', onOpenAi);
      window.removeEventListener('voice:go-home', onGoHome);
    };
  }, [setVisible]);

  // compute suggestion list (rules-based fallback)
  const suggestions = useSuggestions({ messages, uploadedFiles: [], popular: ['法律備忘錄格式','起草一份簡短的法律意見書框架','生成辯護要點清單','檢查合同風險','列出重點','比較兩份合同差異'] });

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
          <div className="header-centualtxt">
            <div className="scroll-container">
              <div className="scroll-text">
                <span>多代理人對話系統已啟用，模擬律師、法官、當事人真實場景！</span>
                <span>上傳合約、遺囑或判決書，AI 即時分析法律重點，助你快速理解！</span>
                <span>點擊語音圖示，與法律 AI 助理對話，支援中文與英文雙語互動！</span>
                <span>本網站支援 PDF 自動識別與掃描文字分析，無需手動輸入！</span>
                <span>法律不再遙遠，AI 助你普法，讓每位市民都能輕鬆掌握法律知識。</span>
                <span>拖放你的文件，AI 即刻回覆法律建議，無需等待律師排期！</span>
                <span>本網站支援視障者語音操作，致力打造無障礙法律科技平台。</span>
              </div>
            </div>
          </div>
          <div className="header-right">
            {messages.length} 訊息
          </div>
        </div>

        <div className="chat-container">
          {/* 建議問題列：會根據會話/上傳內容顯示建議 */}
          <SuggestionBar
            suggestions={suggestions}
            onFill={(text) => { setInput(text); setTimeout(() => inputRef.current?.focus(), 80); }}
            onSend={(text) => sendMessage(text)}
          />
          <div className="chat-messages" ref={chatMessagesRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <AiMessage text={msg.content} speak={false} />
                ) : (
                    msg.content
                )}
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

            <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} aria-label="選擇語言" style={{ padding: 1, borderRadius: 6 }}>
              <option value="yue-HK">粵語 (yue-HK)</option>
              <option value="zh-HK">繁體中文-香港 (zh-HK)</option>
              <option value="zh-CN">普通话 (zh-CN)</option>
              <option value="en-US">English (en-US)</option>
            </select>

            <button
              className={`mic-button`}
              onClick={(e) => { e.preventDefault(); setTtsEnabled(prev => { const next = !prev; try { localStorage.setItem('ttsEnabled', String(next)); } catch (e) {} return next; }); }}
              title={ttsEnabled ? '語音播報: 開' : '語音播報: 關'}
              style={{ padding: '6px 10px', borderRadius: 8 }}
            >
              {ttsEnabled ? '語音播報🔊' : '語音播報🔈'}
            </button>

            <input
              className='txtinputplace'
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="問我有關合同或法律的問題..."
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(172, 169, 169, 0.08)' }}
            />

            <button className='ai_txt_sendbutton' onClick={() => sendMessage()} >送出</button>

            <label className="file-label" style={{ marginLeft: 4 }}>
              📎
              <input id="rb-file-input" className="file-input" type="file" accept="application/pdf" onChange={uploadFile} />
            </label>
          </div>
        </div>
      </div>
      {/* AI 表情（跟隨對話情緒變化），若拍照模式中則隱藏 */}
      {/* Camera Scanner removed */}
      <div className="ai-face-outer" aria-hidden={!visible || videoOpen}>
        {!videoOpen && (
          <div
            className={`ai-face ${facePop ? 'pop' : ''} ${aiMood}`}
            ref={eyesRef}
            style={{ position: 'fixed', left: '11%', top: '50px', zIndex: 1900 }}
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
          style={{ position: 'fixed', right: 18, top: 18, zIndex: 200 ,display:'none'}}
        >
          ▶︎ 播放歡迎語音
        </button>
      )}
      {/* 模擬法官/律師/教授/調解員討論動畫 */}
      {showDebate && (
        <DebatePanel onClose={() => { setShowDebate(false); if (debateTimerRef.current) clearTimeout(debateTimerRef.current); }} />
      )}
      {/* 圆桌会话 overlay（Round-table） */}
      <div className="roundtable-overlay" style={{ display: (overlayActive || overlayMessagesState.length) ? 'flex' : 'none' }} aria-hidden={!(overlayActive || overlayMessagesState.length)}>
        <div className="roundtable-card">
          <div className="roundtable-agents" aria-hidden="false">
            {overlayParticipants.map((p, i) => {
              // position agents evenly around circle
              // horizontal spacing for agent nodes — smaller so multiple agents fit on screen
              const spacing = 140; // 每個 agent 的水平間距（調整為合理數值）
              const startX = `calc(50% - ${(overlayParticipants.length - 1) * spacing / 2}px)`;
              const left = `calc(${startX} + ${i * spacing}px)`;
              const top = `60%`; // 固定在畫面中下方
              const isSpeaking = speakingAgentId === p.id;
              return (
                <div key={p.id} className={`agent-node ${isSpeaking ? 'agent-speaking' : ''} ${isSpeaking ? 'agent-stretch' : ''}`} style={{ left, top }}>
                  <img src={avatarMap[p.avatarKey] || xiaojinglin} alt={p.name} />
                  <div className="name">{p.name}</div>
                </div>
              );
            })}
          </div>

            <div className="center-text" ref={overlayScrollRef}>
              {overlayMessagesState.length === 0 ? (
                <div className={`rt-message msg-center placeholder`} style={{ marginBottom: 10 }}>
                  <div className={`rt-avatar`}>
                    <img src={xiaojinglin} alt={`AI`} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  </div>
                  <div className="rt-sender-floating">AI 團隊</div>
                  <div className={`rt-body`}>
                    <div className={`center-message`}>AI 團隊正在處理您的問題…</div>
                  </div>
                </div>
              ) : overlayMessagesState.map((m, mi) => (
                  <div key={m.id} className={`rt-message ${m.side === 'left' ? 'msg-left' : 'msg-right'}`} style={{ marginBottom: 10 }}>
                  <div className={`rt-avatar`}>
                    <img src={avatarMap[m.avatarKey] || xiaojinglin} alt={m.speaker} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  </div>
                  {/* floating sender name placed near avatar and animated per-side */}
                  <div className="rt-sender-floating">{m.speaker}</div>
                  <div className={`rt-body`}>
                    <div className={`center-message`}>
                      {m.role === 'assistant' ? (
                        <AiMessage text={m.text} speak={false} />
                      ) : (
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {m.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              )) }
            </div>
          </div>
        </div>

      {/* 泡泡动画覆盖层（发送消息时触发） */}
      {/* Mobile floating controls: language select + 查看討論 (rendered outside chat-input to avoid transform issues) */}
      <div className="mobile-floating-controls" aria-hidden={false}>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          aria-label="選擇語言"
          style={{ padding: 4, borderRadius: 8 }}
        >
          <option value="yue-HK">粵</option>
          <option value="zh-HK">繁</option>
          <option value="zh-CN">普</option>
          <option value="en-US">EN</option>
        </select>
      </div>
    </>
  );
});

export default RightBlock;