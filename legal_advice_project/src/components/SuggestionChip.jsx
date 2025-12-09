import React, { useState } from 'react';

export default function SuggestionChip({ suggestion, onFill = ()=>{}, onSend = ()=>{} }){
  const [loading, setLoading] = useState(false);

  function handleClick(){
    if(suggestion.type === 'send'){
      setLoading(true);
      Promise.resolve(onSend(suggestion.text)).finally(()=>setLoading(false));
    } else {
      onFill(suggestion.text);
    }
  }

  return (
    <button
      className="suggestion-chip"
      onClick={handleClick}
      aria-label={suggestion.text}
      title={suggestion.text}
      type="button"
    >
      {suggestion.icon ? <span className="chip-icon">{suggestion.icon}</span> : null}
      <span className="chip-text">{suggestion.text}</span>
      {loading ? <span className="chip-loading">…</span> : null}
    </button>
  );
}
