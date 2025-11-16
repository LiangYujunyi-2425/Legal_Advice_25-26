import { useEffect, useRef } from 'react';

// Minimal hook that listens for voice commands via Web Speech API and
// dispatches CustomEvents on window when a recognized command is matched.
// Usage: useVoiceCommands(enabled, { lang: 'yue-HK' })
export default function useVoiceCommands(enabled = false, opts = {}) {
  const recognitionRef = useRef(null);
  const forceStoppedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    // prefer Cantonese (yue-HK) when available; allow caller to override via opts.lang
    rec.lang = opts.lang || 'yue-HK';
    rec.interimResults = false;
    rec.continuous = true;

    const mapCommand = (text) => {
      if (!text) return null;
      const t = text.toLowerCase();

      // match phrases (add more as needed)
      // include Cantonese colloquial variants and traditional/simplified forms
      const openUploadPhrases = [
        '打開合同上傳', '打开合同上传', '打开上传', '上传合同', '上傳合同', '打開上傳',
        '開啟上傳', '幫我上傳合約', '幫我上傳合同'
      ];
      const openAIPhrases = [
        '啟動ai助手', '启动ai助手', '打开ai', '打开ai助手', '啟動助手', '启动助手',
        '開啟ai助手', '打開ai助手', '打開助手'
      ];
      const goHomePhrases = ['回到首頁', '回到首页', '回首頁', '返主頁', '返首頁'];

      // 新增：拍攝/相機相關語音指令
      const openCameraPhrases = [
        '打開拍攝功能', '打开拍摄功能', '打开拍摄', '打開拍攝', '打开相机', '打開相機', '打开拍照', '打開拍照', '開啟拍攝', '開啟相機'
      ];

      if (openUploadPhrases.some(p => t.includes(p))) return 'open-upload';
      if (openCameraPhrases.some(p => t.includes(p))) return 'open-camera';
      if (openAIPhrases.some(p => t.includes(p))) return 'open-ai';
      if (goHomePhrases.some(p => t.includes(p))) return 'go-home';
      return null;
    };

  rec.onresult = (ev) => {
      try {
        let final = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const res = ev.results[i];
          if (res.isFinal && res[0]) final += res[0].transcript || '';
        }
        if (final) {
          const cmd = mapCommand(final);
          if (cmd) {
            window.dispatchEvent(new CustomEvent('voice:' + cmd, { detail: { text: final } }));
          }
        }
      } catch (e) {
        // ignore
      }
    };

    rec.onstart = () => {
      try { window.dispatchEvent(new CustomEvent('voice:started')); } catch (e) {}
    };

    rec.onend = () => {
      try { window.dispatchEvent(new CustomEvent('voice:stopped')); } catch (e) {}
    };

    rec.onerror = (e) => {
      try { window.dispatchEvent(new CustomEvent('voice:error', { detail: e })); } catch (err) {}
    };

    // expose start/stop helpers so they can be invoked from a user gesture
    try {
      // attach small helpers to window for direct user-gesture start/stop
      window.startVoiceRecognition = () => {
        try { rec.start(); return true; } catch (e) { return false; }
      };
      window.stopVoiceRecognition = () => {
        try { rec.stop(); return true; } catch (e) { return false; }
      };
      window.voiceRecognitionSupported = true;
    } catch (e) {}

    recognitionRef.current = rec;

    if (enabled) {
      try { rec.start(); } catch (e) {}
    }

    return () => {
      try { recognitionRef.current?.stop(); recognitionRef.current = null; } catch (e) {}
    };
  }, []);

  // 支持通过全局事件强制启动/停止（用于确保按钮点击能可靠停止/启动识别）
  useEffect(() => {
    const onForceStop = () => {
      forceStoppedRef.current = true;
      try { recognitionRef.current?.stop(); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('voice:stopped')); } catch (e) {}
    };

    const onForceStart = () => {
      forceStoppedRef.current = false;
      try { recognitionRef.current?.start(); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('voice:started')); } catch (e) {}
    };

    window.addEventListener('voice:forceStop', onForceStop);
    window.addEventListener('voice:forceStart', onForceStart);
    return () => {
      window.removeEventListener('voice:forceStop', onForceStop);
      window.removeEventListener('voice:forceStart', onForceStart);
    };
  }, []);

  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    // 如果被強制停止，則不自動重啓
    if (forceStoppedRef.current) {
      try { rec.stop(); } catch (e) {}
      return;
    }

    if (enabled) {
      try { rec.start(); } catch (e) { /* ignore start errors */ }
    } else {
      try { rec.stop(); } catch (e) { /* ignore stop errors */ }
    }
  }, [enabled]);
}
