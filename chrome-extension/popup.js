// Small helper to allow switching between dev (iframe to localhost) and production (local files)
(function(){
  const frame = document.getElementById('appFrame');
  if(!frame) return;
  // If extension has a local dist (production), prefer it
  fetch('dist/index.html', {method:'HEAD'}).then(r => {
    if(r.ok) frame.src = 'dist/index.html';
  }).catch(()=>{
    // keep default (localhost) in dev
  });
})();
