import { useState, forwardRef, useImperativeHandle } from 'react';
import './index.css';

const RightBlock = forwardRef(({ visible, setVisible }, ref) => {
  const [hoveringDrawer, setHoveringDrawer] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const API_URL = import.meta.env.VITE_API_URL

  // ✅ 暴露方法給父層
  useImperativeHandle(ref, () => ({
    addMessage(role, content) {
      setMessages(prev => [...prev, { role, content }]);
    }
  }));

  const toggleDrawer = () => {
    setVisible(prev => !prev);
  };

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
      const response = await fetch(`${API_URL}/ask`, {
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
  const uploadFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      // 把 AI 分析結果顯示在對話框
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `📄 合同分析完成：\n\n摘要：${data.summary}\n\n風險：${data.risks.join("、")}` }
        ]);
      } catch (error) {
        console.error("上傳失敗", error);
        setMessages(prev => [
        ...prev,
        { role: "assistant", content: "❌ 文件分析失敗，請稍後再試。" }
      ]);
    }
  };

  return (
    <>
      <div className="hover-zone" onMouseEnter={toggleDrawer}></div>
      <div
        className={`drawer ${visible ? 'open' : 'closed'}`}
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
            <input type="file" accept="application/pdf" onChange={uploadFile} />
          </div>
        </div>
      </div>
    </>
  );
});

export default RightBlock;