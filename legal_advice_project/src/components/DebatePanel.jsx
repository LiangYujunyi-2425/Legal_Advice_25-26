import React, { useEffect } from 'react';
import judgeAvatar from '../assets/judge.webp';
import lawyerAvatar from '../assets/lawyer.webp';
import ownerAvatar from '../assets/owner.webp';
import managerAvatar from '../assets/property_manager.webp';

const participants = [
  { key: 'judge', name: '法官', src: judgeAvatar },
  { key: 'lawyer', name: '律師', src: lawyerAvatar },
  { key: 'prof', name: '法學教授', src: ownerAvatar },
  { key: 'mediator', name: '調解員', src: managerAvatar },
];

export default function DebatePanel({ onClose }) {
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div className="debate-overlay" role="dialog" aria-label="模擬討論">
      <div className="debate-card">
        {participants.map((p, i) => (
          <div key={p.key} className={`debate-agent agent-${i}`}>
            <div className="avatar-wrap">
              <img src={p.src} alt={p.name} />
            </div>
            <div className="agent-name">{p.name}</div>
            <div className="speech">
              <div className="speech-bubble">{i === 0 ? '這條款可能…' : i === 1 ? '反對，因為…' : i === 2 ? '從法理上看…' : '我們可以調解…'}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="debate-close" onClick={() => onClose?.()}>關閉討論</button>
    </div>
  );
}
