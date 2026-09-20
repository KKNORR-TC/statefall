(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const C = {
    water: '#183b40', deep: '#102b32', land: '#59604b', high: '#777158', forest: '#263b31',
    charcoal: '#182126', navy: '#24343d', ivory: '#d9d7c7', brass: '#c2a66e',
    friendly: '#6fa6a0', hostile: '#b96558', warning: '#c88e54', shadow: 'rgba(2,8,11,.5)'
  };
  const ANCHORS = Object.freeze({
    destroyer: Object.freeze({x: 335, y: 405}), submarine: Object.freeze({x: 620, y: 637}),
    fighter: Object.freeze({x: 555, y: 230}), bomber: Object.freeze({x: 710, y: 327}),
    bastion: Object.freeze({x: 850, y: 478}), radar: Object.freeze({x: 930, y: 162}),
    support: Object.freeze({x: 947, y: 677}), interceptor: Object.freeze({x: 778, y: 163})
  });
  const PHASE = Object.freeze({destroyer: 317, shipLight: 911, submarine: 1483, radar: 2279, support: 613, projectile: 401});

  function cycle(time, period, offset = 0) {
    return ((time + offset) % period + period) % period / period;
  }

  function animationState(time, reducedMotion) {
    const rollClock = cycle(time, 12000);
    const rollActive = !reducedMotion && rollClock >= .6 && rollClock < .8;
    const rollProgress = rollActive ? (rollClock - .6) / .2 : 0;
    return Object.freeze({
      time,
      reducedMotion,
      radarAngle: reducedMotion ? 0 : cycle(time, 5200, PHASE.destroyer) * TAU,
      wakePhase: reducedMotion ? 0 : cycle(time, 3400, PHASE.destroyer) * TAU,
      shipNavLight: reducedMotion ? false : cycle(time, 1800, PHASE.shipLight) < .13,
      dishAngle: reducedMotion ? 0 : cycle(time, 6800, PHASE.radar) * TAU,
      aircraftNavLight: reducedMotion ? false : cycle(time, 2100, PHASE.shipLight + 733) < .12,
      sonarAngle: reducedMotion ? 0 : cycle(time, 7600, PHASE.submarine) * TAU,
      bubblePhase: reducedMotion ? 0 : cycle(time, 2700, PHASE.submarine),
      supportBeacon: reducedMotion ? false : cycle(time, 1500, PHASE.support) < .18,
      projectileProgress: reducedMotion ? .5 : cycle(time, 2400, PHASE.projectile),
      fighterRollActive: rollActive,
      fighterRollProgress: rollProgress,
      bomberBank: reducedMotion ? 0 : Math.sin(cycle(time, 9400, 1703) * TAU) * .16
    });
  }

  function rng(seed) {
    let state = seed >>> 0;
    return () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
  }

  function fitCanvas(canvas) {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
    const ctx = canvas.getContext('2d', {alpha: false});
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return {ctx, w: bounds.width, h: bounds.height, dpr};
  }

  function path(ctx, points, close = true) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (close) ctx.closePath();
  }

  function withUnit(ctx, x, y, angle, scale, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.shadowColor = C.shadow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    draw(ctx);
    ctx.restore();
  }

  function hullGradient(ctx, width = 70) {
    const gradient = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
    gradient.addColorStop(0, '#53616a');
    gradient.addColorStop(.42, C.navy);
    gradient.addColorStop(1, '#101a20');
    return gradient;
  }

  function drawDestroyer(ctx, x, y, angle, state) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(202,220,211,.36)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wake = Math.sin(state.wakePhase + i * .8) * 3;
      ctx.beginPath(); ctx.moveTo(-72 - i * 12, -8 - i * 3); ctx.quadraticCurveTo(-112 - i * 10, -23 - wake, -151 - i * 8, -13 - i * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-72 - i * 12, 8 + i * 3); ctx.quadraticCurveTo(-112 - i * 10, 23 + wake, -151 - i * 8, 13 + i * 2); ctx.stroke();
    }
    ctx.restore();
    withUnit(ctx, x, y, angle, 1, unit => {
      path(unit, [[88,0],[57,-17],[-58,-20],[-82,-10],[-88,0],[-80,11],[-56,20],[56,16]]);
      unit.fillStyle = hullGradient(unit); unit.fill(); unit.strokeStyle = '#879097'; unit.lineWidth = 1; unit.stroke();
      path(unit, [[55,-13],[35,-10],[-47,-12],[-64,-6],[-64,6],[-47,12],[35,10],[55,13]]);
      unit.fillStyle = '#34434a'; unit.fill();
      unit.fillStyle = C.ivory; unit.fillRect(-10,-7,31,14); unit.fillStyle = '#8e968d'; unit.fillRect(-2,-12,14,24);
      unit.fillStyle = C.charcoal; unit.fillRect(0,-15,4,30); unit.fillRect(17,-3,28,6);
      unit.strokeStyle = C.ivory; unit.lineWidth = 2; unit.beginPath(); unit.moveTo(5,-15); unit.lineTo(5,-31); unit.lineTo(20,-23); unit.stroke();
      unit.fillStyle = C.brass; unit.beginPath(); unit.arc(45,0,7,0,TAU); unit.fill();
      unit.fillStyle = C.friendly; unit.fillRect(-57,-20,30,4);
      unit.strokeStyle = '#aeb5ad'; unit.lineWidth = 1; unit.beginPath(); unit.moveTo(-35,-12); unit.lineTo(-35,12); unit.stroke();
      unit.save(); unit.translate(5,-23); unit.rotate(state.radarAngle); unit.strokeStyle='#d8d7c9'; unit.beginPath(); unit.moveTo(-11,0); unit.lineTo(11,0); unit.stroke(); unit.restore();
      if (state.shipNavLight) { unit.fillStyle='#bce8df'; unit.shadowColor='#9fe4da'; unit.shadowBlur=9; unit.beginPath(); unit.arc(-35,-15,2.5,0,TAU); unit.fill(); }
    });
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = C.brass; ctx.lineWidth = 1.25; ctx.setLineDash([3,5]); ctx.beginPath(); ctx.arc(0,0,112,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0,0,101,-.2,.55); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(93,39); ctx.lineTo(205,86); ctx.lineTo(220,76); ctx.strokeStyle = 'rgba(194,166,110,.82)'; ctx.lineWidth = 1.3; ctx.stroke(); ctx.restore();
  }

  function drawSubmarine(ctx, x, y, angle, state) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(123,193,187,.25)'; ctx.lineWidth = 1; ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.ellipse(0,0,88,31,0,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0,0,105,43,0,0,TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = .58;
    path(ctx, [[71,0],[42,-11],[-42,-12],[-72,0],[-42,12],[42,11]]); ctx.fillStyle = '#263b43'; ctx.fill(); ctx.strokeStyle = '#9db5b2'; ctx.stroke();
    ctx.fillStyle = '#77898a'; ctx.fillRect(-8,-13,17,7); ctx.fillRect(-1,-20,3,9); ctx.fillStyle=C.hostile;ctx.fillRect(22,-10,18,3);
    ctx.globalAlpha = 1; ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.rotate(state.sonarAngle);ctx.strokeStyle='rgba(110,212,198,.34)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,52,-.22,.22);ctx.closePath();ctx.stroke();ctx.restore();
    // A torpedo is a tiny physical projectile with a long, tapering bubble trail.
    ctx.save(); ctx.strokeStyle='rgba(204,220,207,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+55,y-29);ctx.quadraticCurveTo(x+112,y-59,x+174,y-48);ctx.stroke();
    for(let i=0;i<6;i++){const drift=(state.bubblePhase+i/6)%1;ctx.fillStyle=`rgba(204,220,207,${.12+.3*(1-drift)})`;ctx.beginPath();ctx.arc(x+65+drift*106,y-31-drift*14,1+drift*2,0,TAU);ctx.fill();}
    ctx.fillStyle=C.ivory;ctx.translate(x+181,y-46);ctx.rotate(.18);path(ctx,[[9,0],[-6,-2],[-10,0],[-6,2]]);ctx.fill();ctx.restore();
  }

  function drawAircraft(ctx, x, y, angle, bomber, hostile, state) {
    const roll = !bomber && state.fighterRollActive ? state.fighterRollProgress : 0;
    const transit = roll ? Math.sin(roll * Math.PI * 2) : 0;
    const px = x + transit * 8;
    const py = y + (roll ? Math.sin(roll * Math.PI) * 3 : 0);
    const wingScale = bomber ? 1 - Math.abs(state.bomberBank) * .65 : (roll ? .18 + .82 * Math.abs(Math.cos(roll * Math.PI)) : 1);
    const shadowShift = bomber ? state.bomberBank * 22 : transit * 7;
    withUnit(ctx, px + 7, py + 9 + shadowShift, angle, 1, unit => {
      unit.globalAlpha = .28; unit.fillStyle = '#000';
      const wing = bomber ? [[55,0],[11,-10],[-22,-39],[-40,-35],[-26,-8],[-54,-4],[-61,0],[-54,4],[-26,8],[-40,35],[-22,39],[11,10]] : [[49,0],[7,-8],[-16,-30],[-34,-25],[-22,-5],[-47,-2],[-51,0],[-47,2],[-22,5],[-34,25],[-16,30],[7,8]];
      unit.scale(1,wingScale);path(unit, wing); unit.fill();
    });
    withUnit(ctx, px, py, angle, 1, unit => {
      const wing = bomber ? [[55,0],[11,-10],[-22,-39],[-40,-35],[-26,-8],[-54,-4],[-61,0],[-54,4],[-26,8],[-40,35],[-22,39],[11,10]] : [[49,0],[7,-8],[-16,-30],[-34,-25],[-22,-5],[-47,-2],[-51,0],[-47,2],[-22,5],[-34,25],[-16,30],[7,8]];
      unit.save();unit.scale(1,wingScale);path(unit, wing); unit.fillStyle = hullGradient(unit, 65); unit.fill(); unit.strokeStyle='#9da39e';unit.lineWidth=1;unit.stroke();unit.restore();
      path(unit, [[48,0],[4,-4],[-45,-2],[-51,0],[-45,2],[4,4]]); unit.fillStyle='#b8b9ae';unit.globalAlpha=.72;unit.fill();unit.globalAlpha=1;
      if(roll){const highlight=-20+roll*55;unit.strokeStyle='rgba(244,239,205,.78)';unit.lineWidth=2.2;unit.beginPath();unit.moveTo(highlight,-3);unit.lineTo(highlight+15,0);unit.lineTo(highlight,3);unit.stroke();}
      unit.fillStyle = hostile ? C.hostile : C.friendly; unit.fillRect(-27,-(bomber?37:28),20,4); unit.fillRect(-27,(bomber?33:24),20,4);
      unit.fillStyle='#111b21';unit.beginPath();unit.ellipse(18,0,9,3,0,0,TAU);unit.fill();
      if(state.aircraftNavLight){unit.fillStyle=hostile?'#ee8b79':'#a8eee2';unit.shadowColor=unit.fillStyle;unit.shadowBlur=8;unit.beginPath();unit.arc(-19,-(bomber?36:27),2.3,0,TAU);unit.fill();}
    });
    ctx.save();ctx.translate(px,py);ctx.rotate(angle);ctx.strokeStyle='rgba(213,218,204,.28)';ctx.lineWidth=1.4;
    ctx.beginPath();for(let trail=-51;trail>=-132;trail-=5){const cork=roll?Math.sin((trail+132)*.22+roll*TAU)*5:0;trail===-51?ctx.moveTo(trail,-3+cork):ctx.lineTo(trail,-3+cork);}ctx.stroke();ctx.beginPath();for(let trail=-51;trail>=-132;trail-=5){const cork=roll?Math.sin((trail+132)*.22+roll*TAU+Math.PI)*5:0;trail===-51?ctx.moveTo(trail,3+cork):ctx.lineTo(trail,3+cork);}ctx.stroke();ctx.restore();
    if (hostile) {
      ctx.save();ctx.translate(x,y);ctx.strokeStyle=C.hostile;ctx.lineWidth=1.5;const r=58;
      [[-r,-r,12,0,0,12],[r,-r,-12,0,0,12],[-r,r,12,0,0,-12],[r,r,-12,0,0,-12]].forEach(([a,b,c,d,e,f])=>{ctx.beginPath();ctx.moveTo(a+c,b+d);ctx.lineTo(a,b);ctx.lineTo(a+e,b+f);ctx.stroke();});ctx.restore();
    }
  }

  function drawBastion(ctx, x, y) {
    withUnit(ctx,x,y,-.13,1,unit=>{
      unit.fillStyle='#2a3431';unit.fillRect(-44,-28,88,56);unit.strokeStyle='#989b84';unit.strokeRect(-44,-28,88,56);
      unit.fillStyle='#59604e';unit.fillRect(-34,-19,47,38);unit.fillStyle='#172126';unit.fillRect(-25,-11,29,22);
      unit.fillStyle=C.brass;unit.beginPath();unit.arc(6,0,10,0,TAU);unit.fill();unit.fillStyle='#222c2f';unit.beginPath();unit.arc(6,0,7,0,TAU);unit.fill();
      unit.fillStyle='#252e30';unit.fillRect(8,-4,49,8);unit.fillRect(8,8,44,7);unit.fillStyle=C.friendly;unit.fillRect(-44,24,27,4);
    });
  }

  function drawRadar(ctx,x,y,state) {
    withUnit(ctx,x,y,.05,1,unit=>{
      unit.fillStyle='#25302e';unit.fillRect(-35,-25,70,50);unit.strokeStyle='#8d917e';unit.strokeRect(-35,-25,70,50);
      unit.fillStyle='#161f22';unit.fillRect(-24,-14,26,28);unit.fillStyle='#687069';unit.fillRect(8,-18,17,36);
      unit.strokeStyle=C.ivory;unit.lineWidth=2;unit.beginPath();unit.moveTo(16,-18);unit.lineTo(16,-42);unit.stroke();
      unit.beginPath();unit.ellipse(16,-43,17,6,-.2,0,TAU);unit.stroke();unit.fillStyle=C.hostile;unit.fillRect(-35,-25,24,4);
      unit.save();unit.translate(16,-43);unit.rotate(state.dishAngle);unit.strokeStyle='#d6d4c3';unit.lineWidth=1.5;unit.beginPath();unit.moveTo(-18,0);unit.lineTo(18,0);unit.stroke();unit.restore();
    });
  }

  function drawSupport(ctx,x,y,state) {
    withUnit(ctx,x,y,-.15,1,unit=>{
      unit.fillStyle='#1b2526';unit.fillRect(-37,-20,74,40);unit.strokeStyle='#929587';unit.strokeRect(-37,-20,74,40);
      unit.fillStyle='#4e5850';unit.fillRect(-28,-14,33,28);unit.fillStyle='#303d3c';unit.fillRect(9,-14,21,28);
      unit.fillStyle=C.ivory;unit.fillRect(-21,-3,18,6);unit.fillRect(-15,-9,6,18);unit.fillStyle=C.friendly;unit.fillRect(10,-14,20,3);
      unit.fillStyle='#0b1113';[-25,20].forEach(px=>[-19,19].forEach(py=>{unit.beginPath();unit.arc(px,py,6,0,TAU);unit.fill();}));
      unit.fillStyle=state.supportBeacon?C.warning:'#604b37';unit.shadowColor=C.warning;unit.shadowBlur=state.supportBeacon?12:0;unit.fillRect(19,-18,8,4);
    });
    ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(35,38,36,.48)';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-23+i*6,-34-i*9,8+i*2,0,TAU);ctx.fill();}ctx.restore();
    ctx.strokeStyle=C.warning;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-37,y+33);ctx.lineTo(x-13,y+33);ctx.moveTo(x-7,y+33);ctx.lineTo(x+6,y+33);ctx.stroke();
  }

  function callout(ctx, text, x, y, tx, ty, align = 'left') {
    ctx.save();ctx.strokeStyle='rgba(216,208,179,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.lineTo(tx+(align==='left'?18:-18),ty);ctx.stroke();
    ctx.fillStyle='rgba(8,17,20,.82)';const width=ctx.measureText(text).width+14;ctx.fillRect(align==='left'?tx+18:tx-18-width,ty-9,width,18);
    ctx.fillStyle=C.ivory;ctx.font='600 8px Arial';ctx.textAlign=align;ctx.fillText(text,align==='left'?tx+25:tx-25,ty+3);ctx.restore();
  }

  function drawMap(canvas,state) {
    const {ctx,w,h,dpr}=fitCanvas(canvas);const sx=w/1080,sy=h/812;ctx.save();ctx.scale(sx,sy);const random=rng(50401);
    const sea=ctx.createLinearGradient(0,0,1080,812);sea.addColorStop(0,C.deep);sea.addColorStop(1,C.water);ctx.fillStyle=sea;ctx.fillRect(0,0,1080,812);
    for(let i=0;i<13;i++){ctx.beginPath();for(let x=-30;x<1110;x+=20){const y=25+i*64+Math.sin(x*.011+i*.8)*13;(x===-30?ctx.moveTo(x,y):ctx.lineTo(x,y));}ctx.strokeStyle='rgba(108,151,145,.10)';ctx.stroke();}
    const coast=[[1080,0],[807,0],[825,83],[786,140],[827,212],[804,270],[850,330],[829,401],[878,456],[846,520],[890,580],[866,650],[910,710],[896,812],[1080,812]];
    path(ctx,coast);ctx.fillStyle=C.land;ctx.fill();ctx.strokeStyle='#273a36';ctx.lineWidth=18;ctx.stroke();ctx.strokeStyle='rgba(214,207,175,.58)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.save();path(ctx,coast);ctx.clip();const light=ctx.createLinearGradient(790,0,1080,812);light.addColorStop(0,'rgba(188,171,119,.18)');light.addColorStop(1,'rgba(16,28,25,.35)');ctx.fillStyle=light;ctx.fillRect(760,0,320,812);
    for(let i=0;i<110;i++){ctx.fillStyle=random()>.45?'rgba(25,50,38,.35)':'rgba(205,191,137,.08)';ctx.beginPath();ctx.arc(820+random()*280,random()*812,2+random()*7,0,TAU);ctx.fill();}ctx.restore();
    ctx.fillStyle='rgba(105,65,55,.13)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(650,0);ctx.bezierCurveTo(580,165,700,235,781,286);ctx.lineTo(820,180);ctx.lineTo(807,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(69,121,107,.10)';ctx.beginPath();ctx.moveTo(0,812);ctx.lineTo(896,812);ctx.lineTo(902,690);ctx.bezierCurveTo(660,640,510,690,330,812);ctx.closePath();ctx.fill();
    for(let i=0;i<1900;i++){ctx.fillStyle=random()>.5?'rgba(221,224,203,.025)':'rgba(3,11,13,.045)';ctx.fillRect(random()*1080,random()*812,1,1);}
    ctx.font='600 10px Georgia';ctx.fillStyle='rgba(178,199,190,.31)';ctx.letterSpacing='3px';ctx.fillText('SABLE APPROACH',337,178);ctx.fillStyle='rgba(222,215,187,.33)';ctx.fillText('CAIRN COAST',899,386);

    drawDestroyer(ctx,ANCHORS.destroyer.x,ANCHORS.destroyer.y,-.18,state);
    drawSubmarine(ctx,ANCHORS.submarine.x,ANCHORS.submarine.y,-.30,state);
    drawAircraft(ctx,ANCHORS.fighter.x,ANCHORS.fighter.y,-.38,false,false,state);
    drawAircraft(ctx,ANCHORS.bomber.x,ANCHORS.bomber.y,.18,true,true,state);
    drawBastion(ctx,ANCHORS.bastion.x,ANCHORS.bastion.y);
    drawRadar(ctx,ANCHORS.radar.x,ANCHORS.radar.y,state);
    drawSupport(ctx,ANCHORS.support.x,ANCHORS.support.y,state);
    // SAM launch and interceptor: a controlled trajectory, not a neon beam.
    ctx.strokeStyle='rgba(216,207,179,.62)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(916,139);ctx.quadraticCurveTo(860,86,775,166);ctx.stroke();
    ctx.strokeStyle='rgba(198,142,84,.35)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(913,141);ctx.lineTo(889,115);ctx.stroke();
    const projectileX=ANCHORS.interceptor.x+(state.projectileProgress-.5)*26;
    const projectileY=ANCHORS.interceptor.y-(state.projectileProgress-.5)*18;
    ctx.save();ctx.translate(projectileX,projectileY);ctx.rotate(-.68);ctx.fillStyle=C.ivory;path(ctx,[[13,0],[-7,-3],[-12,0],[-7,3]]);ctx.fill();ctx.fillStyle=C.hostile;ctx.fillRect(-6,-3,5,6);ctx.restore();

    ctx.font='600 8px Arial';
    callout(ctx,'SELECTED · DDG 17',337,300,208,269,'left');
    callout(ctx,'NORMAL · FIGHTER',548,185,438,130,'left');
    callout(ctx,'HOSTILE / TARGETED · BOMBER',710,268,603,242,'left');
    callout(ctx,'DETECTED BELOW THERMOCLINE',619,596,476,552,'left');
    callout(ctx,'COASTAL BASTION',850,435,932,420,'right');
    callout(ctx,'SAM · ACTIVE LAUNCH',925,112,1016,83,'right');
    callout(ctx,'DISABLED SUPPORT',946,625,1035,605,'right');
    ctx.restore();
    return {width:canvas.width,height:canvas.height,cssWidth:w,cssHeight:h,dpr};
  }

  function drawScale(canvas) {
    const {ctx,w,h,dpr}=fitCanvas(canvas);ctx.fillStyle='#10292e';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(105,153,146,.12)';for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,20+i*37);ctx.quadraticCurveTo(w*.5,5+i*41,w,21+i*36);ctx.stroke();}
    ctx.fillStyle='#57604c';ctx.beginPath();ctx.moveTo(w*.79,0);ctx.lineTo(w,0);ctx.lineTo(w,h);ctx.lineTo(w*.68,h);ctx.quadraticCurveTo(w*.81,h*.72,w*.72,h*.5);ctx.quadraticCurveTo(w*.84,h*.23,w*.79,0);ctx.fill();
    const ship=(x,y,a,color)=>{ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=color;path(ctx,[[12,0],[5,-3],[-10,-2],[-13,0],[-10,2],[5,3]]);ctx.fill();ctx.restore();};
    ship(w*.29,h*.36,-.2,C.ivory);ship(w*.47,h*.67,-.35,'#91a8a2');
    ctx.fillStyle=C.hostile;path(ctx,[[w*.57+8,h*.24],[w*.57-5,h*.24-6],[w*.57-2,h*.24],[w*.57-5,h*.24+6]]);ctx.fill();
    ctx.strokeStyle=C.brass;ctx.lineWidth=1;ctx.beginPath();ctx.arc(w*.29,h*.36,19,0,TAU);ctx.stroke();
    return {width:canvas.width,height:canvas.height,cssWidth:w,cssHeight:h,dpr};
  }

  const unitCanvas=document.querySelector('#unit-map');
  const scaleCanvas=document.querySelector('#scale-map');
  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentState=animationState(0,motionQuery.matches);
  let frameId=0;
  let fixedTime=null;
  let lastFrame=-Infinity;

  function render(time) {
    currentState=animationState(time,motionQuery.matches);
    window.__UNIT_DIRECTION_METRICS__.operational=drawMap(unitCanvas,currentState);
  }

  function tick(time) {
    if(fixedTime!==null||motionQuery.matches)return;
    if(time-lastFrame>=33){render(time);lastFrame=time;}
    frameId=requestAnimationFrame(tick);
  }

  function startLive() {
    if(frameId)cancelAnimationFrame(frameId);
    frameId=0;
    if(!motionQuery.matches&&fixedTime===null)frameId=requestAnimationFrame(tick);
  }

  function onMotionChange() {
    if(fixedTime===null)render(performance.now());else render(fixedTime);
    startLive();
  }

  window.__UNIT_DIRECTION_METRICS__={operational:null,scale:drawScale(scaleCanvas)};
  render(0);
  const animationApi={
    anchors: ANCHORS,
    get state(){return currentState;},
    getState(){return currentState;},
    setFixedTime(time){
      if(!Number.isFinite(time))throw new TypeError('Fixed review time must be finite');
      fixedTime=time;
      if(frameId)cancelAnimationFrame(frameId);
      frameId=0;
      render(time);
      return currentState;
    },
    resume(){fixedTime=null;lastFrame=-Infinity;startLive();}
  };
  window.__UNIT_DIRECTION_ANIMATION__=animationApi;
  motionQuery.addEventListener('change',onMotionChange);
  window.addEventListener('unload',()=>{if(frameId)cancelAnimationFrame(frameId);motionQuery.removeEventListener('change',onMotionChange);},{once:true});
  startLive();
  window.__UNIT_DIRECTION_READY__=true;
})();
