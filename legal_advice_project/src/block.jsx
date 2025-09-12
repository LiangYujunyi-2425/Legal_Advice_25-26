import { useState } from 'react';
import './index.css';


export default function RightBlock({ visible, setVisible }) {
  const [hoveringZone, setHoveringZone] = useState(false);
  const [hoveringDrawer, setHoveringDrawer] = useState(false);

  const checkLeave = () => {
    setTimeout(() => {
      if (!hoveringZone && !hoveringDrawer) {
        setVisible(false);
      }
    }, 100);
  };

  return (
    <>
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

      <div
        className={`drawer ${visible ? 'open' : 'closed'}`}
        onMouseEnter={() => setHoveringDrawer(true)}
        onMouseLeave={() => {
          setHoveringDrawer(false);
          checkLeave();
        }}
      >
        <p>深入解讀AI對話欄//信息框</p>
      </div>
    </>
  );
}


