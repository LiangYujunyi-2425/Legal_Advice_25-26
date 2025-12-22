import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

function AiMessage({ text, speak = true, lang = 'yue-HK' }) {
  const normalized = text.replace(/\\n/g, "\n"); // 把字面上的 \n 轉成換行

  useEffect(() => {
    if (!speak) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      // 取消正在播放的語音，播放最新回覆
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(normalized.replace(/#|\*\*|```/g, ''));
      utter.lang = lang;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // fail silently
      console.warn('speechSynthesis error', e);
    }
    // 不需要 cleanup，cancel 在下一次 effect 執行時會處理
  }, [normalized, speak, lang]);

  return (
    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
      {normalized}
    </ReactMarkdown>
  );
}

export default AiMessage;