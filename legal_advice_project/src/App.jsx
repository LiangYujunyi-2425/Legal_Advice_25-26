import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import Title from './Title'
import IntroSprite from './IntroSprite'
//import './App.css'
//component名称需要大写
import RightBlock from './block'
import RightDecor from './RightDecor'



function App() {
  const [drawerVisible, setDrawerVisible] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
  {/* aria-live for screen readers (updated by RightBlock) */}
  {showIntro && <IntroSprite onClose={() => setShowIntro(false)} />}
      <div id="aria-live" className="sr-only" aria-live="polite" aria-atomic="true"></div>

  <RightBlock visible={drawerVisible} setVisible={setDrawerVisible} videoOpen={videoOpen} />

  {/* 视觉平衡的右侧装饰 */}
  <RightDecor />

      <div>
        <Title shrink={drawerVisible} videoOpen={videoOpen} setVideoOpen={setVideoOpen} />
      </div>

    </>
  )
}

export default App