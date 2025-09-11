import { useState } from 'react';
import './block.css';


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
        <p>這是右邊抽屜內容</p>
      </div>
    </>
  );
}


