'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['player','boss','arena','intro','result','start','replay','sound','round','question','options','feedback','next','question-number','quiz-hint','player-hp','boss-hp','player-hp-text','boss-hp-text','player-health','boss-health','held-prop','projectile','impact','move-banner','result-title','result-copy','result-score','result-label','review','review-toggle','quiz'].map(id => [id,$(id)]));
  const battle = document.querySelector('.battle');
  const game = document.querySelector('.game');
  const sounds=window.GameAudio;
  const memes = {
    attack: [
      {file:'c7570579fd34f751b5b18fb5ce7ba177',src:'assets/memes/c7570579fd34f751b5b18fb5ce7ba177.jpg',user:true},
      {file:'sigma-cat',caption:'KIẾN THỨC +999 AURA'},
      {file:'sigma-smirk',caption:'NAH, TÔI THUỘC BÀI.'},
      {file:'rock',caption:'BẠN CHẮC CHƯA?'},
      {file:'side-eye',caption:'NHÌN GÌ? NHẬN CHIÊU.'}
    ],
    hurt: [
      {file:'10bce9a2d3097e51cc7937dd769abf97',src:'assets/memes/10bce9a2d3097e51cc7937dd769abf97.jpg',user:true},
      {file:'shocked',caption:'ỦA ALO???'},
      {file:'crying-cat',caption:'ỔN. TÔI VẪN ỔN.'},
      {file:'screaming-cat',caption:'AI CỨU TÔI VỚI!!!'}
    ]
  };
  const memeDecks = {attack:[],hurt:[]};
  const arms = ui.player.querySelector('.arms path');
  const restingArms = arms.getAttribute('d');
  const pose = name => arms.setAttribute('d', name === 'raise' ? 'M65 137 49 83 93 37M174 135 185 78 150 39' : name === 'strike' ? 'M65 137 89 157 126 150M174 135 205 112 237 119' : restingArms);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const weapons = [
    { name:'Búa tạ hủy giáo trình', src:'assets/player-weapons/hammer-cutout.png', kind:'hammer', call:'BÚA TẠ HỦY GIÁO TRÌNH!', impact:'KENG!', sound:'doge-bonk' },
    { name:'Chảo gang phản lực', src:'assets/player-weapons/pan.png', kind:'pan', call:'CHẢO GANG PHẢN LỰC!', impact:'BONK!', sound:'metal-bar' },
    { name:'RPG qua môn', src:'assets/player-weapons/rpg.png', kind:'rocket', call:'RPG QUA MÔN — KHAI HỎA!', impact:'BOOOOM!', sound:'goofy-bonk' }
  ];
  const bossMoves = [
    {kind:'cannon',name:'ĐẠI BÁC ĐIỂM F',src:'assets/boss-weapons/cannon.png',hit:'F! F! F! −34'},
    {kind:'bomb',name:'BOM THI LẠI',src:'assets/boss-weapons/bomb-cutout.png',hit:'BOOOOM! −34'},
    {kind:'poison',name:'ĐỘC TỐ MẤT GỐC',src:'assets/boss-weapons/poison-cutout.png',hit:'POISON! −34'}
  ];
  let bossMoveDeck=[];
  const bossWeapon=$('boss-weapon');
  const effects=$('combat-effects');
  let state = 'intro';
  let questions = [];
  let round = 0;
  let score = 0;
  let playerHp = 100;
  let bossHp = 100;
  let weaponDeck = [];
  let weapon;
  let history = [];
  const activeAnimations = new Set();
  function syncLayout() {
    const openBattle=['intro','result','finishing','animating'].includes(state);
    game.style.setProperty('--quiz-height',openBattle?'80px':(Math.ceil(ui.quiz.getBoundingClientRect().height)+26)+'px');
  }
  function setState(next) { state=next;game.dataset.state=next;sounds.setPhase(next);syncLayout(); }
  function meme(kind,who='player') {
    if(!memeDecks[kind].length)memeDecks[kind]=[...shuffle(memes[kind].filter(m=>!m.user)),...shuffle(memes[kind].filter(m=>m.user))];
    const item=memeDecks[kind].pop();
    const face=$(who+'-meme');
    const cropped=['sigma-cat','sigma-smirk','shocked','rock','crying-cat'].includes(item.file);
    face.src=item.src||`assets/memes/${item.file}${cropped?'-face.png':'.jpg'}`;
    face.hidden=false;ui[who].classList.add('meme-on');
    return item;
  }
  function resetMemes() {
    for(const who of ['player','boss']){$(who+'-meme').hidden=true;ui[who].classList.remove('meme-on');}
  }
  const wait = ms => new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? Math.min(ms, 90) : ms));
  const audioWait = ms => new Promise(resolve => setTimeout(resolve,ms));
  const shuffle = array => {
    const result = [...array];
    for (let i=result.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
    return result;
  };

  function propMarkup(item) {
    return `<img class="prop-image" src="${item.src}" alt="">`;
  }
  function projectileMarkup(item) {return item.kind==='rocket'?'<img class="prop-image" src="assets/player-weapons/rocket-round.png" alt="">':propMarkup(item);}

  function setSound() {
    const soundOn=sounds.setEnabled(!sounds.enabled);
    ui.sound.textContent=`Âm thanh: ${soundOn?'bật':'tắt'}`;
    ui.sound.setAttribute('aria-pressed',String(soundOn));
    ui.sound.title=soundOn?'Tắt âm thanh':'Bật âm thanh';
  }
  async function animate(el, frames, duration, options={}) {
    const animation=el.animate(frames,{duration:reducedMotion.matches?1:duration,easing:'ease-in-out',...options});
    activeAnimations.add(animation);
    try { await animation.finished; } catch (_) { /* Cancelled during a reset. */ }
    activeAnimations.delete(animation);
    // Persist final transforms only when the sequence explicitly requests it.
    if (options.fill==='forwards') animation.commitStyles();
    animation.cancel();
  }
  function health() {
    for (const [who,hp] of [['player',playerHp],['boss',bossHp]]) {
      ui[`${who}-hp`].innerHTML=Array.from({length:10},(_,index)=>{
        const fill=Math.max(0,Math.min(10,hp-index*10));
        return `<span class="heart ${fill===0?'empty':fill<=5?'half':''}" aria-hidden="true"><svg viewBox="0 0 9 8"><path fill="#111" d="M1 0H4V1H5V0H8V1H9V4H8V5H7V6H6V7H5V8H4V7H3V6H2V5H1V4H0V1H1Z"/><path class="heart-color" d="M1 1H3V2H6V1H8V4H7V5H6V6H5V7H4V6H3V5H2V4H1Z"/><path class="heart-shine" fill="#ffb8b8" d="M1 1H3V2H1Z"/></svg></span>`;
      }).join('');
      ui[`${who}-hp-text`].textContent=`${hp} / 100`;
      ui[`${who}-health`].setAttribute('aria-valuenow',hp);
    }
    ui.boss.classList.toggle('wounded',bossHp<100);
  }
  function idle(on) { ui.player.classList.toggle('idle',on); ui.boss.classList.toggle('idle',on); }
  async function redHit(target,duration=600) {
    target.classList.add('damage-flash');
    await wait(duration);
    target.classList.remove('damage-flash');
  }

  function effectNode(tag,className,x,y) {
    const el=document.createElement(tag);el.className=className;el.style.left=x+'px';el.style.top=y+'px';effects.append(el);return el;
  }
  async function explosionAt(x,y,size=310) {
    const blast=effectNode('img','blast-image',x,y);blast.src='assets/boss-weapons/explosion-video-cutout.png';blast.alt='';blast.style.width=size+'px';blast.style.height=size+'px';
    sounds.play('explosion',{volume:size>200?.32:.17});
    await Promise.all([
      animate(blast,[
        {opacity:1,transform:'translate(-50%,-50%) scale(.3) rotate(-7deg)',easing:'steps(2,end)'},
        {opacity:1,transform:'translate(-50%,-50%) scale(1.12) rotate(3deg)',offset:.18,easing:'steps(2,end)'},
        {opacity:1,transform:'translate(-48%,-51%) scale(1) rotate(-3deg)',offset:.46,easing:'steps(2,end)'},
        {opacity:1,transform:'translate(-51%,-50%) scale(1.06) rotate(2deg)',offset:.78,easing:'steps(1,end)'},
        {opacity:0,transform:'translate(-50%,-50%) scale(1.06) rotate(2deg)'}
      ],740),
      (async()=>{if(size>200){await audioWait(300);sounds.play('flashbang',{volume:.16});}})()
    ]);
    blast.remove();
  }
  async function bossAttack(move) {
    game.dataset.bossMove=move.kind;
    ui['move-banner'].textContent=move.name+'!';
    // Let the fighters settle after the question panel leaves the arena.
    // Aim at their battle positions, rather than their earlier reading positions.
    await wait(330);
    bossWeapon.hidden=false;bossWeapon.className='boss-weapon '+move.kind;bossWeapon.innerHTML=`<img src="${move.src}" alt="">`;
    const bx=ui.boss.offsetLeft+ui.boss.offsetWidth*.2;
    const by=ui.boss.offsetTop+ui.boss.offsetHeight*.48;
    const cannonWidth=Math.min(480,Math.max(330,innerWidth*.33));
    const cannonX=bx-cannonWidth*.72,cannonY=by-cannonWidth*.15;
    bossWeapon.style.left=(move.kind==='cannon'?cannonX:bx-20)+'px';bossWeapon.style.top=(move.kind==='cannon'?cannonY:by)+'px';
    const px=ui.player.offsetLeft+ui.player.offsetWidth*.5;
    const py=ui.player.offsetTop+ui.player.offsetHeight*.48;
    await animate(bossWeapon,[{opacity:0,transform:'scale(.3) rotate(15deg)'},{opacity:1,transform:'scale(1) rotate(0)'}],300);
    await wait(180);
    if(move.kind==='cannon') {
      const sx=cannonX+20,sy=cannonY+cannonWidth*.22;
      await Promise.all(Array.from({length:7},async(_,i)=>{
        await audioWait(i*140);
        if(i===0||i===3||i===6)sounds.play('boom',{volume:.11,maxVoices:3});
        const shot=effectNode('span','grade-shot',sx,sy);shot.textContent='F';
        await animate(shot,[{opacity:1,transform:'translate(0,0) rotate(-15deg)'},{opacity:1,transform:`translate(${(px-sx)*.5}px,${(py-sy)*.5-25}px) rotate(${i*31}deg)`,offset:.5},{opacity:1,transform:`translate(${px-sx+(i%3-1)*24}px,${py-sy+(i%2)*20}px) rotate(${i*65}deg)`}],460);
        shot.remove();
      }));
    } else if(move.kind==='bomb') {
      await animate(ui.boss,[{transform:'rotate(3deg)'},{transform:'translateY(-20px) rotate(-16deg)'},{transform:'rotate(3deg)'}],300);
      bossWeapon.hidden=true;
      await Promise.all(Array.from({length:3},async(_,i)=>{
        await wait(i*170);
        const bomb=effectNode('img','bomb-drop',px-100+i*65,-130);bomb.src=move.src;
        await animate(bomb,[{opacity:1,transform:'translateY(0) rotate(-25deg)'},{opacity:1,transform:`translateY(${py+95}px) rotate(${100+i*80}deg)`}],650,{easing:'cubic-bezier(.5,0,.9,.4)'});
        bomb.remove();
      }));
    } else {
      bossWeapon.hidden=true;
      const flask=effectNode('img','poison-projectile',bx,by);flask.src=move.src;
      await animate(flask,[{opacity:1,transform:'translate(0,0) rotate(10deg)'},{opacity:1,transform:`translate(${(px-bx)*.5}px,-160px) rotate(-160deg)`,offset:.5},{opacity:1,transform:`translate(${px-bx-40}px,${py-by}px) rotate(-330deg)`}],750);
      flask.remove();
      sounds.play('glass-break',{volume:.65});
    }
    playerHp=Math.max(0,playerHp-34);health();
    if(move.kind==='poison') {
      const clouds=Array.from({length:6},(_,i)=>{
        const cloud=effectNode('div','poison-cloud',px-95+(i%3)*48,py-60+Math.floor(i/3)*44);
        return animate(cloud,[{opacity:0,transform:'scale(.25)'},{opacity:.9,transform:'scale(1.1)',offset:.25},{opacity:.7,transform:`translate(${(i-2)*15}px,-30px) scale(1.2)`,offset:.7},{opacity:0,transform:`translate(${(i-2)*25}px,-90px) scale(1.5)`}],1200).then(()=>cloud.remove());
      });
      await Promise.all([
        impact(ui.player,move.hit,34),...clouds,
        (async()=>{await audioWait(220);sounds.play('potion',{volume:1});sounds.duck(1500,.04);})()
      ]);
    } else {
      await Promise.all([impact(ui.player,move.hit,34),explosionAt(px,py,move.kind==='bomb'?470:170)]);
    }
    bossWeapon.hidden=true;effects.replaceChildren();
  }

  function start() {
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.clear();
    document.querySelectorAll('.confetti,.flash').forEach(el=>el.remove());
    ui.player.classList.remove('damage-flash');ui.boss.classList.remove('damage-flash');
    resetMemes();memeDecks.attack=[];memeDecks.hurt=[];setState('question'); questions=[...questionPool]; round=0; score=0; playerHp=100; bossHp=100; history=[]; pose('rest');
    bossMoveDeck=shuffle(bossMoves);bossWeapon.hidden=true;effects.replaceChildren();
    weaponDeck=shuffle(weapons); ui.player.removeAttribute('style'); ui.boss.removeAttribute('style');
    ui.projectile.removeAttribute('style'); ui.impact.removeAttribute('style');
    battle.classList.remove('busy','finishing'); ui.arena.classList.remove('shake');
    ui.intro.hidden=true; ui.result.hidden=true; ui.review.hidden=true;
    sounds.begin();
    ui['review-toggle'].setAttribute('aria-expanded','false');
    ui['review-toggle'].textContent='Xem lại đáp án'; ui['move-banner'].textContent='';
    ui.quiz.hidden=false; health(); showQuestion();
  }
  async function showQuestion() {
    const spinning=round>0;
    resetMemes();setState(spinning?'equipping':'question'); idle(!spinning); weapon=weaponDeck[round];
    ui.round.textContent=`LƯỢT ${round+1} / 3`;
    ui['question-number'].textContent=`CÂU 0${round+1} / 03`;
    ui.question.textContent=questions[round].question;
    ui.feedback.hidden=true; ui.feedback.replaceChildren(); ui.next.hidden=true;
    ui['quiz-hint'].textContent='Đúng: boss mất 34 máu. Sai: bạn mất 34 máu. Đủ 2 câu đúng để tung đòn cuối.';
    const equipWeapon=()=>{
      ui['held-prop'].innerHTML=propMarkup(weapon);
      ui['held-prop'].className='held-prop weapon-'+weapon.kind;
      game.dataset.playerWeapon=weapon.kind;
    };
    if(!spinning)equipWeapon();
    ui.options.replaceChildren();
    questions[round].options.forEach((option,index)=>{
      const button=document.createElement('button'); button.type='button'; button.className='option';
      const key=document.createElement('span'); key.className='option-key'; key.textContent='ABCD'[index]; key.setAttribute('aria-hidden','true');
      const text=document.createElement('span'); text.textContent=option;
      button.append(key,text); button.dataset.answer=option;
      button.disabled=spinning;
      button.addEventListener('click',()=>answer(option)); ui.options.append(button);
    });
    syncLayout();
    requestAnimationFrame(syncLayout);
    if(spinning){
      await animate(ui.player,[{transform:'rotate(-2deg)'},{transform:'translateY(-25px) rotate(178deg)'}],290);
      equipWeapon();
      await animate(ui.player,[{transform:'translateY(-25px) rotate(178deg)'},{transform:'rotate(358deg)'}],330);
      idle(true);setState('question');
      for(const button of ui.options.children)button.disabled=false;
      ui.options.querySelector('button').focus({preventScroll:true});
    }
  }
  async function impact(target,text,damage) {
    const bounds=ui.arena.getBoundingClientRect(); const victim=target.getBoundingClientRect();
    ui.impact.style.left=((victim.left-bounds.left+victim.width*.35)/bounds.width*100)+'%';
    ui.impact.textContent=text; ui.arena.classList.remove('shake'); void ui.arena.offsetWidth; ui.arena.classList.add('shake');
    meme('hurt',target===ui.boss?'boss':'player');
    if(target===ui.boss)sounds.play(weapon.sound,{volume:weapon.kind==='rocket'?.4:.65});
    ui.impact.style.top=(target.offsetTop+target.offsetHeight*.3)+'px';
    const force=target===ui.boss?({hammer:58,pan:42,rocket:76}[weapon.kind]||22):-22;
    await Promise.all([
      redHit(target),
      animate(ui.impact,[{opacity:0,transform:'scale(.3) rotate(-15deg)'},{opacity:1,transform:'scale(1.25) rotate(5deg)',offset:.2},{opacity:1,transform:'scale(1) rotate(-8deg)',offset:.7},{opacity:0,transform:'translateY(-28px) scale(.8)'}],600),
      animate(target,[{transform:'translateX(0) rotate(0)'},{transform:`translateX(${force}px) rotate(${target===ui.boss?28:-17}deg) scale(1.12,.82)`,offset:.2},{transform:'translateX(0) rotate(0)'}],500)
    ]);
    ui.arena.classList.remove('shake');
  }
  async function attack(correct) {
    battle.classList.add('busy'); idle(false);
    if (correct) {
      meme('attack','player',false);
      ui['move-banner'].textContent=weapon.call;
      pose('raise');
      if(weapon.kind==='rocket'){
        const reload=sounds.play('gun-reload',{volume:.42,maxVoices:1});
        await Promise.all([
          reload?.finished,
          animate(ui['held-prop'],[{translate:'0 0'},{translate:'-18px 10px',offset:.35},{translate:'0 0'}],650)
        ]);
      }
      await wait(330);
      const startX=ui.player.offsetLeft+ui.player.offsetWidth*(weapon.kind==='rocket'?1.1:.72);
      const startY=ui.player.offsetTop+ui.player.offsetHeight*(weapon.kind==='rocket'?.4:.25);
      const dx=ui.boss.offsetLeft+ui.boss.offsetWidth*.4-startX-90;
      const dy=ui.boss.offsetTop+ui.boss.offsetHeight*.35-startY;
      await animate(ui.player,[{transform:'rotate(-2deg)'},{transform:'translateX(-20px) rotate(-20deg)'},{transform:'translateX(24px) rotate(10deg)'}],420);
      pose('strike');
      ui.projectile.removeAttribute('style');
      ui.projectile.className='projectile projectile-'+weapon.kind;
      ui.projectile.innerHTML=projectileMarkup(weapon);
      ui.projectile.style.left=startX+'px';ui.projectile.style.top=startY+'px';
      if(weapon.kind==='rocket'){
        const muzzle=effectNode('img','muzzle-flash',startX-20,startY-25);muzzle.src='assets/boss-weapons/explosion-cutout.png';
        sounds.play('boom',{volume:.13});
        await Promise.all([
          animate(ui.player,[{transform:'rotate(-2deg)'},{transform:'translateX(-30px) rotate(-13deg)'},{transform:'rotate(-2deg)'}],350),
          animate(ui.projectile,[{opacity:1,transform:'translate(0,0) scale(.9)'},{opacity:1,transform:`translate(${dx}px,${dy}px) scale(1.2)`}],430,{easing:'cubic-bezier(.3,0,.8,.4)'})
        ]);muzzle.remove();
      }else if(weapon.kind==='hammer'){
        await animate(ui.projectile,[{opacity:1,transform:'translate(-90px,-150px) rotate(150deg) scale(1.25)'},{opacity:1,transform:`translate(${dx*.55}px,-210px) rotate(225deg) scale(1.6)`,offset:.45},{opacity:1,transform:`translate(${dx-65}px,${dy-50}px) rotate(330deg) scale(1.8)`}],650,{easing:'cubic-bezier(.6,0,.9,.3)',fill:'forwards'});
      }else{
        await animate(ui.projectile,[{opacity:1,transform:'translate(0,0) rotate(0) scale(1.2)'},{opacity:1,transform:`translate(${dx*.5}px,-100px) rotate(540deg) scale(1.5)`,offset:.5},{opacity:1,transform:`translate(${dx-35}px,${dy-40}px) rotate(1080deg) scale(1.6)`}],650,{fill:'forwards'});
      }
      bossHp=Math.max(0,bossHp-34); health();
      const bx=ui.boss.offsetLeft+ui.boss.offsetWidth*.5,by=ui.boss.offsetTop+ui.boss.offsetHeight*.45;
      if(weapon.kind==='rocket'){
        ui.projectile.style.opacity='0';
        await Promise.all([impact(ui.boss,weapon.impact+' −34',34),explosionAt(bx,by,540)]);
      }else{
        const shock=effectNode('div','shock-ring',bx,ui.boss.offsetTop+ui.boss.offsetHeight*.85);
        await Promise.all([impact(ui.boss,weapon.impact+' −34',34),animate(shock,[{opacity:1,transform:'translate(-50%,-50%) scale(.1)'},{opacity:0,transform:'translate(-50%,-50%) scale(3)'}],650)]);shock.remove();
        if(weapon.kind==='pan')await animate(ui.projectile,[{opacity:1,transform:`translate(${dx-35}px,${dy-40}px) rotate(1080deg) scale(1.6)`},{opacity:1,transform:'translate(0,0) rotate(1800deg) scale(.8)'},{opacity:0,transform:'scale(.5)'}],400);
      }
    } else {
      meme('attack','boss',false);
      await bossAttack(bossMoveDeck[round]);
    }
    pose('rest'); ui.projectile.style.opacity='0'; ui['move-banner'].textContent=''; battle.classList.remove('busy'); idle(true);
  }
  async function answer(selected) {
    if (state!=='question') return;
    setState('animating'); const q=questions[round]; const correct=selected===q.answer;
    if (correct) score++;
    history.push({question:q,selected,correct});
    [...ui.options.children].forEach(button=>{
      button.disabled=true;
      if (button.dataset.answer===q.answer) {button.classList.add('correct');button.setAttribute('aria-label',button.dataset.answer+' — đáp án đúng');}
      else if (button.dataset.answer===selected) {button.classList.add('wrong');button.setAttribute('aria-label',button.dataset.answer+' — bạn chọn sai');}
    });
    await attack(correct);
    const heading=document.createElement('strong'); heading.textContent=correct?'ĐÚNG RỒI. CÚ NÀY CÓ KIẾN THỨC.':'CHƯA ĐÚNG. CHỐT LẠI CHỖ NÀY:';
    const explanation=document.createElement('span'); explanation.textContent=(correct?'':`Đáp án: ${q.answer}. `)+q.explanation;
    ui.feedback.replaceChildren(heading,explanation); ui.feedback.classList.toggle('bad',!correct); ui.feedback.hidden=false;
    ui['quiz-hint'].textContent=`Đã đúng ${score}/${round+1} câu. ${round===2?(score>=2?'Bạn đã đủ lực tung đòn kết liễu.':'Học lại một chút rồi tái đấu nhé.'): 'Đọc lời giải rồi hãy qua lượt tiếp.'}`;
    ui.next.textContent=round===2?(score>=2?'Tung đòn cuối ↗':'Xem kết quả →'):'Lượt tiếp →';
    ui.next.hidden=false; setState('answered'); ui.next.focus({preventScroll:true});
  }
  async function finish() {
    setState('finishing');ui.next.hidden=true; idle(false); battle.classList.add('busy','finishing');
    resetMemes();meme(score>=2?'attack':'hurt','player',false);
    ui.arena.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'});
    if (score>=2) {
      ui.round.textContent='KẾT LIỄU'; ui['move-banner'].textContent='TUYỆT CHIÊU: QUA MÔN THẦN CHƯỞNG!';
      const distance=ui.boss.offsetLeft-ui.player.offsetLeft;
      // Three poses: wind up, hold an absurdly large prop overhead, throw.
      pose('raise');
      await animate(ui.player,[{transform:'rotate(-2deg)'},{transform:'translate(-12px,5px) rotate(-20deg) scale(.95,1.06)'}],480,{fill:'forwards'});
      ui.projectile.removeAttribute('style');ui.projectile.className='projectile projectile-'+weapon.kind;ui.projectile.innerHTML=projectileMarkup(weapon); ui.projectile.style.left=(ui.player.offsetLeft+ui.player.offsetWidth*.45)+'px'; ui.projectile.style.top=(ui.player.offsetTop-20)+'px';
      await animate(ui.projectile,[{opacity:0,transform:'scale(.4) rotate(-40deg)'},{opacity:1,transform:'translateY(-5px) scale(2.1) rotate(-25deg)'}],650,{fill:'forwards'});
      await wait(360);
      ui['move-banner'].textContent='GET OUT!!!';
      const shout=sounds.play('get-out',{volume:.8});await shout?.finished;
      pose('strike');
      await Promise.all([
        animate(ui.player,[{transform:'translate(-12px,5px) rotate(-20deg)'},{transform:'translate(25px,-7px) rotate(23deg)'},{transform:'rotate(-2deg)'}],500,{fill:'forwards'}),
        animate(ui.projectile,[{opacity:1,transform:'scale(2.1) rotate(-25deg)'},{opacity:1,transform:`translate(${distance*.7}px,45px) scale(2.7) rotate(340deg)`}],450,{fill:'forwards'})
      ]);
      pose('rest'); ui.projectile.style.opacity='0'; bossHp=0; health();const finalImpact=sounds.play('boom',{volume:.35});
      const flash=document.createElement('div');flash.className='flash';ui.arena.append(flash);setTimeout(()=>flash.remove(),250);
      ui.impact.style.left='61%';ui.impact.style.top=(ui.boss.offsetTop+ui.boss.offsetHeight*.3)+'px';ui.impact.textContent='QUÁ TAY!';meme('hurt','boss');
      ui.arena.classList.add('shake');
      await Promise.all([
        redHit(ui.boss),
        animate(ui.impact,[{opacity:1,transform:'scale(1.6) rotate(-9deg)'},{opacity:0,transform:'translateY(-30px) scale(1.1) rotate(7deg)'}],650),
        animate(ui.boss,[{transform:'rotate(0) scale(1)'},{transform:'rotate(-18deg) scale(1.3,.65)'},{transform:'translate(10px,-25px) rotate(20deg) scale(.85,1.15)'}],220,{fill:'forwards'})
      ]);
      await finalImpact?.finished;
      ui.arena.classList.remove('shake'); ui['move-banner'].textContent='TẠM BIỆT GIÁO TRÌNH…';
      const scream=sounds.play('disappearing-scream',{volume:.7});
      const fly=Math.max(ui.arena.clientWidth*.7,380);
      await Promise.all([animate(ui.boss,[{opacity:1,transform:'translate(0,-20px) rotate(20deg) scale(1)'},{opacity:1,transform:`translate(${fly*.35}px,-160px) rotate(500deg) scale(.75)`,offset:.4},{opacity:0,transform:`translate(${fly}px,-350px) rotate(1500deg) scale(.12)`}],2400,{fill:'forwards'}),scream?.finished]);
      await audioWait(200); showResult(true);
    } else {
      ui['move-banner'].textContent='GIÁO TRÌNH DÙNG: ĐÈ CHO NHỚ!';
      await animate(ui.boss,[{transform:'rotate(3deg)'},{transform:'translateY(-60px) rotate(-15deg) scale(1.15)'},{transform:`translateX(${-Math.max(50,ui.boss.offsetLeft-ui.player.offsetLeft)}px) rotate(-30deg)`}],700);
      playerHp=0;health();redHit(ui.player,500);
      await animate(ui.player,[{transform:'rotate(-2deg)'},{transform:'translateY(28px) rotate(-85deg) scale(1.1,.7)'}],450,{fill:'forwards'});
      const lossHit=sounds.play('goofy-bonk',{volume:.6});await lossHit?.finished;showResult(false);
    }
  }
  function showResult(won) {
    setState('result');battle.classList.remove('busy','finishing');ui['move-banner'].textContent='';
    if(won)sounds.play('yay',{volume:.85});
    ui.result.hidden=false;ui.round.textContent=won?'QUA MÔN!':'TÁI ĐẤU?';
    ui['result-label'].textContent=won?'GIÁO TRÌNH ĐÃ RỜI CUỘC CHƠI':'GIÁO TRÌNH 1 — SINH VIÊN 0';
    ui['result-title'].textContent=won?(score===3?'QUÁ LÀ THUỘC!':'QUA MÔN RỒI!'):'BỊ SÁCH ĐÈ.';
    ui['result-copy'].textContent=won?'Boss đang trên đường tới một học kỳ khác.':'Không sao. Xem lại đáp án, đứng dậy làm ván nữa.';
    ui['result-score'].textContent=`${score} / 3 câu đúng`;
    ui.replay.focus({preventScroll:true});buildReview();
    if(won&&!reducedMotion.matches) for(let i=0;i<22;i++){
      const piece=document.createElement('i');piece.className='confetti';piece.style.left=Math.random()*100+'%';piece.style.background=['#ed673b','#3a7967','#d6b95f'][i%3];piece.style.setProperty('--drift',(Math.random()*140-70)+'px');piece.style.animationDelay=Math.random()*.5+'s';ui.arena.append(piece);setTimeout(()=>piece.remove(),2300);
    }
  }
  function buildReview() {
    ui.review.replaceChildren();
    const close=document.createElement('button');close.className='review-close';close.textContent='Đóng ×';close.addEventListener('click',()=>ui['review-toggle'].click());ui.review.append(close);
    history.forEach((item,index)=>{
      const article=document.createElement('article');const h=document.createElement('h3');h.textContent=`${index+1}. ${item.question.question}`;
      const selected=document.createElement('p');selected.textContent=`Bạn chọn: ${item.selected} (${item.correct?'đúng':'sai'})`;
      const answer=document.createElement('p');answer.className='review-answer';answer.textContent='Đáp án đúng: '+item.question.answer;
      const why=document.createElement('p');why.textContent=item.question.explanation;article.append(h,selected,answer,why);ui.review.append(article);
    });
  }
  ui.start.addEventListener('click',start);ui.replay.addEventListener('click',start);ui.sound.addEventListener('click',setSound);
  $('music-volume').addEventListener('input',event=>sounds.setMusicVolume(Number(event.target.value)/100));
  $('effects-volume').addEventListener('input',event=>sounds.setEffectsVolume(Number(event.target.value)/100));
  ui.next.addEventListener('click',()=>{if(state!=='answered')return;if(round===2){finish();}else{round++;showQuestion();}});
  ui['review-toggle'].addEventListener('click',()=>{
    ui.review.hidden=!ui.review.hidden;ui['review-toggle'].setAttribute('aria-expanded',String(!ui.review.hidden));ui['review-toggle'].textContent=ui.review.hidden?'Xem lại đáp án':'Ẩn đáp án';
    if(!ui.review.hidden)ui.review.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
  });
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(state==='question'&&/^[1-4]$/.test(event.key)){event.preventDefault();ui.options.children[Number(event.key)-1]?.click();}
  });
  // Decode prop images before the first attack so they never enter as empty frames.
  [...weapons.map(w=>w.src),'assets/player-weapons/rocket-round.png','assets/tmu-uniform-source.jpg','assets/boss-book.jpg','assets/boss-weapons/explosion-cutout.png','assets/boss-weapons/explosion-video-cutout.png',...bossMoves.map(m=>m.src),...Object.values(memes).flatMap(pool=>pool.map(m=>m.src||`assets/memes/${m.file}${['sigma-cat','sigma-smirk','shocked','rock','crying-cat'].includes(m.file)?'-face.png':'.jpg'}`))].forEach(src=>{const image=new Image();image.src=src;});
  new ResizeObserver(syncLayout).observe(ui.quiz);
  window.addEventListener('resize',syncLayout);
  health();setState('intro');idle(true);
})();

