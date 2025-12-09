import { useMemo } from 'react';

// Minimal suggestion hook: rules-based fallback. Can be extended to call backend.
export function useSuggestions({ messages = [], uploadedFiles = [], popular = [] } = {}){
  return useMemo(()=>{
    // new user
    if(!messages || messages.length === 0){
      return [
        { id: 'intro-1', text: '怎麼開始？', type: 'fill' },
        { id: 'sample-summarize', text: '幫我總結這篇文章', type: 'fill' },
        { id: 'sample-translate', text: '翻譯成英文', type: 'send' },
      ];
    }

    const last = (messages[messages.length - 1]?.text || '').toLowerCase();

    // context: travel
    if(last.includes('旅遊') || uploadedFiles.some(f=>f?.type?.startsWith?.('image') || f?.name?.toLowerCase?.()?.includes?.('旅'))){
      return [
        { id: 'travel-1', text: '推薦景點？', type: 'fill' },
        { id: 'travel-2', text: '3天行程規劃', type: 'fill' },
        { id: 'travel-3', text: '幫我生成旅遊海報', type: 'send' },
      ];
    }

    // fallback to popular
    if(popular && popular.length > 0){
      return popular.slice(0,6).map((t,i)=>({ id:`pop-${i}`, text: t, type: 'fill' }));
    }

    // default general tips
    return [
      { id: 'gen-sum', text: '幫我總結文章', type: 'fill' },
      { id: 'gen-translate', text: '翻譯成英文', type: 'fill' },
      { id: 'gen-image', text: '生成圖片', type: 'send' },
    ];
  }, [messages, uploadedFiles, popular]);
}
