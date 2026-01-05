import React, { useState, useEffect } from 'react';
import './index.css';
import snowhill from './assets/snowhill.jpg';

export default function BackgroundSwitcher() {
  const options = [
    { id: 'default', label: '默認' },
    { id: 'gradient', label: '漸變' },
    { id: 'image', label: '圖案' }
  ];

  const [active, setActive] = useState('default');

  useEffect(() => {
    // 清理以前的样式
    document.body.classList.remove('bg-default', 'bg-gradient', 'bg-image');
    document.body.style.backgroundImage = '';
    document.body.style.background = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundSize = '';

    if (active === 'default') {
      // 恢复透明以显示页面视频背景
      document.body.style.background = 'transparent';
    } else if (active === 'gradient') {
      document.body.style.background = 'linear-gradient(135deg, #001e1d 0%, #003b3b 50%, #006d77 100%)';
    } else if (active === 'image') {
      // 使用通过 Vite 打包的导入图片（相对路径由打包器处理）
      document.body.style.backgroundImage = `url(${snowhill})`;
      document.body.style.backgroundPosition = 'center center';
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
    }
    // 清理函数不做额外事
    return () => {};
  }, [active]);

  return (
    <div className="bg-switcher" role="group" aria-label="背景切换">
      {options.map(opt => (
        <button
          key={opt.id}
          className={`banner-btn ${active === opt.id ? 'active' : ''}`}
          onClick={() => setActive(opt.id)}
          aria-pressed={active === opt.id}
          title={`切换到 ${opt.label} 背景`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
