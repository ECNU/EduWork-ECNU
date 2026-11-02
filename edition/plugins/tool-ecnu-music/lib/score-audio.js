// abcjs supplies the musical sequence; Web Audio supplies an offline synthetic timbre.
export function scoreAudioEvents(sequence,descriptors=[]) {
  const unit=240/sequence.tempo
  if(!Number.isFinite(unit)||unit<=0)throw Error('谱面速度无效')
  const tracks=[],notes=[]
  sequence.tracks.forEach((events,id)=>{
    const pitched=events.filter(e=>e.cmd==='note'&&e.volume>0);if(!pitched.length)return
    tracks.push({id,name:descriptors[id]?.name||'声部 '+(id+1),kind:descriptors[id]?.kind||'voice',noteCount:pitched.length})
    for(const e of pitched)notes.push({track:id,start:e.start*unit,end:(e.start+e.duration)*unit,pitch:e.pitch,volume:e.volume,startChar:e.startChar})
  })
  const duration=sequence.totalDuration*unit
  if(notes.length>12000||!notes.length||!Number.isFinite(duration)||duration<=0||duration>1200||notes.some(n=>![n.start,n.end,n.pitch,n.volume].every(Number.isFinite)||n.start<0||n.end<=n.start||n.end>duration+.1||n.pitch<0||n.pitch>127))throw Error('当前谱面无法试听或超出试听长度限制')
  return {notes:notes.sort((a,b)=>a.start-b.start),tracks,duration}
}
function installScoreAudio({score,audio}) {
  const $=id=>document.getElementById(id),button=$('score-play'),seek=$('score-seek'),label=$('score-audio-state'),mixer=$('score-mixer')
  let ctx,master,notes=[],tracks=[],duration=0,offset=0,anchor=0,playing=false,next=0,timer,raf,epoch=0,elements=[],activeKey='',lastSvg
  const buses=new Map(),colors=['#b54822','#1765a0','#67519a','#277447','#9c345c']
  const audible=track=>track.enabled&&track.volume>0&&(!tracks.some(t=>t.solo)||track.solo)
  function mix(){
    for(const track of tracks){const bus=buses.get(track.id);if(bus){bus.gain.gain.setTargetAtTime(audible(track)?track.volume/100:0,ctx.currentTime,.01);bus.pan.pan.setTargetAtTime(track.pan,ctx.currentTime,.01)}}
    activeKey='';update()
    for(const row of mixer.querySelectorAll('[data-track]')){const track=tracks.find(t=>t.id===Number(row.dataset.track));row.querySelector('input[type=checkbox]').checked=track.enabled;row.querySelector('button').setAttribute('aria-pressed',String(track.solo));row.querySelector('[data-volume]').textContent=track.volume+'%';row.classList.toggle('muted',!audible(track))}
  }
  function ensureBuses(){for(const track of tracks)if(!buses.has(track.id)){
    const gain=ctx.createGain(),pan=ctx.createStereoPanner(),analyser=ctx.createAnalyser();analyser.fftSize=256
    gain.gain.value=audible(track)?track.volume/100:0;pan.pan.value=track.pan;gain.connect(pan);pan.connect(analyser);analyser.connect(master);buses.set(track.id,{gain,pan,analyser})
  }}
  function buildMixer(){
    mixer.replaceChildren()
    for(const track of tracks){
      const row=document.createElement('div');row.className='score-track';row.dataset.track=String(track.id);row.style.setProperty('--track-color',colors[track.id%colors.length])
      const name=document.createElement('label'),enabled=document.createElement('input'),text=document.createElement('span');enabled.type='checkbox';enabled.checked=track.enabled;text.textContent=track.name;name.append(enabled,text);enabled.onchange=()=>{track.enabled=enabled.checked;mix()}
      const solo=document.createElement('button');solo.type='button';solo.textContent='独奏';solo.setAttribute('aria-label','独奏 '+track.name);solo.setAttribute('aria-pressed',String(track.solo));solo.onclick=()=>{const on=!track.solo;for(const t of tracks)t.solo=false;track.solo=on;if(on)track.enabled=true;mix()}
      const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.value=String(track.volume);volume.setAttribute('aria-label',track.name+' 音量');volume.oninput=()=>{track.volume=Number(volume.value);mix()}
      const amount=document.createElement('span');amount.dataset.volume='';amount.textContent=track.volume+'%'
      const tone=document.createElement('select');tone.setAttribute('aria-label',track.name+' 音色');for(const [value,title]of[['keys','柔和键盘'],['pluck','清亮拨弦'],['round','圆润音色']])tone.add(new Option(title,value));tone.value=track.timbre;tone.onchange=()=>{track.timbre=tone.value}
      row.append(name,solo,volume,amount,tone);mixer.append(row)
    }
    $('score-all').onclick=()=>{for(const t of tracks){t.enabled=true;t.solo=false}mix()}
    $('score-mix-note').textContent=tracks.some(t=>t.kind==='chords')?'和弦伴奏由谱面和弦标记生成，可关闭。音色切换从下一个音符生效。':'各声部可独奏、静音和调节音量。音色切换从下一个音符生效。'
    mix()
  }
  const voices=new Set(),clock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')
  const position=()=>playing?Math.min(duration,offset+ctx.currentTime-anchor):offset
  function clearVoices(){for(const voice of voices){try{voice.stop()}catch{}voice.disconnect()}voices.clear()}
  function highlight(time){
    const active=notes.filter(n=>n.start<=time&&n.end>time&&audible(tracks.find(t=>t.id===n.track))),starts=new Map(active.filter(n=>Number.isInteger(n.startChar)).map(n=>[n.startChar,n.track])),key=[...starts].flat().join(',')
    if(key===activeKey)return;activeKey=key
    const lines=new Set()
    for(const el of elements)for(const node of el.nodes){const id=starts.get(el.start),on=id!==undefined;node.classList.toggle('sheet-playing',on);if(on){node.style.setProperty('--score-voice-color',colors[id%colors.length]);node.dataset.scoreTrack=String(id);const svg=node.closest('svg');if(svg)lines.add(svg)}else delete node.dataset.scoreTrack}
    const svg=lines.values().next().value
    for(const line of score.querySelectorAll('svg'))line.classList.toggle('sheet-active',lines.has(line))
    if(playing&&svg&&svg!==lastSvg){lastSvg=svg;const pane=score.closest('.score-card');if(pane&&pane.scrollHeight>pane.clientHeight)pane.scrollTop+=svg.getBoundingClientRect().top-pane.getBoundingClientRect().top-180}
  }
  function update(){const time=position();seek.max=String(duration);seek.value=String(time);seek.setAttribute('aria-valuetext',clock(time)+' / '+clock(duration));$('score-clock').textContent=clock(time)+' / '+clock(duration);button.textContent=playing?'暂停乐谱':'试听乐谱';highlight(time)}
  function pause(){++epoch;const wasPlaying=playing;offset=position();playing=false;clearInterval(timer);cancelAnimationFrame(raf);clearVoices();update();if(wasPlaying)label.textContent='乐谱试听已暂停'}
  function schedule(note,now,time){
    const start=now+Math.max(0,note.start-time),length=note.end-Math.max(time,note.start)
    if(length<=0)return
    const track=tracks.find(t=>t.id===note.track),oscillator=ctx.createOscillator(),gain=ctx.createGain(),partials=track.timbre==='pluck'?[0,1,.42,.2,.09]:track.timbre==='round'?[0,1,.12,.04]:[0,1,.22,.1,.05]
    oscillator.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(partials.length),Float32Array.from(partials)));oscillator.frequency.value=440*2**((note.pitch-69)/12)
    const peak=.075*Math.min(1,note.volume/127);gain.gain.setValueAtTime(.00001,start);gain.gain.exponentialRampToValueAtTime(peak,start+Math.min(.008,length/4));gain.gain.exponentialRampToValueAtTime(Math.max(.00002,peak*(track.timbre==='pluck'?.13:.4)),start+length*.7);gain.gain.exponentialRampToValueAtTime(.00001,start+length)
    oscillator.connect(gain);gain.connect(buses.get(track.id).gain);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect()};oscillator.start(start);oscillator.stop(start+length+.01)
  }
  function pump(){const time=position();if(time>=duration){pause();offset=0;activeKey='';update();label.textContent='谱面试听结束';return}while(next<notes.length&&notes[next].start<time+.35){const note=notes[next++];if(note.end>time)schedule(note,ctx.currentTime,time)}}
  function frame(){update();if(playing)raf=requestAnimationFrame(frame)}
  async function start(){
    if(!notes.length)return
    const request=++epoch
    try{
      audio?.pause()
      ctx??=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();if(request!==epoch)return
      if(!master){master=ctx.createDynamicsCompressor();master.connect(ctx.destination)}ensureBuses()
      if(offset>=duration)offset=0;anchor=ctx.currentTime;playing=true;next=notes.findIndex(n=>n.end>offset);if(next<0)next=notes.length
      label.textContent='正在按 ABC 演奏 · 分声部合成';pump();timer=setInterval(pump,80);frame()
    }catch(error){pause();label.textContent='谱面试听失败：'+error.message}
  }
  button.onclick=()=>{if(playing)pause();else start()}
  $('score-stop').onclick=()=>{pause();offset=0;activeKey='';update();label.textContent='按 ABC 演奏 · 合成音色'}
  seek.oninput=()=>{const resume=playing,target=Number(seek.value);pause();offset=Math.min(duration,target);activeKey='';update();if(resume)start()}
  audio?.addEventListener('play',()=>{pause();activeKey='';for(const node of score.querySelectorAll('.sheet-playing,.sheet-active'))node.classList.remove('sheet-playing','sheet-active')})
  window.addEventListener('pagehide',()=>{pause();ctx?.close()})
  function trackState(track){const bus=buses.get(track.id),samples=new Float32Array(256);bus?.analyser.getFloatTimeDomainData(samples);return {...track,audible:audible(track),rms:Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length)}}
  return {getState:()=>({playing,time:position(),duration,notes:notes.length,voices:voices.size,contextState:ctx?.state,tracks:tracks.map(trackState)}),scoreChanged(tunes){
    pause();elements=[];lastSvg=null;activeKey=''
    try{
      if(tunes.length!==1)throw Error('试听暂支持单首 ABC')
      const names=new Map(),staffNames=new Map()
      for(const line of tunes[0].lines||[])for(const [s,staff]of(line.staff||[]).entries())for(const [i,voice]of(staff.voices||[]).entries()){
        const key=s+':'+i;if(staff.title?.[i]&&!staffNames.has(key))staffNames.set(key,staff.title[i])
        for(const el of voice)if(el.el_type==='note'&&el.abselem?.elemset){elements.push({start:el.startChar,nodes:el.abselem.elemset.filter(n=>n?.classList)});if(staffNames.has(key))names.set(el.startChar,staffNames.get(key))}
      }
      const voiceCount=tunes[0].setUpAudio({chordsOff:true}).tracks.length,sequence=tunes[0].setUpAudio({chordsOff:false}),descriptors=sequence.tracks.map((events,id)=>{const source=events.find(e=>e.cmd==='note'&&names.has(e.startChar)),title=source?names.get(source.startChar):null;return id>=voiceCount?{name:'和弦伴奏',kind:'chords'}:{name:typeof title==='string'?title:'声部 '+(id+1),kind:'voice'}})
      const value=scoreAudioEvents(sequence,descriptors),previous=new Map(tracks.map(t=>[t.id,t]));notes=value.notes;duration=value.duration;offset=Math.min(offset,duration)
      const voiced=value.tracks.filter(t=>t.kind==='voice')
      tracks=value.tracks.map(t=>({...t,enabled:true,solo:false,volume:t.kind==='chords'?50:100,timbre:t.kind==='chords'?'round':t.id%2?'pluck':'keys',pan:t.kind==='chords'||voiced.length<2?0:voiced.indexOf(t)/(voiced.length-1)*.5-.25,...(previous.has(t.id)?Object.fromEntries(['enabled','solo','volume','timbre','pan'].map(k=>[k,previous.get(t.id)[k]])): {})}))
      if(ctx&&master)ensureBuses();buildMixer();button.disabled=false;seek.disabled=false;label.textContent='按 ABC 演奏 · 分声部合成';update()
    }catch(error){notes=[];tracks=[];duration=0;offset=0;button.disabled=true;seek.disabled=true;mixer.replaceChildren();label.textContent=error.message}
  }}
}
