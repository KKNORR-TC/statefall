(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const coast = [
    [-40, 70], [70, 54], [142, 91], [211, 83], [278, 130], [332, 189],
    [310, 244], [353, 286], [327, 330], [380, 366], [435, 397], [466, 447],
    [447, 500], [492, 535], [549, 548], [596, 596], [627, 661], [684, 704],
    [730, 776], [770, 840], [-40, 840]
  ];
  const colors = {
    water: '#173f43', deep: '#102f35', shelf: '#356463', wet: '#102d31',
    land: '#666b50', high: '#8b8061', low: '#4d5946', contour: '#343d32',
    ink: '#d6d2bd', river: '#85aaa1', forest: '#263c31', scrub: '#48543d'
  };

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

  function line(ctx, points, close = false) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const mx = (previous[0] + current[0]) / 2;
      const my = (previous[1] + current[1]) / 2;
      ctx.quadraticCurveTo(previous[0], previous[1], mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
    if (close) ctx.closePath();
  }

  function landPath(ctx, sx, sy, ox = 0, oy = 0) {
    line(ctx, coast.map(([x, y]) => [x * sx + ox, y * sy + oy]), true);
  }

  function label(ctx, text, x, y, size, tracking = 2, color = colors.ink) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px Georgia, serif`;
    ctx.shadowColor = '#081314';
    ctx.shadowBlur = 3;
    let width = 0;
    for (const char of text) width += ctx.measureText(char).width + tracking;
    let cursor = x - width / 2;
    for (const char of text) {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + tracking;
    }
    ctx.restore();
  }

  function drawOperational(canvas) {
    const {ctx, w, h, dpr} = fitCanvas(canvas);
    const sx = w / 1100;
    const sy = h / 840;
    const random = rng(197701);

    ctx.fillStyle = colors.water;
    ctx.fillRect(0, 0, w, h);
    const depth = ctx.createLinearGradient(w, 0, 0, h);
    depth.addColorStop(0, '#0f3037');
    depth.addColorStop(.52, 'rgba(23,65,67,.12)');
    depth.addColorStop(1, '#234e4d');
    ctx.fillStyle = depth;
    ctx.fillRect(0, 0, w, h);

    // Bathymetric lines read as hand-drafted currents, not a repeating map grid.
    ctx.lineWidth = 1;
    for (let band = 0; band < 15; band++) {
      ctx.beginPath();
      for (let x = -80; x <= w + 80; x += 18) {
        const y = 35 + band * 53 + Math.sin(x * .011 + band * .7) * 12 + Math.sin(x * .003 + band) * 19;
        if (x === -80) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = band % 3 === 0 ? 'rgba(113,159,153,.22)' : 'rgba(96,145,143,.11)';
      ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.strokeStyle = `rgba(183,202,188,${.025 + random() * .05})`;
      ctx.beginPath();
      ctx.arc(x, y, 7 + random() * 27, Math.PI * 1.08, Math.PI * 1.72);
      ctx.stroke();
    }

    // Shelf, dark wetline and pale coastal keyline.
    ctx.save();
    landPath(ctx, sx, sy);
    ctx.strokeStyle = colors.shelf;
    ctx.lineWidth = 34 * sx;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(119,167,157,.38)';
    ctx.lineWidth = 46 * sx;
    ctx.stroke();
    ctx.restore();

    landPath(ctx, sx, sy);
    ctx.fillStyle = colors.land;
    ctx.fill();
    ctx.save();
    landPath(ctx, sx, sy);
    ctx.clip();

    const light = ctx.createLinearGradient(0, 0, w, h);
    light.addColorStop(0, 'rgba(210,194,143,.17)');
    light.addColorStop(.48, 'rgba(27,42,34,.03)');
    light.addColorStop(1, 'rgba(18,29,27,.34)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);

    // Broad relief strokes establish a consistent northwest light direction.
    const ridges = [[185,170,185,80,-.3], [160,365,210,92,-.5], [277,584,250,100,-.15], [80,690,170,62,-.5]];
    for (const [x, y, rx, ry, angle] of ridges) {
      ctx.save();
      ctx.translate(x * sx, y * sy);
      ctx.rotate(angle);
      const relief = ctx.createRadialGradient(-rx * sx * .25, -ry * sy * .35, 3, 0, 0, rx * sx);
      relief.addColorStop(0, 'rgba(202,187,135,.34)');
      relief.addColorStop(.46, 'rgba(126,117,84,.16)');
      relief.addColorStop(.72, 'rgba(42,53,40,.20)');
      relief.addColorStop(1, 'rgba(31,41,34,0)');
      ctx.fillStyle = relief;
      ctx.scale(1, ry / rx);
      ctx.beginPath(); ctx.arc(0, 0, rx * sx, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // Irregular topographic contours follow the same relief fields.
    for (const [cx, cy, rx, ry, angle] of ridges) {
      for (let ring = .28; ring < .95; ring += .14) {
        ctx.save();
        ctx.translate(cx * sx, cy * sy);
        ctx.rotate(angle);
        ctx.beginPath();
        for (let a = 0; a <= TAU + .08; a += .08) {
          const rough = 1 + Math.sin(a * 3 + ring * 9) * .035 + Math.sin(a * 7) * .018;
          const px = Math.cos(a) * rx * ring * rough * sx;
          const py = Math.sin(a) * ry * ring * rough * sy;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(42,49,37,.34)';
        ctx.lineWidth = .75;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Chroma-forward ownership remains translucent enough to retain ground detail.
    ctx.fillStyle = 'rgba(45,139,111,.29)';
    ctx.beginPath();
    ctx.moveTo(0, h * .62); ctx.bezierCurveTo(w * .18, h * .51, w * .30, h * .55, w * .48, h * .69);
    ctx.lineTo(w * .67, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.filter = 'blur(5px)';
    ctx.strokeStyle = 'rgba(91,184,148,.36)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, h * .62); ctx.bezierCurveTo(w * .18, h * .51, w * .30, h * .55, w * .48, h * .69);
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = 'rgba(164,53,45,.25)';
    ctx.beginPath();
    ctx.moveTo(0, h * .12); ctx.bezierCurveTo(w * .15, h * .24, w * .29, h * .30, w * .42, h * .43);
    ctx.lineTo(w * .33, h * .55); ctx.lineTo(0, h * .48); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, h * .12); ctx.bezierCurveTo(w * .15, h * .24, w * .29, h * .30, w * .42, h * .43);
    ctx.strokeStyle = 'rgba(244,128,94,.98)'; ctx.lineWidth = 2; ctx.setLineDash([8, 4, 2, 4]); ctx.stroke(); ctx.setLineDash([]);

    // Rivers and branching tributaries.
    const rivers = [
      [[40,245],[116,280],[165,335],[229,377],[302,417],[382,443],[458,464]],
      [[69,533],[151,519],[211,552],[278,577],[347,614],[431,650],[521,676],[620,704]],
      [[138,287],[164,231],[209,194]], [[224,375],[250,316],[281,281]],
      [[211,551],[247,492],[289,465]], [[348,614],[380,561],[424,531]], [[151,519],[124,463],[100,438]]
    ];
    rivers.forEach((river, index) => {
      line(ctx, river.map(([x,y]) => [x*sx,y*sy]));
      ctx.strokeStyle = index < 2 ? 'rgba(123,172,163,.88)' : 'rgba(112,156,148,.62)';
      ctx.lineWidth = (index < 2 ? 2.1 : 1) * sx; ctx.stroke();
    });

    // Woodland groups use varied, individually drawn canopy marks.
    const woods = [[105,172,78,58],[163,432,66,46],[346,505,91,58],[425,702,76,45],[62,650,48,37]];
    woods.forEach(([cx, cy, rx, ry], group) => {
      for (let i = 0; i < 42; i++) {
        const a = random() * TAU, r = Math.sqrt(random());
        const x = (cx + Math.cos(a) * rx * r) * sx;
        const y = (cy + Math.sin(a) * ry * r) * sy;
        const radius = (2.2 + random() * 4.8) * sx;
        ctx.fillStyle = group % 2 ? 'rgba(36,56,43,.66)' : 'rgba(31,53,42,.74)';
        ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(145,147,104,.16)'; ctx.lineWidth = .5; ctx.stroke();
      }
    });

    // Restrained ridge hachures and scrub.
    ctx.strokeStyle = 'rgba(218,200,142,.30)';
    for (let i = 0; i < 54; i++) {
      const x = (80 + random() * 320) * sx, y = (80 + random() * 650) * sy;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (7 + random() * 13) * sx, y - (3 + random() * 7) * sy); ctx.stroke();
    }
    for (let i = 0; i < 4300; i++) {
      const x = random() * w, y = random() * h;
      ctx.fillStyle = random() > .48 ? 'rgba(238,222,165,.035)' : 'rgba(14,25,22,.045)';
      ctx.fillRect(x, y, .55 + random() * .7, .55 + random() * .7);
    }
    ctx.restore();

    landPath(ctx, sx, sy);
    ctx.strokeStyle = colors.wet; ctx.lineWidth = 7 * sx; ctx.stroke();
    ctx.strokeStyle = 'rgba(226,217,181,.72)'; ctx.lineWidth = 1.25; ctx.stroke();

    // Beaches and cliff teeth distinguish coastal character.
    ctx.strokeStyle = 'rgba(213,191,137,.82)'; ctx.lineWidth = 4 * sx;
    line(ctx, [[330*sx,188*sy],[310*sx,244*sy],[353*sx,286*sy]]); ctx.stroke();
    ctx.strokeStyle = 'rgba(21,34,31,.8)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (455 + i * 17) * sx, y = (500 + i * 14) * sy;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-9*sx,y+6*sy); ctx.stroke();
    }

    // Geographic labels only.
    label(ctx, 'NORTH MARCH', 190*sx, 135*sy, 13*sx, 2.8*sx, 'rgba(226,220,194,.62)');
    label(ctx, 'CAIRN COAST', 275*sx, 490*sy, 15*sx, 3.2*sx, 'rgba(231,224,197,.70)');
    label(ctx, 'SABLE NARROWS', 720*sx, 360*sy, 14*sx, 3*sx, 'rgba(177,207,199,.50)');
    label(ctx, 'THE GREY SEA', 830*sx, 700*sy, 12*sx, 3.4*sx, 'rgba(155,193,188,.42)');
    ctx.font = `italic ${10*sx}px Georgia, serif`; ctx.fillStyle = 'rgba(196,214,202,.65)';
    ctx.fillText('River Edda', 365*sx, 626*sy);

    // Unexplored edge treatment: stippled charcoal fog along the far north.
    const fog = ctx.createLinearGradient(0, 0, 0, h * .19);
    fog.addColorStop(0, 'rgba(5,13,17,.93)'); fog.addColorStop(.62, 'rgba(7,16,18,.58)'); fog.addColorStop(1, 'rgba(7,16,18,0)');
    ctx.fillStyle = fog; ctx.fillRect(0, 0, w, h * .2);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(175,190,176,${random()*.11})`;
      ctx.fillRect(random()*w, random()*h*.12, 1, 1);
    }
    return {width: canvas.width, height: canvas.height, cssWidth: w, cssHeight: h, dpr};
  }

  function drawOverview(canvas) {
    const {ctx, w, h, dpr} = fitCanvas(canvas);
    const random = rng(81073);
    ctx.fillStyle = '#14363a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      for (let x = -20; x < w + 30; x += 12) {
        const y = 20 + i * 38 + Math.sin(x*.025+i) * 8;
        x === -20 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(101,151,147,.14)'; ctx.stroke();
    }
    const shape = [[-10,4],[54,22],[82,58],[72,91],[113,119],[103,156],[143,191],[162,235],[211,267],[232,h+10],[-10,h+10]];
    line(ctx, shape, true); ctx.fillStyle = '#5d664e'; ctx.fill();
    ctx.strokeStyle = '#d2ccb0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); line(ctx, shape, true); ctx.clip();
    const shade = ctx.createLinearGradient(0,0,w,h); shade.addColorStop(0,'rgba(192,177,123,.22)'); shade.addColorStop(1,'rgba(28,43,34,.34)'); ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    for (let i=0;i<260;i++){ctx.fillStyle=random()>.5?'rgba(224,205,145,.05)':'rgba(10,22,19,.06)';ctx.fillRect(random()*w,random()*h,1,1);}
    ctx.restore();
    ctx.fillStyle='rgba(38,145,108,.39)';ctx.fillRect(0,h*.63,w*.54,h*.37);
    ctx.fillStyle='rgba(176,48,41,.32)';ctx.fillRect(0,0,w*.34,h*.44);
    ctx.save();ctx.filter='blur(4px)';ctx.strokeStyle='rgba(98,193,151,.38)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,h*.63);ctx.lineTo(w*.54,h*.63);ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(247,128,91,.96)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(0,h*.31);ctx.bezierCurveTo(w*.14,h*.36,w*.26,h*.39,w*.43,h*.49);ctx.stroke();ctx.setLineDash([]);
    // Extent indicator links strategic and operational scales.
    ctx.strokeStyle='#d0b276';ctx.lineWidth=1.5;ctx.strokeRect(w*.17,h*.17,w*.42,h*.62);
    ctx.fillStyle='rgba(208,178,118,.06)';ctx.fillRect(w*.17,h*.17,w*.42,h*.62);
    ctx.font='7px Arial';ctx.fillStyle='#d2bd8d';ctx.fillText('DETAIL EXTENT',w*.17,h*.17-6);
    label(ctx,'GREY SEA',w*.72,h*.52,9,1.4,'rgba(171,201,194,.48)');
    return {width: canvas.width, height: canvas.height, cssWidth: w, cssHeight: h, dpr};
  }

  const metrics = {
    operational: drawOperational(document.querySelector('#terrain-map')),
    overview: drawOverview(document.querySelector('#overview-map'))
  };
  window.__TERRAIN_DIRECTION_METRICS__ = metrics;
  window.__TERRAIN_DIRECTION_READY__ = true;
})();
