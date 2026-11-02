function installSongReading({audio}) {
  const pane=document.getElementById('lyrics-scroll'),button=document.getElementById('reading-auto'),notice=document.getElementById('reading-notice')
  let automatic=false,lastTime=0
  function labels(){button.setAttribute('aria-pressed',String(automatic));button.textContent=automatic?'停止自动浏览':'自动浏览';notice.textContent=automatic?'按整曲时长浏览 · 不与演唱逐句同步':'完整歌词 · 可上下滚动阅读'}
  function renderAt(timeMs){lastTime=timeMs;const state=sampleReading(timeMs,audio.duration*1000);if(automatic)pane.scrollTop=Math.max(0,pane.scrollHeight-pane.clientHeight)*state.progress;return {...state,automatic,scrollTop:pane.scrollTop}}
  function stop(){automatic=false;labels()}
  function fit(){if(matchMedia('(max-width:700px)').matches&&pane.offsetParent){const player=document.querySelector('.player');pane.style.height=Math.max(120,innerHeight-pane.getBoundingClientRect().top-player.getBoundingClientRect().height-36)+'px'}else pane.style.height=''}
  button.onclick=()=>{automatic=!automatic;labels();renderAt(audio.currentTime*1000)}
  pane.addEventListener('wheel',stop,{passive:true});pane.addEventListener('touchstart',stop,{passive:true});pane.addEventListener('pointerdown',stop)
  pane.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))stop()})
  new ResizeObserver(()=>renderAt(lastTime)).observe(pane)
  new ResizeObserver(fit).observe(document.querySelector('.player'));window.addEventListener('resize',fit)
  document.getElementById('mobile-score').onclick=event=>{const active=document.body.classList.toggle('show-mobile-score');event.currentTarget.textContent=active?'返回歌词':'查看乐谱';event.currentTarget.setAttribute('aria-pressed',String(active));fit()}
  labels();fit();return {renderAt,stop,get automatic(){return automatic}}
}
