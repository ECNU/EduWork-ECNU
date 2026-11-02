// abcjs supplies the musical sequence; Web Audio supplies an offline synthetic timbre.
export function scoreAudioEvents(sequence) {
  const unit=240/sequence.tempo
  if(!Number.isFinite(unit)||unit<=0)throw Error('谱面速度无效')
  const notes=sequence.tracks.flat().filter(e=>e.cmd==='note'&&e.volume>0).map(e=>({start:e.start*unit,end:(e.start+e.duration)*unit,pitch:e.pitch,volume:e.volume,startChar:e.startChar}))
  const duration=sequence.totalDuration*unit
  if(notes.length>12000||!notes.length||!Number.isFinite(duration)||duration<=0||duration>1200||notes.some(n=>![n.start,n.end,n.pitch,n.volume].every(Number.isFinite)||n.start<0||n.end<=n.start||n.end>duration+.1||n.pitch<0||n.pitch>127))throw Error('当前谱面无法试听或超出试听长度限制')
  return {notes:notes.sort((a,b)=>a.start-b.start),duration}
}
function installScoreAudio({score,audio}) {
  const $=id=>document.getElementById(id),button=$('score-play'),seek=$('score-seek'),label=$('score-audio-state')
  let ctx,master,notes=[],duration=0,offset=0,anchor=0,playing=false,next=0,timer,raf,epoch=0,elements=[],activeKey='',lastSvg
  const voices=new Set(),clock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')
  const position=()=>playing?Math.min(duration,offset+ctx.currentTime-anchor):offset
  function clearVoices(){for(const voice of voices){try{voice.stop()}catch{}voice.disconnect()}voices.clear()}
  function highlight(time){
    const active=notes.filter(n=>n.start<=time&&n.end>time),starts=new Set(active.map(n=>n.startChar)),key=[...starts].join(',')
    if(key===activeKey)return;activeKey=key
    for(const el of elements)for(const node of el.nodes)node.classList.toggle('sheet-playing',starts.has(el.start))
    let svg;for(const el of elements)if(starts.has(el.start)){svg=el.nodes[0]?.closest('svg');if(svg)break}
    for(const line of score.querySelectorAll('svg'))line.classList.toggle('sheet-active',line===svg)
    if(playing&&svg&&svg!==lastSvg){lastSvg=svg;const pane=score.closest('.score-card');if(pane&&pane.scrollHeight>pane.clientHeight)pane.scrollTop+=svg.getBoundingClientRect().top-pane.getBoundingClientRect().top-180}
  }
  function update(){const time=position();seek.max=String(duration);seek.value=String(time);seek.setAttribute('aria-valuetext',clock(time)+' / '+clock(duration));$('score-clock').textContent=clock(time)+' / '+clock(duration);button.textContent=playing?'暂停乐谱':'试听乐谱';highlight(time)}
  function pause(){++epoch;const wasPlaying=playing;offset=position();playing=false;clearInterval(timer);cancelAnimationFrame(raf);clearVoices();update();if(wasPlaying)label.textContent='乐谱试听已暂停'}
  function schedule(note,now,time){
    const start=now+Math.max(0,note.start-time),length=note.end-Math.max(time,note.start)
    if(length<=0)return
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='triangle';oscillator.frequency.value=440*2**((note.pitch-69)/12)
    const peak=.075*Math.min(1,note.volume/127);gain.gain.setValueAtTime(.00001,start);gain.gain.exponentialRampToValueAtTime(peak,start+Math.min(.008,length/4));gain.gain.exponentialRampToValueAtTime(Math.max(.00002,peak*.35),start+length*.7);gain.gain.exponentialRampToValueAtTime(.00001,start+length)
    oscillator.connect(gain);gain.connect(master);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect()};oscillator.start(start);oscillator.stop(start+length+.01)
  }
  function pump(){const time=position();if(time>=duration){pause();offset=0;activeKey='';update();label.textContent='谱面试听结束';return}while(next<notes.length&&notes[next].start<time+.35){const note=notes[next++];if(note.end>time)schedule(note,ctx.currentTime,time)}}
  function frame(){update();if(playing)raf=requestAnimationFrame(frame)}
  async function start(){
    if(!notes.length)return
    const request=++epoch
    try{
      audio?.pause()
      ctx??=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();if(request!==epoch)return
      if(!master){master=ctx.createDynamicsCompressor();master.connect(ctx.destination)}
      if(offset>=duration)offset=0;anchor=ctx.currentTime;playing=true;next=notes.findIndex(n=>n.end>offset);if(next<0)next=notes.length
      label.textContent='正在按 ABC 演奏 · 合成音色';pump();timer=setInterval(pump,80);frame()
    }catch(error){pause();label.textContent='谱面试听失败：'+error.message}
  }
  button.onclick=()=>{if(playing)pause();else start()}
  $('score-stop').onclick=()=>{pause();offset=0;activeKey='';update();label.textContent='按 ABC 演奏 · 合成音色'}
  seek.oninput=()=>{const resume=playing,target=Number(seek.value);pause();offset=Math.min(duration,target);activeKey='';update();if(resume)start()}
  audio?.addEventListener('play',()=>{pause();activeKey='';for(const node of score.querySelectorAll('.sheet-playing,.sheet-active'))node.classList.remove('sheet-playing','sheet-active')})
  window.addEventListener('pagehide',()=>{pause();ctx?.close()})
  return {getState:()=>({playing,time:position(),duration,notes:notes.length,voices:voices.size,contextState:ctx?.state}),scoreChanged(tunes){
    pause();elements=[];lastSvg=null;activeKey=''
    try{
      if(tunes.length!==1)throw Error('试听暂支持单首 ABC')
      const sequence=tunes[0].setUpAudio({chordsOff:true}),value=scoreAudioEvents(sequence);notes=value.notes;duration=value.duration;offset=Math.min(offset,duration)
      for(const line of tunes[0].lines||[])for(const staff of line.staff||[])for(const voice of staff.voices||[])for(const el of voice)if(el.el_type==='note'&&el.abselem?.elemset)elements.push({start:el.startChar,nodes:el.abselem.elemset.filter(n=>n?.classList)})
      button.disabled=false;seek.disabled=false;label.textContent='按 ABC 演奏 · 合成音色';update()
    }catch(error){notes=[];duration=0;offset=0;button.disabled=true;seek.disabled=true;label.textContent=error.message}
  }}
}
