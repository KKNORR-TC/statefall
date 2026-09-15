(() => {
  'use strict';

  const canvas = document.querySelector('#map');
  const context = canvas.getContext('2d');
  const WORLD = {width: 1600, height: 900};

  function path(points) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1]);
    context.closePath();
  }

  function poly(points, fill, stroke, width = 1) {
    path(points);
    context.fillStyle = fill;
    context.fill();
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = width; context.stroke(); }
  }

  function ellipse(x, y, rx, ry, fill, rotation = 0) {
    context.beginPath(); context.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    context.fillStyle = fill; context.fill();
  }

  function line(points, stroke, width = 1, dash = []) {
    context.beginPath(); context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1]);
    context.strokeStyle = stroke; context.lineWidth = width; context.setLineDash(dash); context.stroke(); context.setLineDash([]);
  }

  function drawWater() {
    const gradient = context.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    gradient.addColorStop(0, '#17383d'); gradient.addColorStop(.45, '#28575b'); gradient.addColorStop(1, '#102f38');
    context.fillStyle = gradient; context.fillRect(0, 0, WORLD.width, WORLD.height);
    for (let y = 25; y < WORLD.height; y += 34) {
      const alpha = 0.04 + ((y / 34) % 3) * .012;
      for (let x = -40; x < WORLD.width; x += 116) {
        context.beginPath();
        context.moveTo(x + (y % 67), y);
        context.bezierCurveTo(x + 24, y - 7, x + 50, y + 6, x + 78, y - 1);
        context.strokeStyle = `rgba(205,232,218,${alpha})`; context.lineWidth = 2; context.stroke();
      }
    }
    ellipse(1070, 470, 360, 240, 'rgba(80,145,143,.12)', -.3);
    ellipse(1130, 745, 440, 155, 'rgba(4,25,34,.19)', .08);
  }

  function drawLand() {
    const north = [[-30,-30],[1010,-30],[1000,58],[932,78],[893,128],[824,137],[783,194],[712,205],[674,261],[588,275],[549,327],[466,343],[431,401],[349,418],[304,477],[226,497],[184,557],[95,579],[-30,574]];
    const island = [[-20,650],[85,627],[185,652],[250,700],[344,720],[414,778],[477,804],[510,930],[-20,930]];
    context.shadowColor = '#02090b88'; context.shadowBlur = 18; context.shadowOffsetY = 10;
    poly(north, '#566450', '#9b9d7b', 4); poly(island, '#465e50', '#9a9e79', 4);
    context.shadowColor = 'transparent';
    poly(north, 'rgba(165,88,61,.25)');
    poly(island, 'rgba(52,144,135,.33)');
    line(north.slice(4, -1), 'rgba(224,218,172,.35)', 11);
    line(north.slice(4, -1), '#d9dec39c', 2);
    line(island.slice(1, -2), 'rgba(226,224,186,.32)', 9);
    line(island.slice(1, -2), '#d6dcc3a0', 2);

    const ridges = [
      [[60,70],[185,140],[280,125],[402,196]], [[320,35],[420,104],[541,99],[650,163]],
      [[104,257],[205,300],[303,282],[389,345]], [[522,69],[620,126],[713,112],[804,166]],
      [[26,692],[118,690],[191,735],[278,747]], [[205,787],[292,785],[388,841],[464,842]]
    ];
    ridges.forEach((ridge, index) => {
      line(ridge, index < 4 ? '#313d3490' : '#273f388c', 16);
      line(ridge.map(([x,y]) => [x-3,y-5]), 'rgba(207,205,160,.17)', 4);
    });
    for (let i = 0; i < 115; i += 1) {
      const x = (i * 137) % 920; const y = 35 + ((i * 79) % 480);
      if (x < 850 - y * .75) ellipse(x, y, 8 + i % 7, 4 + i % 4, i % 3 ? '#31473a87' : '#253b328f', -.3);
    }
    for (let i = 0; i < 36; i += 1) ellipse((i * 71) % 430, 672 + ((i * 47) % 185), 11, 5, '#24463c88', -.2);

    line([[398,0],[423,82],[487,146],[471,220],[523,292],[491,335]], '#384b4b99', 10);
    line([[398,0],[423,82],[487,146],[471,220],[523,292],[491,335]], '#77959388', 3);
    line([[0,351],[119,329],[219,354],[313,323],[435,337]], '#e66c56bb', 5, [16,8]);
    line([[0,351],[119,329],[219,354],[313,323],[435,337]], '#2a211fa8', 1);
  }

  function drawFort(x, y) {
    context.save(); context.translate(x, y); context.shadowColor = '#0009'; context.shadowBlur = 9; context.shadowOffsetY = 6;
    poly([[-38,20],[-31,-19],[-18,-19],[-13,-32],[12,-32],[17,-19],[31,-19],[38,20]], '#4e5045', '#d2bd83', 2);
    context.fillStyle = '#272c29'; context.fillRect(-26,-11,52,31); context.fillStyle = '#ccb26d'; context.fillRect(-5,-9,10,29);
    poly([[-47,23],[47,23],[35,34],[-37,34]], '#343a35', '#857b5f', 1);
    context.shadowColor = 'transparent';
    context.strokeStyle = '#e5bd67aa'; context.lineWidth = 2; context.beginPath(); context.arc(0,0,55,0,Math.PI*2); context.stroke();
    context.restore();
  }

  function drawShip(x, y, scale, angle, selected = false) {
    context.save(); context.translate(x, y); context.rotate(angle); context.scale(scale, scale);
    line([[-112,0],[-170,-14]], 'rgba(221,239,226,.25)', 16); line([[-105,0],[-182,18]], 'rgba(225,243,233,.21)', 7);
    context.shadowColor = '#000a'; context.shadowBlur = 8; context.shadowOffsetY = 5;
    poly([[-68,-13],[38,-18],[78,0],[38,18],[-68,13],[-91,0]], '#26373a', '#aeb9aa', 2);
    context.fillStyle = '#596769'; context.fillRect(-24,-14,38,28); context.fillStyle = '#a9b0a5'; context.fillRect(-4,-9,9,18);
    context.fillStyle = '#151e21'; context.fillRect(18,-5,32,10); ellipse(49,0,8,8,'#929b91');
    context.shadowColor = 'transparent';
    if (selected) { context.strokeStyle = '#f0ca76'; context.lineWidth = 2; context.setLineDash([7,5]); context.beginPath(); context.ellipse(0,0,112,38,0,0,Math.PI*2); context.stroke(); context.setLineDash([]); }
    context.restore();
  }

  function drawAircraft(x, y, scale, angle) {
    context.save(); context.translate(x, y); context.rotate(angle); context.scale(scale, scale); context.shadowColor = '#0009'; context.shadowBlur = 8; context.shadowOffsetY = 12;
    poly([[48,0],[12,-7],[-8,-34],[-18,-35],[-12,-7],[-43,-4],[-52,-14],[-57,-12],[-49,0],[-57,12],[-52,14],[-43,4],[-12,7],[-18,35],[-8,34],[12,7]], '#b6beb1', '#28373a', 2);
    context.fillStyle = '#d9b85e'; context.fillRect(-4,-3,18,6); context.restore();
  }

  function drawLandingAndCombat() {
    const craft = [[785,530],[830,558],[873,584]];
    craft.forEach(([x,y], i) => {
      context.save(); context.translate(x,y); context.rotate(-.7); poly([[-22,-7],[20,-8],[29,0],[20,8],[-22,7]], '#4d5f5d', '#c2c9b9', 1); context.restore();
      line([[x+18,y+15],[x+49,y+43]], 'rgba(231,238,216,.28)', 7);
    });
    for (let i = 0; i < 8; i += 1) {
      const x = 680 + (i % 4) * 23; const y = 430 + Math.floor(i / 4) * 21;
      ellipse(x,y,5,5,'#202826'); line([[x,y+4],[x-2,y+13]], '#252823', 3);
    }
    line([[695,440],[735,406]], '#f3b64cbb', 3); ellipse(738,403,8,5,'#ffd67c');
    ellipse(753,391,19,13,'rgba(241,147,56,.38)'); ellipse(753,391,9,8,'#f4c668');
    ellipse(772,371,30,18,'rgba(38,43,39,.52)', -.4); ellipse(795,346,40,20,'rgba(31,37,36,.36)', -.45); ellipse(817,322,27,14,'rgba(28,35,35,.23)', -.45);
    line([[662,467],[723,430]], '#f5d28c88', 2, [5,8]);
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const portrait = rect.height > rect.width;
    const scale = Math.max(rect.width / WORLD.width, rect.height / WORLD.height);
    const focus = portrait ? {x: 760, y: 480} : {x: WORLD.width / 2, y: WORLD.height / 2};
    const offsetX = Math.min(0, Math.max(rect.width - WORLD.width * scale, rect.width / 2 - focus.x * scale));
    const offsetY = Math.min(0, Math.max(rect.height - WORLD.height * scale, rect.height / 2 - focus.y * scale));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    window.__GRAPHICS_VERTICAL_SLICE_CAMERA__ = {scale, scaleX: scale, scaleY: scale, offsetX, offsetY, portrait};
    drawWater(); drawLand();
    drawFort(652, 248);
    drawShip(1110, 560, 1.05, -.38, true); drawShip(1310, 700, .72, -.24); drawShip(1025, 760, .63, -.48);
    drawAircraft(995, 245, 1.05, -.42); drawAircraft(1145, 330, .75, -.38);
    drawLandingAndCombat();
    line([[50,610],[210,590],[350,614],[510,605]], 'rgba(113,202,193,.55)', 3, [18,11]);
  }

  document.querySelectorAll('.orders button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.orders button').forEach(item => item.classList.toggle('active', item === button));
  }));
  window.addEventListener('resize', render);
  render();
  window.__GRAPHICS_VERTICAL_SLICE_READY__ = true;
})();
