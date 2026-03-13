// 測試AI API響應格式的腳本
const PREDICT_ENDPOINT = 'https://api-926721049029.us-central1.run.app/predict';

async function testAIResponse() {

  try {
    const response = await fetch(PREDICT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system_prompt: "",
        user_question: "請簡單介紹一下香港法律第4章的內容"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;


    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 處理SSE格式的數據
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // 移除 'data: '

          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            chunkCount++;
          } catch (e) {
          }
        }
      }
    }
  } catch (error) {
  }
}

// 執行測試
testAIResponse();