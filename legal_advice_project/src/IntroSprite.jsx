import React, { useEffect, useState } from 'react';
import spriteImg from './assets/xiaojinglin.webp';

export default function IntroSprite({ onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 5000); // auto-hide after 5s
    return () => clearTimeout(t);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="intro-overlay" role="dialog" aria-label="開場小精靈提示">
      <div className="intro-sprite" onClick={() => { setVisible(false); if (onClose) onClose(); }}>
        <img src={spriteImg} alt="小精靈" className="sprite-img" />
        <div className="sprite-message">你好，我是你的最強的法律助手，智律小精靈！快來問我問題吧！</div>
      </div>
    </div>
  );
}
