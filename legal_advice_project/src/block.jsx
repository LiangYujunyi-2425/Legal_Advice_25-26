import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import './index.css';
import xiaojinglin from './assets/xiaojinglin.webp';
import judgeAvatar from './assets/judge.webp';
import lawyerAvatar from './assets/lawyer.webp';
import ownerAvatar from './assets/owner.webp';
import managerAvatar from './assets/property_manager.webp';
import leaseMessages from './data/leaseMessages';
import welcomeSound from './assets/welcome.mp3';
import { streamPredict } from './api/predictClient';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';


// 居中泡泡聊天（保留 API / 上傳 邏輯），帶 banner 波動與右側 AI 表情互動
const RightBlock = forwardRef(({ visible, setVisible, videoOpen, aiMood: propAiMood, setAiMood: propSetAiMood, voiceEnabled }, ref) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isIslandExpanded, setIsIslandExpanded] = useState(false);
  const [pendingPdfText, setPendingPdfText] = useState(null); // 待发送的 PDF 文本
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

      const { text, source } = detail;
      
      // 打開聊天窗口
      try { setVisible(true); } catch (e) {}

      // 将识别的文本作为用户消息自动发送
      console.log(`📄 从 ${source} 提取的文本，自动发送到聊天:`, text.substring(0, 100) + '...');
      
      // 存储待发送的文本
      setPendingPdfText(text);
    };

    window.addEventListener('pdf:textExtracted', handlePdfTextExtracted);
    return () => window.removeEventListener('pdf:textExtracted', handlePdfTextExtracted);
  }, [setVisible]);

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
          setInput(pendingPdfText);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      } catch (e) {
        console.error('自动发送 PDF 文本失败，已回退至输入框：', e);
        setInput(pendingPdfText);
        setTimeout(() => inputRef.current?.focus(), 100);
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

    // push user message and a placeholder assistant message which we'll update while streaming
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: 'AI團隊正在分析您的問題…' }]);
    setInput('');
    setAiMood('thinking');
    setSquash(true);
    setTimeout(() => setSquash(false), 160);


    // Stream from remote predict endpoint and update assistant message incrementally
    (async () => {
      try {
        let accumulated = '';
        // collect multi-agent messages locally so we can act on them when stream ends
        const multiAgentMessages = [];
        for await (const chunk of streamPredict(text, false)) {
          if (chunk && typeof chunk === 'object' && chunk.agent) {
            const agentName = chunk.agent || 'Agent';
            const outputText = chunk.output || '';

            // 建立 overlay message
            const m = {
              id: Date.now() + Math.random(),
              speaker: agentName,
              role: agentName,
              text: outputText,
              avatarKey: agentName.toLowerCase().includes('lawyer')
                ? 'lawyer'
                : agentName.toLowerCase().includes('prosecutor')
                ? 'judge'
                : 'xiaojinglin'
            };
            setOverlayMessagesState(prev => [...prev, m]);
            multiAgentMessages.push(m);

            setVisible(false);
            continue;
          }

          // 一般 assistant streaming
          let piece = typeof chunk === 'string' ? chunk : chunk?.output || JSON.stringify(chunk);
          accumulated += piece;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: accumulated };
            return copy;
          });
        }

        // finished streaming
        if (multiAgentMessages.length > 0) {
          const lastAgent = multiAgentMessages[multiAgentMessages.length - 1];
          const rawText = lastAgent.text || '';
          const label = lastAgent.speaker ? `[${lastAgent.speaker}] ` : '';
          setMessages(prev => [...prev, { role: 'assistant', content: `${label}${rawText}` }]);

          setOverlayMessagesState([]);
          setOverlayParticipants([]);
          setVisible(true);
        }

        // compute last paragraph from accumulated stream and append as a focused assistant message
        try {
          const normalized = (accumulated || '').replace(/\r\n/g, '\n');
          const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
          const lastPara = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : (normalized.trim() || '');
          if (lastPara) {
            setMessages(prev => [...prev, { role: 'assistant', content: lastPara }]);
          }
        } catch (e) {
          // ignore paragraph extraction errors
        }

        setAiMood('happy');
        setTimeout(() => setAiMood('neutral'), 900);
      } catch (err) {
        console.error('Predict stream error', err);
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `❌ 發生錯誤：${String(err)}` };
          return copy;
        });
        setAiMood('sad');
        setTimeout(() => setAiMood('neutral'), 1200);
      } finally {
        setSquash(false);
      }
    })();
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

    try {
      setAiMood('excited');
      // 注：后端 API 只有 /predict 端点，不支持 /analyze
      // 文件上传功能已在 Title.jsx 中通过 OCR 处理
      alert('合同分析功能已集成到 PDF/图片上传流程中。请通过左侧面板上传 PDF 或拍照。');
      setAiMood('neutral');
    } catch (error) {
      console.error('处理失败', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ 文件分析失敗，請稍後再試。' }
      ]);
      setAiMood('sad');
      setTimeout(() => setAiMood('neutral'), 1200);
    }
  };

  // ---------------- Camera Scanner (边框引导 + 边缘检测 + 防抖自动拍摄) ----------------
  // Camera scanner feature removed per request.

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
  const toggleTts = () => {
    setTtsEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('ttsEnabled', String(next)); } catch (e) {}
      return next;
    });
  };
  const ttsVoicesRef = useRef([]);
  const ttsVoiceRef = useRef(null);

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
      const v = ttsVoiceRef.current;
      if (v) u.voice = v;
      // ensure language hints; some voices require correct lang
      u.lang = (v && v.lang) ? v.lang : 'zh-HK';
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
      console.warn('TTS error', e);
    }
  };

  // 当有新的 assistant 消息时自动读出（粤语优先）
  useEffect(() => {
    if (!messages || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant' && last.content) {
      // small delay to avoid racing with animations
      setTimeout(() => speakText(last.content), 120);
    }
  }, [messages.length]);

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
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {msg.content}
                </ReactMarkdown>
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
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)',fontSize: '18px',fontWeight: 'bold' ,background: recognizing ? '#e74c3c' : undefined, color: recognizing ? '#fff' : undefined }}
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

            <button className='ai_txt_sendbutton' onClick={() => sendMessage()} >送出</button>

            {/* TTS 开关：默认开启，点击可关闭/开启并持久化 */}
            <button
              className='ai_txt_sendbutton'
              onClick={(e) => { e.stopPropagation(); toggleTts(); }}
              title={ttsEnabled ? '語音播報：開啟（點擊關閉）' : '語音播報：關閉（點擊開啟）'}
            >
              {ttsEnabled ? '🔊 語音開' : '🔇 語音關'}
            </button>


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
            style={{ position: 'fixed', left: '13%', top: '50px' }}
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
        <div className="roundtable-card">
          <div className="roundtable-agents" aria-hidden="false">
            {overlayParticipants.map((p, i) => {
              // position agents evenly around circle
              const spacing = 900; // 每個 agent 的水平間距
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

          <div className={`roundtable-center ${speakingAgentId ? 'agent-active' : ''}`} role="dialog" aria-label="圓桌會議">
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
                    <div className={`center-message`}>
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                        {m.text}
                      </ReactMarkdown>
                    </div>
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