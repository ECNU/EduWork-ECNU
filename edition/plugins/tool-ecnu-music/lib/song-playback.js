// The scene's output is a function of time, not accumulated timer increments.
function installSongPlayback({data,audio,score}) {
  const $=id=>document.getElementById(id)
  const identity={audioSha256:data.timeline.audioSha256,abcSha256:data.timeline.abcSha256,abcLength:data.abc.length}
  let timeline=validateTimeline(data.timeline,identity),tunes=[],lastIndex='',lastScore=-2,raf=0,follow=true,scoreElements=[]
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)')
  const duration=()=>Number.isFinite(audio.duration)?audio.duration*1000:timeline.durationMs||0
  const clock=ms=>{const n=Math.floor(Math.max(0,ms)/1000);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
  function warn(message){$('timeline-warning').hidden=!message;$('timeline-warning').textContent=message||''}
  function syncLabels(){
    for(const [track,id,label]of[[timeline.lyrics,'lyrics-sync-state','歌词'],[timeline.score,'score-sync-state','乐谱']])$(id).textContent=!track.cues.length?label+'待对齐':label+' · '+(track.status==='reviewed'?'已标记核对':'时间轴草稿')
    $('stage-caption-state').textContent=!timeline.lyrics.cues.length?'尚未添加歌词时间轴':timeline.lyrics.status==='reviewed'?'歌词时间轴 · 已标记核对':'歌词时间轴 · 草稿，待试听核对'
    $('timeline-source').textContent=timeline.lyrics.source?'歌词时间轴来源：'+timeline.lyrics.source:''
  }
  function updateLyrics(){
    const rows=[...$('lyrics').querySelectorAll('p')];let from=0
    for(const row of rows){row.classList.remove('active-lyric');delete row.dataset.cue;row.onclick=null;row.removeAttribute('tabindex');row.removeAttribute('role');row.onkeydown=null}
    for(const [index,cue]of timeline.lyrics.cues.entries()){
      const match=rows.findIndex((row,i)=>i>=from&&row.textContent.trim()===cue.text.trim())
      if(match<0)continue
      const row=rows[match];from=match+1;row.dataset.cue=String(index);row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','跳转到歌词：'+cue.text)
      row.onclick=()=>{audio.currentTime=cue.startMs/1000};row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click()}}
    }
  }
  function editorRows(){
    const cues=timeline.lyrics.cues.length?timeline.lyrics.cues:data.lyrics.split(/\r?\n/).filter(line=>line.trim()&&!/^\s*\[[^\]]+\]\s*$/.test(line)).map(text=>({text}))
    $('timing-rows').replaceChildren()
    for(const cue of cues){
      const tr=document.createElement('tr'),label=document.createElement('td');label.textContent=cue.text;tr.append(label)
      for(const [key,title]of[['startMs','开始'],['endMs','结束']]){
        const td=document.createElement('td'),input=document.createElement('input'),button=document.createElement('button')
        input.type='number';input.min='0';input.step='0.001';input.value=Number.isFinite(cue[key])?String(cue[key]/1000):'';input.setAttribute('aria-label',cue.text+' '+title+'秒');input.dataset.field=key
        button.type='button';button.textContent='记录'+title;button.onclick=()=>{input.value=audio.currentTime.toFixed(3);$('timing-reviewed').checked=false}
        input.oninput=()=>{$('timing-reviewed').checked=false};td.append(input,button);tr.append(td)
      }
      $('timing-rows').append(tr)
    }
  }
  function adopt(value){
    const next=validateTimeline(value,{...identity,durationMs:duration()||undefined})
    timeline=next;lastIndex='';lastScore=-2;syncLabels();updateLyrics();editorRows();$('timing-reviewed').checked=false
    renderAt(audio.currentTime*1000)
  }
  function renderAt(timeMs){
    window.musicReader?.renderAt(timeMs)
    const state=sampleTimeline(timeline,timeMs,duration()),cues=timeline.lyrics.cues,index=state.lyricIndex
    $('stage-clock').textContent=clock(state.timeMs);$('stage-total').textContent=duration()?clock(duration()):'—'
    $('stage-progress-fill').style.transform='scaleX('+state.progress+')';$('stage-progress-fill').parentElement.setAttribute('aria-valuenow',String(Math.round(state.progress*100)))
    $('stage-seek').max=String(duration()||1);$('stage-seek').value=String(state.timeMs);$('stage-seek').disabled=!duration()
    $('stage-seek').setAttribute('aria-valuetext',clock(state.timeMs)+' / '+clock(duration()))
    $('stage-play').textContent=audio.paused?'播放':'暂停'
    const enter=reducedMotion.matches?1:state.enterProgress
    $('stage-current').style.transform='translateY('+((1-enter)*12)+'px)';$('stage-current').style.opacity=String(.65+.35*enter)
    const key=index+':'+state.nextIndex+':'+Boolean(duration()&&state.timeMs>=duration())
    if(key!==lastIndex){
      lastIndex=key
      $('stage-current').textContent=state.lyric?.text||(cues.length?(state.timeMs>=duration()&&duration()?'播放结束':state.nextIndex===0?'前奏':'间奏 / 尾声'):'歌词待校时')
      $('stage-prev').textContent=index>0?cues[index-1].text:''
      $('stage-next').textContent=index>=0?(cues[index+1]?.text||''):(state.nextIndex>=0?cues[state.nextIndex].text:'')
      for(const row of $('lyrics').querySelectorAll('[data-cue]')){
        const active=Number(row.dataset.cue)===index;row.classList.toggle('active-lyric',active)
        if(active&&follow&&!window.musicReader?.automatic&&$('lyrics').parentElement.scrollHeight>$('lyrics').parentElement.clientHeight){const pane=$('lyrics').parentElement;pane.scrollTop+=row.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientHeight/2}
      }
    }
    if(state.scoreIndex!==lastScore){
      lastScore=state.scoreIndex
      $('score-sync-state').textContent=!timeline.score.cues.length?'乐谱待对齐':'乐谱 · '+(timeline.score.status==='reviewed'?'已标记核对':'时间轴草稿')
      for(const element of scoreElements)for(const node of element.nodes)node.classList.remove('time-active')
      for(const svg of score.querySelectorAll('svg'))svg.classList.remove('active-score-line')
      if(state.score){let matched=false;for(const element of scoreElements)if(element.start>=state.score.startChar&&element.start<state.score.endChar){matched=true;for(const node of element.nodes){node.classList.add('time-active');node.closest('svg')?.classList.add('active-score-line')}}
        if(!matched)$('score-sync-state').textContent='当前乐谱映射未匹配，请核对'
      }
    }
    return state
  }
  function tick(){raf=0;renderAt(audio.currentTime*1000);if(!audio.paused&&!audio.ended)raf=requestAnimationFrame(tick)}
  for(const event of ['play','pause','timeupdate','seeking','seeked','ratechange','ended'])audio.addEventListener(event,()=>{if(raf)cancelAnimationFrame(raf);tick()})
  function metadata(){try{timeline=validateTimeline(timeline,{...identity,durationMs:duration()});warn('')}catch(error){timeline=emptyTimeline(identity.audioSha256,identity.abcSha256);warn(error.message+'；已停用同步，请重新导入。');syncLabels();updateLyrics();editorRows()}lastIndex='';lastScore=-2;renderAt(audio.currentTime*1000)}
  audio.addEventListener('loadedmetadata',metadata)
  $('stage-play').onclick=async()=>{try{if(audio.paused)await audio.play();else audio.pause()}catch{warn('音频未能播放，请检查作品目录或本地预览服务。')}}
  $('stage-seek').oninput=e=>{audio.currentTime=Number(e.target.value)/1000;renderAt(audio.currentTime*1000)}
  $('portrait').onclick=e=>{const enabled=$('song-stage').classList.toggle('portrait');e.currentTarget.setAttribute('aria-pressed',String(enabled));e.currentTarget.textContent=enabled?'宽屏预览':'竖屏预览'}
  $('follow-lyrics').onclick=e=>{follow=!follow;e.currentTarget.setAttribute('aria-pressed',String(follow));e.currentTarget.textContent='跟随歌词 · '+(follow?'开':'关')}
  $('timeline-import').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return
    try{
      if(file.size>1024*1024)throw Error('时间轴文件不能超过 1 MiB')
      const text=await file.text(),format=file.name.split('.').pop().toLowerCase()
      const parsed=format==='json'?JSON.parse(text):null
      if(parsed?.schema)adopt(parsed)
      else{const next=structuredClone(timeline);next.durationMs=duration()||null;next.lyrics={status:'draft',source:file.name,cues:parseSubtitles(text,format,duration())};adopt(next)}
      warn(format==='lrc'?'LRC 仅含开始时间，结束暂取下一标记；请核对间奏空白和末句结束。':'已导入，请试听核对。原歌词保持不变。')
    }catch(error){warn(error.message)}finally{event.target.value=''}
  }
  $('timing-apply').onclick=()=>{
    try{
      if(!duration())throw Error('请先载入音频')
      const cues=[]
      for(const row of $('timing-rows').rows){const [start,end]=row.querySelectorAll('input');if(!start.value&&!end.value)continue;if(!start.value||!end.value)throw Error('每句须同时填写开始与结束时间');cues.push({text:row.cells[0].textContent,startMs:Number(start.value)*1000,endMs:Number(end.value)*1000})}
      const next=structuredClone(timeline);next.durationMs=duration();next.lyrics={status:$('timing-reviewed').checked?'reviewed':'draft',source:'manual',cues};adopt(next);warn('校时已应用。请导出时间轴保存本次更改。')
    }catch(error){warn(error.message)}
  }
  $('timeline-download').onclick=()=>{
    const value=structuredClone(timeline);value.durationMs=duration()||value.durationMs
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='timeline.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  $('stage-title').textContent=data.title;syncLabels();updateLyrics();editorRows();if(Number.isFinite(audio.duration))metadata();else renderAt(audio.currentTime*1000)
  const api={renderAt,getTimeline:()=>structuredClone(timeline),scoreChanged(value){tunes=value;scoreElements=[];for(const tune of tunes)for(const line of tune.lines||[])for(const staff of line.staff||[])for(const voice of staff.voices||[])for(const element of voice)if(element.el_type==='note'&&Number.isInteger(element.startChar)&&element.abselem?.elemset?.length)scoreElements.push({start:element.startChar,nodes:element.abselem.elemset.filter(node=>node?.classList)});lastScore=-2;renderAt(audio.currentTime*1000)}}
  window.musicPresentation=api
  return api
}
