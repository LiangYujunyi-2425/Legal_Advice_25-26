import { useState, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import Title from './Title'
import IntroSprite from './IntroSprite'
//import './App.css'
//component名称需要大写
import RightBlock from './block'
import RightDecor from './RightDecor'
import useVoiceCommands from './hooks/useVoiceCommands';



function App() {
  const [drawerVisible, setDrawerVisible] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const rightBlockRef = useState(null)[1]; // 用於傳遞分析結果給聊天窗口

  // start/stop global voice command listener (默认使用粤语 yue-HK)
  useVoiceCommands(voiceEnabled, { lang: 'yue-HK' });

  // 当语音触发打开拍摄功能时，使摄像头模块显示并关闭中央泡泡
  useEffect(() => {
    const onOpenCamera = () => {
      try { setVideoOpen(true); } catch (e) {}
      try { setDrawerVisible(false); } catch (e) {}
    };
    window.addEventListener('voice:open-camera', onOpenCamera);
    return () => window.removeEventListener('voice:open-camera', onOpenCamera);
  }, []);

  // 當 Title 元件返回分析結果時，轉發給 RightBlock
  const handleAnalysisResult = (data) => {
    setAnalysisResult(data);
    // 向聊天窗口發送事件
    window.dispatchEvent(new CustomEvent('ocr:analysisResult', { detail: data }));
  };

  return (
    <>
  {/* aria-live for screen readers (updated by RightBlock) */}
  {showIntro && <IntroSprite onClose={() => setShowIntro(false)} />}
      <div id="aria-live" className="sr-only" aria-live="polite" aria-atomic="true"></div>

  <RightBlock visible={drawerVisible} setVisible={setDrawerVisible} videoOpen={videoOpen} voiceEnabled={voiceEnabled} />

  {/* 视觉平衡的右侧装饰 */}
  <RightDecor />

      <div>
        <Title shrink={drawerVisible} videoOpen={videoOpen} setVideoOpen={setVideoOpen} onAnalysisResult={handleAnalysisResult} />
      </div>

      {/* 语音控制开关 (固定在右下角) */}
      <button
        onClick={() => {
          // prefer starting/stopping recognition from the actual click (user gesture)
          if (!voiceEnabled) {
            if (typeof window !== 'undefined' && window.startVoiceRecognition) {
              try { window.startVoiceRecognition(); } catch (e) {}
            }
            setVoiceEnabled(true);
          } else {
            if (typeof window !== 'undefined' && window.stopVoiceRecognition) {
              try { window.stopVoiceRecognition(); } catch (e) {}
            }
            setVoiceEnabled(false);
          }
        }}
        aria-pressed={voiceEnabled}
        title="切換語音控制"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 240,
          padding: '8px 12px',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.12)',
          background: voiceEnabled ? '#dfb632ff' : '#4ade80',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)'
        }}
      >
        {voiceEnabled ? '智能語音辅助' : '关闭語音辅助'}
      </button>

    </>
  )
}

export default App