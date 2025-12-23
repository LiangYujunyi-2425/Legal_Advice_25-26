import React, { useEffect, useState, useRef } from 'react';
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

export default function DebatePanel({ onClose, topic = '訂立遺囑' }) {
  const [speeches, setSpeeches] = useState(Array(participants.length).fill(''));
  const turnRef = useRef(0);
  const intervalRef = useRef(null);

  // a simple scripted conversation about wills (訂立遺囑)
  const script = [
    { speaker: 0, text: '訂立遺囑時，首先需確認立遺囑人的意思表示是否自由。' },
    { speaker: 1, text: '律師建議應確保遺囑內容清晰，指明受益人與遺產分配比例。' },
    { speaker: 2, text: '法學上要注意形式要件，例如見證人在場和簽署程序。' },
    { speaker: 3, text: '調解員會提醒家庭溝通，減少日後爭議的機會。' },
    { speaker: 1, text: '若有特殊贍養義務或公益捐贈，也應在遺囑中明確。' },
    { speaker: 0, text: '法院在處理遺囑爭議時會審查真實意思與可能的脅迫證據。' },
    { speaker: 2, text: '建議保存草稿與簽署時的錄音或證明，以資佐證。' },
    { speaker: 3, text: '若事前溝通不充分，調解可先行以降低訴訟成本。' },
    { speaker: 1, text: '最後，最好由專業人士審閱遺囑以確保合法有效。' },
  ];

  useEffect(() => {
    // start cycling through script
    const advance = () => {
      const idx = turnRef.current % script.length;
      const item = script[idx];
      const newSpeeches = Array(participants.length).fill('');
      newSpeeches[item.speaker] = item.text;
      setSpeeches(newSpeeches);
      turnRef.current += 1;
    };

    // immediately show first
    advance();
    intervalRef.current = setInterval(advance, 2200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [topic]);

  return (
    <div className="debate-overlay" role="dialog" aria-label="模擬討論">
      <div className="debate-card">
        {participants.map((p, i) => (
          <div key={p.key} className={`debate-agent agent-${i} ${speeches[i] ? 'speaking' : ''}`}>
            <div className="avatar-wrap">
              <img src={p.src} alt={p.name} />
            </div>
            <div className="agent-name">{p.name}</div>
            <div className="speech">
              <div className="speech-bubble">{speeches[i] || ''}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="debate-close" onClick={() => onClose?.()}>關閉討論</button>
    </div>
  );
}
