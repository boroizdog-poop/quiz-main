'use strict';

// Local media files work both on a web server and when index.html is opened directly.
window.GameAudio = (() => {
  const files={'tank-engine':'tank-engine.mp3','gun-reload':'gun-reload.mp3',boom:'vine-boom.mp3',explosion:'explosion.mp3',potion:'potion.mp3',yay:'yay.mp3','metal-bar':'metal-bar.mp3','doge-bonk':'doge-bonk.mp3','goofy-bonk':'goofy-bonk.mp3',flashbang:'flashbang.mp3','disappearing-scream':'disappearing-scream.mp3','get-out':'get-out.mp3','glass-break':'glass-break.mp3'};
  const templates=new Map();
  const voices=new Set();
  const failures=[];
  const recent=[];
  const completions=[];
  let enabled=true,started=false,musicVolume=.22,effectsVolume=.75,duckFactor=1,duckTimer;
  const track='background';
  let phase='intro';
  const music=new Audio('assets/audio/background.mp3');
  music.id='background-music';music.loop=true;music.preload='none';music.autoplay=false;music.hidden=true;
  music.defaultPlaybackRate=1;music.playbackRate=1;music.preservesPitch=true;
  music.volume=musicVolume;document.body.append(music);
  function record(name,extra={}) {recent.push({name,time:performance.now(),...extra});if(recent.length>100)recent.shift();}
  function fail(name,error) {failures.push({name,error:String(error?.message||error)});}
  for(const [name,file] of Object.entries(files)){
    const media=new Audio('assets/audio/'+file);media.preload='none';media.autoplay=false;
    media.addEventListener('error',()=>fail(name,media.error));templates.set(name,media);
  }
  music.addEventListener('error',()=>fail('music',music.error));
  function setMusicVolume(value) {musicVolume=Math.max(0,Math.min(1,value));music.volume=musicVolume*duckFactor;}
  function setEffectsVolume(value) {effectsVolume=Math.max(0,Math.min(1,value));}
  function startMusic() {
    if(!enabled||!started||document.hidden)return;
    music.play().then(()=>record('music-start',{track})).catch(error=>{
      if(!['AbortError','NotAllowedError'].includes(error.name))fail('music-play',error);
    });
  }
  function stop(voice,reason='stopped') {
    if(!voices.has(voice))return;
    clearTimeout(voice.fadeTimer);voice.media.pause();voices.delete(voice);
    completions.push({name:voice.name,reason,position:voice.media.currentTime,duration:voice.media.duration,time:performance.now()});
    if(completions.length>100)completions.shift();
    voice.resolve();
  }
  function clearEffects() {for(const voice of [...voices])stop(voice);}
  function fadeOut(voice,milliseconds) {
    if(!voices.has(voice))return;
    const start=performance.now();
    if(voice.fading&&voice.fadeUntil<=start+milliseconds)return;
    clearTimeout(voice.fadeTimer);voice.fadeUntil=start+milliseconds;
    voice.fading=true;const from=voice.media.volume;
    const tick=()=>{
      if(!voices.has(voice))return;
      const progress=Math.min(1,(performance.now()-start)/Math.max(1,milliseconds));
      voice.media.volume=from*(1-progress);
      if(progress===1)stop(voice,'faded');else voice.fadeTimer=setTimeout(tick,20);
    };
    tick();
  }
  function duck(duration=1200,factor=.3) {
    clearTimeout(duckTimer);duckFactor=Math.min(duckFactor,factor);music.volume=musicVolume*duckFactor;
    duckTimer=setTimeout(()=>{duckFactor=1;music.volume=musicVolume;},duration);
  }
  function play(name,{volume=1,offset=0,maxVoices=3}={}) {
    if(!enabled||!started||document.hidden||!document.getElementById('intro').hidden)return;
    if(!['animating','finishing'].includes(phase)&&!(phase==='result'&&name==='yay'))return;
    const template=templates.get(name);if(!template)return;
    const same=[...voices].filter(voice=>voice.name===name);
    while(same.length>=maxVoices)fadeOut(same.shift(),160);
    const media=template.cloneNode(true);media.volume=Math.min(1,Math.max(0,volume*effectsVolume));
    media.defaultPlaybackRate=1;media.playbackRate=1;media.preservesPitch=true;
    const voice={name,media,phase,fadeTimer:null,fading:false};
    voice.finished=new Promise(resolve=>{voice.resolve=resolve;});voices.add(voice);
    media.addEventListener('ended',()=>stop(voice,'ended'),{once:true});
    media.addEventListener('error',()=>{fail(name,media.error);stop(voice,'error');},{once:true});
    if(offset)media.currentTime=offset;
    media.play().then(()=>{if(voices.has(voice))record(name,{volume:media.volume,rate:media.playbackRate,phase:voice.phase});}).catch(error=>{
      if(error.name!=='AbortError')fail(name,error);stop(voice,'error');
    });
    duck(name==='yay'?3400:1100,name==='yay'?.18:.35);
    return {finished:voice.finished,stop:()=>fadeOut(voice,350)};
  }
  function begin() {
    started=true;clearEffects();clearTimeout(duckTimer);duckFactor=1;setMusicVolume(musicVolume);
    for(const media of templates.values()){media.preload='auto';if(media.readyState===0)media.load();}
    startMusic();
  }
  function setEnabled(value) {
    enabled=Boolean(value);
    if(enabled)startMusic();else {music.pause();clearEffects();}
    return enabled;
  }
  function setPhase(next) {
    phase=next;
    if(next==='intro'){clearEffects();return;}
    for(const voice of [...voices]){
      if(next==='answered'){
        const remaining=(voice.media.duration-voice.media.currentTime)*1000;
        fadeOut(voice,Number.isFinite(remaining)?Math.max(250,remaining):1800);
      }else fadeOut(voice,next==='question'?180:250);
    }
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){music.pause();clearEffects();}else startMusic();
  });
  // Browsers may require the first user gesture before audible music can start.
  const unlockMusic=()=>{if(music.paused)startMusic();};
  document.addEventListener('pointerdown',unlockMusic,{capture:true});
  document.addEventListener('keydown',unlockMusic,{capture:true});
  started=true;music.preload='auto';startMusic();
  return {play,begin,duck,setEnabled,setPhase,setMusicVolume,setEffectsVolume,
    get enabled(){return enabled;},
    get status(){return {enabled,started,track,phase,musicPlaying:!music.paused,musicTime:music.currentTime,musicVolume,effectsVolume,activeEffects:voices.size,fadingEffects:[...voices].filter(v=>v.fading).length,failures:[...failures],recent:[...recent],completions:[...completions]};}
  };
})();
