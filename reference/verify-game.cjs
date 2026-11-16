// Browser integration checks. Run with Node 22+ and a local Chrome installation.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'shots'),{recursive:true});
fs.mkdirSync(path.join(root,'.taste-skill'),{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,server,socket;
(async()=>{
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.md':'text/plain','.mp3':'audio/mpeg','.ttf':'font/ttf'};
  server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':data);});
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const port=server.address().port;
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox','--remote-debugging-port=0','--user-data-dir='+path.join(root,'.taste-skill','chrome-integration'),'--window-size=1440,900','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const browserWs=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout')),12000);chrome.stderr.on('data',d=>{output+=d;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(browserWs);await new Promise(r=>socket.onopen=r);
  let id=0;const pending=new Map();const errors=[];
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,m=>m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result));socket.send(JSON.stringify({id:request,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const c=(method,params={})=>send(method,params,sessionId);
  const ev=async expression=>{const r=await c('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async(expression,timeout=12000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await ev(expression))return;await sleep(50);}throw new Error('Timeout: '+expression);};
  const screenshot=async name=>{const r=await c('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'shots',name),Buffer.from(r.data,'base64'));};
  await c('Runtime.enable');await c('Page.enable');await c('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  if(process.argv.includes('--short-desktop'))await c('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await c('Page.navigate',{url:`http://127.0.0.1:${port}/`});await until('!!document.getElementById("start")');
  if(process.argv.includes('--inspect-yay')){
    console.log(await ev('(async()=>{const c=new AudioContext();const b=await c.decodeAudioData(await(await fetch("assets/audio/yay.mp3")).arrayBuffer());const a=b.getChannelData(0),r=b.sampleRate;const peaks=Array.from({length:Math.ceil(b.duration*10)},(_,i)=>{let p=0;for(let j=Math.floor(i*r/10);j<Math.min(a.length,(i+1)*r/10);j++)p=Math.max(p,Math.abs(a[j]));return [i/10,Math.round(p*1000)/1000]});await c.close();return {duration:b.duration,peaks}})()'));return;
  }
  await ev('document.fonts.ready');await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await ev('window.GameAudio.status.started'),true,'Music is initialized on page entry');
  await ev('window.GameAudio.begin();window.GameAudio.setPhase("animating");window.GameAudio.play("get-out");document.getElementById("sound").click();document.getElementById("sound").click()');
  await sleep(800);
  assert.equal(await ev('window.GameAudio.status.started'),true,'Music can start before entering battle');
  assert.equal(await ev('window.GameAudio.status.activeEffects'),0,'Visible intro blocks even an accidental SFX request');
  await until('window.GameAudio.status.musicPlaying&&window.GameAudio.status.musicTime>.1');
  assert.equal(await ev('!document.getElementById("intro").hidden'),true,'Music plays on the waiting screen');
  assert.deepEqual(await ev('window.GameAudio.status.failures'),[],'Autoplay restrictions are handled without errors');
  if(process.argv.includes('--audio-intro')){console.log('PASS intro music before battle, mute/unmute, no combat SFX during intro');return;}
  await screenshot('intro-versus.png');
  assert.equal(await ev('document.querySelector(".intro-matchup").textContent'), 'SINH VIÊN TMUVSGIÁO TRÌNH');
  assert.ok(await ev('parseFloat(getComputedStyle(document.querySelector(".intro-vs")).fontSize)>=64'),'Large versus title');
  await ev('document.getElementById("start").click()');
  await until('window.GameAudio.status.musicPlaying&&window.GameAudio.status.musicTime>.1');
  await sleep(400);
  assert.deepEqual(await ev('window.GameAudio.status.recent.filter(e=>e.name!=="music-start")'),[],'Only clean music at the start');
  await ev('window.GameAudio.play("get-out")');await sleep(100);
  assert.equal(await ev('window.GameAudio.status.activeEffects'),0,'SFX rejected while reading a question');
  assert.equal(await ev('document.getElementById("music-choice")===null'),true,'Mixed reference audio cannot be selected as background');
  if(process.argv.includes('--hammer-bonk')){
    for(let round=0;round<3;round++){
      await until('document.querySelector(".game").dataset.state==="question"');
      const hammer=await ev('document.querySelector(".game").dataset.playerWeapon==="hammer"');
      if(hammer)await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
      const startTime=await ev('performance.now()');
      await ev(`(()=>{const q=questionPool[${round}];[...document.querySelectorAll('.option')].find(b=>b.dataset.answer===q.answer).click()})()`);
      if(hammer){
        await until('document.querySelector(".game").dataset.hammerStage==="jump"');await sleep(400);
        assert.ok(await ev('new DOMMatrix(getComputedStyle(document.getElementById("player")).transform).m42<-15'),'Student jumps with the hammer');
        assert.ok(await ev('Number(getComputedStyle(document.getElementById("held-prop")).opacity)>.9'),'Hammer stays in the hand');
        await screenshot('hammer-jump.png');
        await until('document.querySelector(".game").dataset.hammerStage==="bonk"');
        assert.ok(await ev('document.getElementById("boss").classList.contains("damage-flash")'),'Boss flashes red on the bonk');
        await sleep(100);await screenshot('hammer-bonk.png');
        await until('!document.getElementById("next").hidden');
        const hits=await ev(`window.GameAudio.status.recent.filter(e=>e.time>=${startTime}&&e.name!=="music-start")`);
        assert.deepEqual(hits.map(e=>e.name),['doge-bonk'],'Only the existing Doge Bonk sound plays');assert.equal(hits[0].rate,1);assert.equal(hits[0].volume,.65*.75);
        assert.equal(await ev('document.getElementById("player").style.transform'),'','Student returns home after the bonk');
        assert.equal(await ev('document.getElementById("held-prop").style.transform'),'','Held hammer resets after attack');
        assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS jumping held hammer, boss hit, original Doge Bonk at unchanged volume/rate, clean return');return;
      }
      await until('!document.getElementById("next").hidden');await ev('document.getElementById("next").click()');
    }
    throw new Error('Hammer was not offered');
  }
  if(process.argv.includes('--tank-finisher')){
    await ev('(()=>{const p=document.getElementById("result");const o=new MutationObserver(()=>{if(!p.hidden){window.__resultShown=performance.now();o.disconnect()}});o.observe(p,{attributes:true,attributeFilter:["hidden"]})})()');
    await ev('document.getElementById("sound").click()');
    for(let round=0;round<3;round++){
      await until('document.querySelector(".game").dataset.state==="question"');
      await ev(`(()=>{const q=questionPool[${round}];[...document.querySelectorAll('.option')].find(b=>b.dataset.answer===q.answer).click()})()`);
      await until('!document.getElementById("next").hidden');
      if(round<2)await ev('document.getElementById("next").click()');
    }
    await ev('document.getElementById("sound").click()');
    await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await ev('document.getElementById("next").click()');
    await until('document.querySelector(".game").dataset.finisherStage==="arrival"');
    await sleep(1250);await screenshot('tank-arrival.png');
    assert.equal(await ev('(()=>{const p=document.querySelector(".tank-driver .meme-face").getBoundingClientRect();return p.left>=0&&p.right<=innerWidth&&p.top>=65})()'),true,'Student face stays visible on the tank');
    await until('document.querySelector(".game").dataset.finisherStage==="flight"');
    await sleep(120);assert.ok(await ev('(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById("boss")).transform);return Math.abs(m.m41)>15&&m.m42<-20})()'),'Boss flies immediately on contact');
    assert.ok(await ev('(()=>{const f=document.getElementById("boss").getAnimations().find(a=>a.effect.getKeyframes().length===33).effect.getKeyframes().map(k=>new DOMMatrix(k.transform));return f[4].m41<0&&f[20].m41>0&&f[16].m42<-150&&f[32].m42>f[16].m42})()'),'Curved flight rises, turns and descends to the right');await screenshot('tank-impact.png');
    assert.equal(await ev('document.getElementById("boss-health").getAttribute("aria-valuenow")'),'0');
    await until('document.querySelector(".game").dataset.finisherStage==="flight"');
    await sleep(220);await screenshot('tank-flight.png');
    await until('!document.getElementById("result").hidden');
    await until('window.GameAudio.status.recent.some(e=>e.name==="yay")');
    const cheer=await ev('(()=>{const y=window.GameAudio.status.recent.filter(e=>e.name==="yay").at(-1);return {offset:y.offset,delay:y.time-window.__resultShown,phase:y.phase}})()');
    assert.equal(cheer.offset,2.8,'Skip the quiet lead-in before the cheer');assert.equal(cheer.phase,'result');assert.ok(cheer.delay>=0&&cheer.delay<250,'Cheer starts with the victory panel');console.log('Yay delay after victory panel:',Math.round(cheer.delay)+'ms');
    assert.equal(await ev('window.GameAudio.status.activeEffects===1'),true,'Only victory cheer remains after the engine fades');
    assert.ok(await ev('window.GameAudio.status.completions.some(e=>e.name==="tank-engine"&&e.reason==="faded")'),'Tank engine fades after the charge');
    assert.deepEqual(await ev('window.GameAudio.status.failures'),[]);
    console.log('Engine opening levels:',await ev('(async()=>{const c=new AudioContext();const b=await c.decodeAudioData(await(await fetch("assets/audio/tank-engine.mp3")).arrayBuffer());const s=b.getChannelData(0),r=b.sampleRate;const peaks=[0,1,2,3,4,5].map(sec=>{let p=0;for(let i=sec*r;i<(sec+1)*r;i+=16)p=Math.max(p,Math.abs(s[i]));return p});await c.close();return peaks})()'));
    await ev('document.getElementById("replay").click()');
    assert.equal(await ev('document.querySelectorAll(".finisher-tank").length'),0,'Replay removes the tank');
    assert.equal(await ev('document.getElementById("player").style.opacity'),'','Replay restores the player');
    assert.equal(errors.length,0,JSON.stringify(errors));
    console.log('PASS tank run-out, visible rider, ram, spinning boss, engine fade, victory and clean replay');return;
  }
  await screenshot('playing-desktop.png');
  for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
    await c('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await sleep(100);
    assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true,'Horizontal overflow at '+width);
    assert.equal(await ev('document.documentElement.scrollHeight<=innerHeight'),true,'Vertical overflow at '+width);
    assert.equal(await ev('document.querySelector(".battle").getBoundingClientRect().width===innerWidth'),true,'Full viewport arena');
    assert.equal(await ev('document.querySelectorAll("#player-hp .heart").length'),10,'Ten pixel hearts');
    assert.equal(await ev('parseFloat(getComputedStyle(document.getElementById("question")).fontSize)>=25'),true,'Presentation question size');
    assert.equal(await ev('parseFloat(getComputedStyle(document.querySelector(".option")).fontSize)>=19'),true,'Presentation answer size');
    assert.equal(await ev('document.querySelector(".masthead")===null'),true,'Title strip removed');
    assert.equal(await ev('document.querySelectorAll(".speech,.reaction,.battle-bottom").length'),0,'No speech, center reaction or bottom status');
    assert.ok((await ev('getComputedStyle(document.getElementById("question")).fontFamily')).includes('Nunito'),'Readable Vietnamese question font');
    assert.ok((await ev('getComputedStyle(document.getElementById("move-banner")).fontFamily')).includes('Baloo'),'Consistent Vietnamese move font');
    assert.ok(await ev('document.getElementById("player").offsetHeight>=195&&document.getElementById("boss").offsetHeight>=195'),'Larger fighters');
    assert.equal(await ev('(()=>{const q=document.getElementById("quiz").getBoundingClientRect();return ["player","boss"].every(id=>{const p=document.getElementById(id).getBoundingClientRect();return p.top+p.height*.55<q.top&&p.top>65})})()'),true,'Enlarged fighters stay visible above the question panel and below the HUD');
  }
  await c('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
  for(let mask=0;mask<(process.argv.includes('--visual-only')?0:8);mask++){
    if(mask>0)await ev('document.getElementById("replay").click()');
    const seenMoves=[];
    for(let round=0;round<3;round++){
      const right=!!(mask&(1<<round));
      assert.equal(await ev(`document.getElementById('question').textContent===questionPool[${round}].question`),true,'Fixed question order');
      assert.equal(await ev(`document.querySelectorAll('.option')[${[0,2,1][round]}].dataset.answer===questionPool[${round}].answer`),true,'Fixed A/C/B answer order');
      await ev(`(()=>{const q=questionPool.find(q=>q.question===document.getElementById('question').textContent);const buttons=[...document.querySelectorAll('.option')];buttons.find(b=>${right?'b.dataset.answer===q.answer':'b.dataset.answer!==q.answer'}).click();buttons[0].click();})()`);
      assert.equal(await ev('[...document.querySelectorAll(".option")].every(b=>b.disabled)'),true);
      await until('!document.getElementById("next").hidden');
      assert.equal(await ev('window.GameAudio.status.activeEffects===window.GameAudio.status.fadingEffects'),true,'Only fading audio tails remain under the explanation');
      if(!right)seenMoves.push(await ev('document.querySelector(".game").dataset.bossMove'));
      assert.equal(await ev(`document.getElementById('${right?'boss':'player'}-meme').hidden`),false,'Meme face on impact');
      assert.equal(await ev('document.querySelectorAll(".option.correct").length'),1);
      assert.equal(await ev('document.getElementById("feedback").hidden'),false);
      await ev('document.getElementById("next").click()');
    if(round<2){assert.equal(await ev('document.querySelector(".game").dataset.state'), 'equipping');assert.equal(await ev('[...document.querySelectorAll(".option")].every(b=>b.disabled)'),true,'Answers locked during weapon spin');await until('document.querySelector(".game").dataset.state==="question"');}
    }
    if(mask===0)assert.deepEqual([...seenMoves].sort(),['bomb','cannon','poison'],'Three distinct boss attacks');
    await until('!document.getElementById("result").hidden');
    const expected=mask.toString(2).split('1').length-1;
    assert.equal(await ev('document.getElementById("result-score").textContent'),`${expected} / 3 câu đúng`);
    assert.equal(await ev('document.getElementById("boss-health").getAttribute("aria-valuenow")==="0"'),expected>=2);
    await ev('document.getElementById("review-toggle").click()');
    assert.equal(await ev('document.querySelectorAll("#review article").length'),3);
    console.log(`PASS ${mask.toString(2).padStart(3,'0')}: ${expected}/3; ${expected>=2?'win + finisher':'loss'}; review`);
  }
  // Exercise normal motion, including the boss's simultaneous flight and rotation.
  await c('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  // See every boss move at normal speed; each question wrong uses a different weapon.
  await ev('document.getElementById("replay").click()');
  for(let round=0;round<3;round++){
    await ev('(()=>{window.__playerHitFilter=null;const p=document.getElementById("player");const o=new MutationObserver(()=>{if(p.classList.contains("damage-flash")){window.__playerHitFilter=getComputedStyle(p).filter;o.disconnect()}});o.observe(p,{attributes:true,attributeFilter:["class"]})})()');
    await ev(`(()=>{const q=questionPool[${round}];[...document.querySelectorAll('.option')].find(b=>b.dataset.answer!==q.answer).click()})()`);
    await until('!document.getElementById("boss-weapon").hidden');
    const move=await ev('document.querySelector(".game").dataset.bossMove');
    if(move==='cannon'){await until('document.querySelectorAll(".grade-shot").length>=3');assert.ok(await ev('document.getElementById("boss-weapon").offsetWidth>=330'),'Enlarged boss cannon');await screenshot('boss-cannon.png');}
    if(move==='bomb'){await until('document.querySelectorAll(".bomb-drop").length>=2');await sleep(280);await screenshot('boss-bomb.png');}
    if(move==='poison'){
      await until('!!document.querySelector(".poison-cloud")');await sleep(160);
      assert.equal(await ev('(()=>{const p=document.getElementById("player").getBoundingClientRect();return [...document.querySelectorAll(".poison-cloud")].some(c=>{const b=c.getBoundingClientRect();return b.right>p.left&&b.left<p.right&&b.bottom>p.top&&b.top<p.bottom})})()'),true,'Poison cloud must overlap the player after the arena transition');
      await screenshot('boss-poison.png');
    }
    await until('!!window.__playerHitFilter');
    assert.ok((await ev('window.__playerHitFilter')).includes('damage-red'));
    await screenshot('player-red-hit.png');
    await until('!document.getElementById("next").hidden');
    if(move==='poison'){
      await sleep(2400);
      assert.ok(await ev('window.GameAudio.status.completions.some(e=>e.name==="glass-break"&&e.position>=e.duration-.15&&["ended","faded"].includes(e.reason))'),'Glass shatter tail gets its full length');
    }
    await ev('document.getElementById("next").click()');
    if(round<2){assert.equal(await ev('document.querySelector(".game").dataset.state'), 'equipping');assert.equal(await ev('[...document.querySelectorAll(".option")].every(b=>b.disabled)'),true,'Answers locked during weapon spin');await until('document.querySelector(".game").dataset.state==="question"');}
  }
  await until('!document.getElementById("result").hidden');
  await ev('document.getElementById("replay").click()');
  const studentWeapons=[];
  for(let round=0;round<3;round++){
    const studentWeapon=await ev('document.querySelector(".game").dataset.playerWeapon');studentWeapons.push(studentWeapon);
    await ev(`(()=>{const q=questionPool.find(q=>q.question===document.getElementById('question').textContent);[...document.querySelectorAll('.option')].find(b=>b.dataset.answer===q.answer).click()})()`);
    await until('document.getElementById("boss").classList.contains("damage-flash")');
    await sleep(140);
    if(studentWeapon==='rocket'){
      assert.ok(await ev('(()=>{const b=document.querySelector(".blast-image");return b&&b.complete&&b.naturalWidth>0&&b.src.includes("explosion-video-cutout")&&getComputedStyle(b).filter==="none"})()'),'RPG blast uses the loaded cutout from the reference video without glow');
      await screenshot('explosion-cutout.png');
    }
    if(studentWeapon==='pan')assert.ok(await ev('Number(getComputedStyle(document.getElementById("projectile")).opacity)>.9'),'Pan remains visible at impact');
    else if(studentWeapon==='hammer')assert.ok(await ev('Number(getComputedStyle(document.getElementById("held-prop")).opacity)>.9'),'Hammer stays held during the bonk');
    else assert.ok(await ev('Number(getComputedStyle(document.getElementById("held-prop")).opacity)>.9'),'RPG stays held while firing');
    await screenshot('student-'+studentWeapon+'.png');
    if(round===0){
      assert.ok((await ev('document.getElementById("player-meme").src')).includes('c7570579fd34f751b5b18fb5ce7ba177'),'New user attack face');
      assert.ok((await ev('document.getElementById("boss-meme").src')).includes('10bce9a2d3097e51cc7937dd769abf97'),'New user reaction face');
      await screenshot('boss-red-hit.png');await screenshot('meme-hit.png');
    }
    await until('!document.getElementById("next").hidden');
    if(studentWeapon==='pan'){
      assert.equal(await ev('window.GameAudio.status.activeEffects===window.GameAudio.status.fadingEffects'),true,'Metal ring gently fades under the explanation');
      await sleep(2500);
      assert.ok(await ev('window.GameAudio.status.completions.some(e=>e.name==="metal-bar"&&e.position>=e.duration-.15&&["ended","faded"].includes(e.reason))'),'Metal Bar is no longer clipped to 0.6 seconds');
    }
    await ev('document.getElementById("next").click()');
    if(round<2){assert.equal(await ev('document.querySelector(".game").dataset.state'), 'equipping');assert.equal(await ev('[...document.querySelectorAll(".option")].every(b=>b.disabled)'),true,'Answers locked during weapon spin');await until('document.querySelector(".game").dataset.state==="question"');}
  }
  assert.deepEqual(studentWeapons.sort(),['hammer','pan','rocket'],'Three upgraded student weapons');
  await until('document.querySelector(".game").dataset.finisherStage==="arrival"');
  await sleep(1250);await screenshot('tank-arrival.png');
  assert.equal(await ev('(()=>{const t=document.querySelector(".finisher-tank"),p=t?.querySelector(".tank-photo");return !!t&&p.complete&&p.naturalWidth>0&&!!t.querySelector(".tank-driver .meme-face")})()'),true,'Tank cutout and student driver are loaded');
  await until('document.querySelector(".game").dataset.finisherStage==="flight"');
  await screenshot('tank-impact.png');
  assert.equal(await ev('document.getElementById("boss-health").getAttribute("aria-valuenow")'), '0','Tank ram finishes the boss');
  await until('document.getElementById("move-banner").textContent.includes("TẠM BIỆT")');
  await sleep(220);await screenshot('finisher.png');
  const flying=await ev('getComputedStyle(document.getElementById("boss")).transform');
  assert.notEqual(flying,'none');await until('!document.getElementById("result").hidden');await sleep(500);await screenshot('victory.png');
  assert.equal(await ev('(()=>{const a=document.getElementById("arena").getBoundingClientRect();const p=document.querySelector(".result-paper").getBoundingClientRect();return p.top>=a.top&&p.bottom<=a.bottom})()'),true,'Result paper must fit inside desktop arena');
  await ev('document.getElementById("sound").click()');
  assert.equal(await ev('document.getElementById("sound").getAttribute("aria-pressed")'),'false');
  assert.equal(await ev('document.getElementById("background-music").paused'),true,'Mute pauses music');
  await ev('document.getElementById("sound").click()');
  await until('window.GameAudio.status.musicPlaying');
  assert.equal(await ev('document.getElementById("sound").getAttribute("aria-pressed")'),'true');
  await ev('document.getElementById("music-volume").value="15";document.getElementById("music-volume").dispatchEvent(new Event("input"));document.getElementById("effects-volume").value="60";document.getElementById("effects-volume").dispatchEvent(new Event("input"))');
  assert.equal(await ev('window.GameAudio.status.musicVolume'),.15);assert.equal(await ev('window.GameAudio.status.effectsVolume'),.6);
  await ev('document.getElementById("music-volume").value="22";document.getElementById("music-volume").dispatchEvent(new Event("input"));document.getElementById("effects-volume").value="75";document.getElementById("effects-volume").dispatchEvent(new Event("input"));document.getElementById("replay").click()');
  await c('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1',windowsVirtualKeyCode:49});
  await c('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1',windowsVirtualKeyCode:49});
  await until('!document.getElementById("next").hidden');
  const soundsPlayed=await ev('window.GameAudio.status.recent.map(e=>e.name)');
  for(const name of ['tank-engine','gun-reload','explosion','potion','boom','yay','metal-bar','doge-bonk','goofy-bonk','flashbang','disappearing-scream','get-out','glass-break'])assert.ok(soundsPlayed.includes(name),'Played sound '+name);
  assert.ok(!soundsPlayed.includes('hurt'),'Only the old oof/hurt sound is removed');
  assert.equal(await ev('window.GameAudio.status.recent.filter(e=>e.name!=="music-start").every(e=>["animating","finishing"].includes(e.phase)||(e.phase==="result"&&e.name==="yay"))'),true,'Every SFX is tied to an action or victory');
  assert.equal(await ev('window.GameAudio.status.recent.filter(e=>e.name!=="music-start").every(e=>e.rate===1)'),true,'Every SFX plays at original speed');
  assert.equal(await ev('document.getElementById("background-music").playbackRate'),1,'Music plays at original speed');
  const finalAudio=await ev('(()=>{const s=window.GameAudio.status;const shout=s.recent.filter(e=>e.name==="get-out"&&e.phase==="finishing").at(-1);const shoutEnd=s.completions.find(e=>e.name==="get-out"&&e.time>shout.time);const hit=s.recent.find(e=>e.name==="boom"&&e.phase==="finishing"&&e.time>=shoutEnd.time);const hitEnd=s.completions.find(e=>e.name==="boom"&&e.time>hit.time);const scream=s.recent.filter(e=>e.name==="disappearing-scream").at(-1);const screamEnd=s.completions.find(e=>e.name==="disappearing-scream"&&e.time>scream.time);const yay=s.recent.filter(e=>e.name==="yay").at(-1);return {shout,shoutEnd,hit,hitEnd,scream,screamEnd,yay}})()');
  assert.ok(finalAudio.shoutEnd.time<=finalAudio.hit.time&&Math.abs(finalAudio.hit.time-finalAudio.scream.time)<120&&finalAudio.screamEnd.time<=finalAudio.yay.time,'GET OUT precedes impact; scream and flight start on impact, then yay');
  assert.equal(finalAudio.shoutEnd.reason,'ended');assert.equal(finalAudio.screamEnd.reason,'ended');
  assert.deepEqual(await ev('window.GameAudio.status.failures'),[],'No media/playback errors');
  const audioInfo=await ev(`(async()=>{const ctx=new AudioContext();const files=['tank-engine','gun-reload','background','vine-boom','explosion','potion','yay','metal-bar','doge-bonk','goofy-bonk','flashbang','disappearing-scream','get-out','glass-break'];const info=[];for(const name of files){const data=await(await fetch('assets/audio/'+name+'.mp3')).arrayBuffer();const buffer=await ctx.decodeAudioData(data);let peak=0;const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i+=16)peak=Math.max(peak,Math.abs(samples[i]));info.push({name,duration:buffer.duration,peak})}await ctx.close();return info})()`);
  assert.equal(audioInfo.length,14);assert.ok(audioInfo.every(a=>a.duration>.05&&a.peak>.005),'All audio files decode and contain sound');
  fs.writeFileSync(path.join(root,'shots','audio-verification.json'),JSON.stringify({played:[...new Set(soundsPlayed)],files:audioInfo,naturalTails:true,finisherSequence:finalAudio,errors:[]},null,2));
  // The user opens index.html directly: media must also work without a dev server.
  await c('Page.navigate',{url:'file:///'+path.join(root,'index.html').replace(/\\/g,'/')});
  await until('!!window.GameAudio&&!!document.getElementById("start")');await ev('document.fonts.ready');
  await ev('document.getElementById("start").click()');
  await until('window.GameAudio.status.musicPlaying&&window.GameAudio.status.musicTime>.1');await sleep(450);
  assert.deepEqual(await ev('window.GameAudio.status.failures'),[],'Local file media works');
  assert.equal(await ev('document.fonts.check("700 32px Arial")'),true,'System Vietnamese font available');
  const layout=await ev('(()=>{const q=document.getElementById("quiz").getBoundingClientRect(),f=document.querySelector(".floor").getBoundingClientRect();return {quizTop:q.top,floorTop:f.top,quizHeight:q.height,state:document.querySelector(".game").dataset.state,offset:getComputedStyle(document.querySelector(".game")).getPropertyValue("--quiz-height")}})()');
  console.log('Local projection layout:',JSON.stringify(layout));
  assert.ok(Math.abs(layout.quizTop-layout.floorTop)<35,'Floor stays immediately above question panel');
  await screenshot('playing-local.png');
  assert.equal(errors.length,0,JSON.stringify(errors));
  fs.writeFileSync(path.join(root,'shots',process.argv.includes('--visual-only')?'visual-verification.json':'verification.json'),JSON.stringify({passed:true,answerPatterns:process.argv.includes('--visual-only')?2:8,fixedAnswers:'A-C-B',desktopWidths:[1440,1280,1024],normalFinisher:true,memeFacesOnly:true,removedChatAndStatus:true,localFonts:['Nunito','Baloo 2'],audioFiles:14,cleanMusicAtStart:true,sfxOnlyDuringActions:true,getOutFinisher:true,pixelHearts:true,bossMoves:['cannon','bomb','poison'],redDamageBoth:true,consoleErrors:errors},null,2));
  console.log('PASS full-length glass/Metal Bar with soft tails, sequential GET OUT/hit/scream/yay, 1x audio, intro background music, upgraded weapons, direct local HTML, A/C/B');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();server?.close();});

