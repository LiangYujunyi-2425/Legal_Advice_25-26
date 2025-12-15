import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

function AiMessage({ text }) {
  const normalized = text.replace(/\\n/g, "\n"); // 把字面上的 \n 轉成換行
  return (
    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
      {normalized}
    </ReactMarkdown>
  );
}

export default AiMessage;