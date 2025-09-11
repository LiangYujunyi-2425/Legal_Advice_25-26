import { useState } from 'react';
import './block.css';

export default function RightBlock() {
  const [visible, setVisible] = useState(false);
  const [hoveringZone, setHoveringZone] = useState(false);
  const [hoveringDrawer, setHoveringDrawer] = useState(false);

  // 檢查是否完全離開
  const checkLeave = () => {
    setTimeout(() => {
      if (!hoveringZone && !hoveringDrawer) {
        setVisible(false);
      }
    }, 100); // 延遲避免滑鼠快速移動造成閃爍
  };

  return (
    <>
      {/* 觸發區域 */}
      <div
        className="hover-zone"
        onMouseEnter={() => {
          setHoveringZone(true);
          setVisible(true);
        }}
        onMouseLeave={() => {
          setHoveringZone(false);
          setVisible(false);
        }}
      ></div>

      {/* 抽屜本體 */}
      <div
        className={`drawer ${visible ? 'open' : 'closed'}`}
        onMouseEnter={() => setHoveringDrawer(true)}
        onMouseLeave={() => {
          setHoveringDrawer(false);
          checkLeave();
        }}
      >
        <p>這是右邊抽屜內容</p>
      </div>
    </>
  );
}