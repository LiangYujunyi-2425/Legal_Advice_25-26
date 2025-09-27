import { useState } from 'react';
import './index.css';


export default function RightBlock({ visible, setVisible }) {
  const [hoveringZone, setHoveringZone] = useState(false);
  const [hoveringDrawer, setHoveringDrawer] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const checkLeave = () => {
    setTimeout(() => {
      if (!hoveringZone && !hoveringDrawer) {
        setVisible(false);
      }
    }, 100);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('http://localhost:5000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });
      const data = await response.json();
      const aiMessage = { role: 'assistant', content: data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI 回覆失敗', error);
      const errorMessage = { role: 'assistant', content: '❌ 回覆失敗，請稍後再試。' };
      setMessages(prev => [...prev, errorMessage]);
    }
  };


  return (
    <>
      <div
        className="hover-zone"
        onMouseEnter={() => {
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
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="輸入訊息..."
          />
          <button onClick={sendMessage}>送出</button>
        </div>
      </div>
      </div>
    </>
  );
}


