import React from 'react';
import SuggestionChip from './SuggestionChip';

export default function SuggestionBar({ suggestions = [], onFill = ()=>{}, onSend = ()=>{} }){
  if(!suggestions || suggestions.length === 0) return null;
  return (
    <div className="suggestion-bar" role="region" aria-label="建議問題">
      {suggestions.map(s => (
        <SuggestionChip key={s.id} suggestion={s} onFill={onFill} onSend={onSend} />
      ))}
    </div>
  );
}
