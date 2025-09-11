import React from 'react';
import './banner.css';

export default function Banner({ shrink }) {
  return (
    <div className='banner'>
      <button className='banner-btn'>首頁</button>
      <button className='banner-btn'>法律諮詢</button>
      <button className='banner-btn'>案件紀錄</button>
      <button className='banner-btn'>聯絡我們</button>
    </div>
  );
}