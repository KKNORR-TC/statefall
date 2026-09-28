// Portable simulation math. Exact historical V8/fdlibm arithmetic, not native browser trig.
// Ported from Node v22.23.2 deps/v8/src/base/ieee754.cc and src/builtins/math.tq.
// Preserve expression order: seemingly equivalent rewrites can change replay bytes.
// The accompanying V8 license is in docs/licenses/strict-math-V8.txt.
// The following is adapted from fdlibm (http://www.netlib.org/fdlibm).
//
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
//
// The original source code covered by the above license above has been
// modified significantly by Google Inc.
// Copyright 2016 the V8 project authors. All rights reserved.

const bits=new DataView(new ArrayBuffer(8));
function getHighWord(x){bits.setFloat64(0,x,false);return bits.getInt32(0,false);}
function getLowWord(x){bits.setFloat64(0,x,false);return bits.getUint32(4,false);}
function words(h,l){bits.setInt32(0,h,false);bits.setUint32(4,l,false);return bits.getFloat64(0,false);}
function scalbn(x,n){return x*(2**n);}
const two_over_pi=[
      0xA2F983, 0x6E4E44, 0x1529FC, 0x2757D1, 0xF534DD, 0xC0DB62, 0x95993C,
      0x439041, 0xFE5163, 0xABDEBB, 0xC561B7, 0x246E3A, 0x424DD2, 0xE00649,
      0x2EEA09, 0xD1921C, 0xFE1DEB, 0x1CB129, 0xA73EE8, 0x8235F5, 0x2EBB44,
      0x84E99C, 0x7026B4, 0x5F7E41, 0x3991D6, 0x398353, 0x39F49C, 0x845F8B,
      0xBDF928, 0x3B1FF8, 0x97FFDE, 0x05980F, 0xEF2F11, 0x8B5A0A, 0x6D1F6D,
      0x367ECF, 0x27CB09, 0xB74F46, 0x3F669E, 0x5FEA2D, 0x7527BA, 0xC7EBE5,
      0xF17B3D, 0x0739F7, 0x8A5292, 0xEA6BFB, 0x5FB11F, 0x8D5D08, 0x560330,
      0x46FC7B, 0x6BABF0, 0xCFBC20, 0x9AF436, 0x1DA9E3, 0x91615E, 0xE61B08,
      0x659985, 0x5F14A0, 0x68408D, 0xFFD880, 0x4D7327, 0x310606, 0x1556CA,
      0x73A8C9, 0x60E27B, 0xC08C6B,
  ];
const npio2_hw=[
      0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C,
      0x4025FDBB, 0x402921FB, 0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C,
      0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B, 0x403C463A,
      0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C,
      0x4043A28C, 0x40446B9C, 0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB,
      0x404858EB, 0x404921FB,
  ];
const init_jk=[2, 3, 4, 6];
const PIo2=[
      1.57079625129699707031e+00,
      7.54978941586159635335e-08,
      5.39030252995776476554e-15,
      3.28200341580791294123e-22,
      1.27065575308067607349e-29,
      1.22933308981111328932e-36,
      2.73370053816464559624e-44,
      2.16741683877804819444e-51,
  ];
const atanhi=[
      4.63647609000806093515e-01,
      7.85398163397448278999e-01,
      9.82793723247329054082e-01,
      1.57079632679489655800e+00,
  ];
const atanlo=[
      2.26987774529616870924e-17,
      3.06161699786838301793e-17,
      1.39033110312309984516e-17,
      6.12323399573676603587e-17,
  ];
const aT=[
      3.33333333333329318027e-01,
      -1.99999999998764832476e-01,
      1.42857142725034663711e-01,
      -1.11111104054623557880e-01,
      9.09088713343650656196e-02,
      -7.69187620504482999495e-02,
      6.66107313738753120669e-02,
      -5.83357013379057348645e-02,
      4.97687799461593236017e-02,
      -3.65315727442169155270e-02,
      1.62858201153657823623e-02,
  ];
function __ieee754_rem_pio2(x,y){

  const zero = 0.00000000000000000000e+00,
      half = 5.00000000000000000000e-01,
      two24 = 1.67772160000000000000e+07,
      invpio2 = 6.36619772367581382433e-01,
      pio2_1 = 1.57079632673412561417e+00,
      pio2_1t = 6.07710050650619224932e-11,
      pio2_2 = 6.07710050630396597660e-11,
      pio2_2t = 2.02226624879595063154e-21,
      pio2_3 = 2.02226624871116645580e-21,
      pio2_3t = 8.47842766036889956997e-32;

  let z, w, t, r, fn;
  let tx;
  let e0, i, j, nx, n, ix, hx;
  let low;

  z = 0;
  hx=getHighWord(x);
  ix = hx & 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002D97C) {
    if (hx > 0) {
      z = x - pio2_1;
      if (ix != 0x3FF921FB) {
        y[0] = z - pio2_1t;
        y[1] = (z - y[0]) - pio2_1t;
      } else {
        z -= pio2_2;
        y[0] = z - pio2_2t;
        y[1] = (z - y[0]) - pio2_2t;
      }
      return 1;
    } else {
      z = x + pio2_1;
      if (ix != 0x3FF921FB) {
        y[0] = z + pio2_1t;
        y[1] = (z - y[0]) + pio2_1t;
      } else {
        z += pio2_2;
        y[0] = z + pio2_2t;
        y[1] = (z - y[0]) + pio2_2t;
      }
      return -1;
    }
  }
  if (ix <= 0x413921FB) {
    t = Math.abs(x);
    n = ((t * invpio2 + half)|0);
    fn = (n);
    r = t - fn * pio2_1;
    w = fn * pio2_1t;
    if (n < 32 && ix != npio2_hw[n - 1]) {
      y[0] = r - w;
    } else {
      let high;
      j = ix >> 20;
      y[0] = r - w;
      high=getHighWord(y[0]);
      i = j - ((high >> 20) & 0x7FF);
      if (i > 16) {
        t = r;
        w = fn * pio2_2;
        r = t - w;
        w = fn * pio2_2t - ((t - r) - w);
        y[0] = r - w;
        high=getHighWord(y[0]);
        i = j - ((high >> 20) & 0x7FF);
        if (i > 49) {
          t = r;
          w = fn * pio2_3;
          r = t - w;
          w = fn * pio2_3t - ((t - r) - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = (r - y[0]) - w;
    if (hx < 0) {
      y[0] = -y[0];
      y[1] = -y[1];
      return -n;
    } else {
      return n;
    }
  }

  if (ix >= 0x7FF00000) {
    y[0] = y[1] = x - x;
    return 0;
  }

  tx=[0,0,0];
  low=getLowWord(x);
  z=words(getHighWord(z),low);
  e0 = (ix >> 20) - 1046;
  z=words(ix - ((((e0)>>>0) << 20)|0),getLowWord(z));
  for (i = 0; i < 2; i++) {
    tx[i] = (((z)|0));
    z = (z - tx[i]) * two24;
  }
  tx[2] = z;
  nx = 3;
  while (tx[nx - 1] == zero) nx--;
  n = __kernel_rem_pio2(tx, y, e0, nx, 2, two_over_pi);
  if (hx < 0) {
    y[0] = -y[0];
    y[1] = -y[1];
    return -n;
  }
  return n;
}
function __kernel_cos(x,y){
  const one = 1.00000000000000000000e+00,
      C1 = 4.16666666666666019037e-02,
      C2 = -1.38888888888741095749e-03,
      C3 = 2.48015872894767294178e-05,
      C4 = -2.75573143513906633035e-07,
      C5 = 2.08757232129817482790e-09,
      C6 = -1.13596475577881948265e-11;

  let a, iz, z, r, qx;
  let ix;
  ix=getHighWord(x);
  ix &= 0x7FFFFFFF;
  if (ix < 0x3E400000) {
    if (((x)|0) == 0) return one;
  }
  z = x * x;
  r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3FD33333) {
    return one - (0.5 * z - (z * r - x * y));
  } else {
    if (ix > 0x3FE90000) {
      qx = 0.28125;
    } else {
      qx=words(ix - 0x00200000,0);
    }
    iz = 0.5 * z - qx;
    a = one - qx;
    return a - (iz - (z * r - x * y));
  }
}
function __kernel_rem_pio2(x,y,e0,nx,prec,ipio2){

  const zero = 0.0,
      one = 1.0,
      two24 = 1.67772160000000000000e+07,
      twon24 = 5.96046447753906250000e-08;

  let jz, jx, jv, jp, jk, carry, n, iq=new Array(20).fill(0), i, j, k, m, q0, ih;
  let z, fw, f=new Array(20).fill(0), fq=new Array(20).fill(0), q=new Array(20).fill(0);

  jk = init_jk[prec];
  jp = jk;

  jx = nx - 1;
  jv = ((e0 - 3) / 24)|0;
  if (jv < 0) jv = 0;
  q0 = e0 - 24 * (jv + 1);

  j = jv - jx;
  m = jx + jk;
  for (i = 0; i <= m; i++, j++) {
    f[i] = (j < 0) ? zero : (ipio2[j]);
  }

  for (i = 0; i <= jk; i++) {
    for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j] * f[jx + i - j];
    q[i] = fw;
  }

  jz = jk;
while(true){

  for (i = 0, j = jz, z = q[jz]; j > 0; i++, j--) {
    fw = (((twon24 * z)|0));
    iq[i] = ((z - two24 * fw)|0);
    z = q[j - 1] + fw;
  }

  z = scalbn(z, q0);
  z -= 8.0 * Math.floor(z * 0.125);
  n = ((z)|0);
  z -= (n);
  ih = 0;
  if (q0 > 0) {
    i = (iq[jz - 1] >> (24 - q0));
    n += i;
    iq[jz - 1] -= i << (24 - q0);
    ih = iq[jz - 1] >> (23 - q0);
  } else if (q0 == 0) {
    ih = iq[jz - 1] >> 23;
  } else if (z >= 0.5) {
    ih = 2;
  }

  if (ih > 0) {
    n += 1;
    carry = 0;
    for (i = 0; i < jz; i++) {
      j = iq[i];
      if (carry == 0) {
        if (j != 0) {
          carry = 1;
          iq[i] = 0x1000000 - j;
        }
      } else {
        iq[i] = 0xFFFFFF - j;
      }
    }
    if (q0 > 0) {
      switch (q0) {
        case 1:
          iq[jz - 1] &= 0x7FFFFF;
          break;
        case 2:
          iq[jz - 1] &= 0x3FFFFF;
          break;
      }
    }
    if (ih == 2) {
      z = one - z;
      if (carry != 0) z -= scalbn(one, q0);
    }
  }

  if (z == zero) {
    j = 0;
    for (i = jz - 1; i >= jk; i--) j |= iq[i];
    if (j == 0) {
      for (k = 1; jk >= k && iq[jk - k] == 0; k++) {

      }

      for (i = jz + 1; i <= jz + k; i++) {
        f[jx + i] = ipio2[jv + i];
        for (j = 0, fw = 0.0; j <= jx; j++) fw += x[j] * f[jx + i - j];
        q[i] = fw;
      }
      jz += k;
      continue;
    }
  }

  break;
}
  if (z == 0.0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] == 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    z = scalbn(z, -q0);
    if (z >= two24) {
      fw = (((twon24 * z)|0));
      iq[jz] = z - two24 * fw;
      jz += 1;
      q0 += 24;
      iq[jz] = fw;
    } else {
      iq[jz] = z;
    }
  }

  fw = scalbn(one, q0);
  for (i = jz; i >= 0; i--) {
    q[i] = fw * iq[i];
    fw *= twon24;
  }

  for (i = jz; i >= 0; i--) {
    for (fw = 0.0, k = 0; k <= jp && k <= jz - i; k++) fw += PIo2[k] * q[i + k];
    fq[jz - i] = fw;
  }

  switch (prec) {
    case 0:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i];
      y[0] = (ih == 0) ? fw : -fw;
      break;
    case 1:
    case 2:
      fw = 0.0;
      for (i = jz; i >= 0; i--) fw += fq[i];
      y[0] = (ih == 0) ? fw : -fw;
      fw = fq[0] - fw;
      for (i = 1; i <= jz; i++) fw += fq[i];
      y[1] = (ih == 0) ? fw : -fw;
      break;
    case 3:
      for (i = jz; i > 0; i--) {
        fw = fq[i - 1] + fq[i];
        fq[i] += fq[i - 1] - fw;
        fq[i - 1] = fw;
      }
      for (i = jz; i > 1; i--) {
        fw = fq[i - 1] + fq[i];
        fq[i] += fq[i - 1] - fw;
        fq[i - 1] = fw;
      }
      for (fw = 0.0, i = jz; i >= 2; i--) fw += fq[i];
      if (ih == 0) {
        y[0] = fq[0];
        y[1] = fq[1];
        y[2] = fw;
      } else {
        y[0] = -fq[0];
        y[1] = -fq[1];
        y[2] = -fw;
      }
  }
  return n & 7;
}
function __kernel_sin(x,y,iy){
  const half = 5.00000000000000000000e-01,
      S1 = -1.66666666666666324348e-01,
      S2 = 8.33333333332248946124e-03,
      S3 = -1.98412698298579493134e-04,
      S4 = 2.75573137070700676789e-06,
      S5 = -2.50507602534068634195e-08,
      S6 = 1.58969099521155010221e-10;

  let z, r, v;
  let ix;
  ix=getHighWord(x);
  ix &= 0x7FFFFFFF;
  if (ix < 0x3E400000) {
    if (((x)|0) == 0) return x;
  }
  z = x * x;
  v = z * x;
  r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy == 0) {
    return x + v * (S1 + z * r);
  } else {
    return x - ((z * (half * y - v * r) - y) - v * S1);
  }
}
function atan(x){

  const one = 1.0, huge = 1.0e300;

  let w, s1, s2, z;
  let ix, hx, id;

  hx=getHighWord(x);
  ix = hx & 0x7FFFFFFF;
  if (ix >= 0x44100000) {
    let low;
    low=getLowWord(x);
    if (ix > 0x7FF00000 || (ix == 0x7FF00000 && (low != 0)))
      return x + x;
    if (hx > 0)
      return atanhi[3] + atanlo[3];
    else
      return -atanhi[3] - atanlo[3];
  }
  if (ix < 0x3FDC0000) {
    if (ix < 0x3E400000) {
      if (huge + x > one) return x;
    }
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3FF30000) {
      if (ix < 0x3FE60000) {
        id = 0;
        x = (2.0 * x - one) / (2.0 + x);
      } else {
        id = 1;
        x = (x - one) / (x + one);
      }
    } else {
      if (ix < 0x40038000) {
        id = 2;
        x = (x - 1.5) / (one + 1.5 * x);
      } else {
        id = 3;
        x = -1.0 / x;
      }
    }
  }

  z = x * x;
  w = z * z;

  s1 = z * (aT[0] +
            w * (aT[2] + w * (aT[4] + w * (aT[6] + w * (aT[8] + w * aT[10])))));
  s2 = w * (aT[1] + w * (aT[3] + w * (aT[5] + w * (aT[7] + w * aT[9]))));
  if (id < 0) {
    return x - x * (s1 + s2);
  } else {
    z = atanhi[id] - ((x * (s1 + s2) - atanlo[id]) - x);
    return (hx < 0) ? -z : z;
  }
}
function atan2(y,x){
  const tiny = 1.0e-300;
  const zero = 0.0,
      pi_o_4 = 7.8539816339744827900E-01,
      pi_o_2 = 1.5707963267948965580E+00,
      pi = 3.1415926535897931160E+00;
  const pi_lo =
      1.2246467991473531772E-16;

  let z;
  let k, m, hx, hy, ix, iy;
  let lx, ly;

  hx=getHighWord(x);lx=getLowWord(x);
  ix = hx & 0x7FFFFFFF;
  hy=getHighWord(y);ly=getLowWord(y);
  iy = hy & 0x7FFFFFFF;
  if (((ix | ((lx | (-lx|0)) >> 31)) > 0x7FF00000) ||
      ((iy | ((ly | (-ly|0)) >> 31)) > 0x7FF00000)) {
    return x + y;
  }
  if ((((hx-0x3FF00000)|0) | lx) == 0) {
    return atan(y);
  }
  m = ((hy >> 31) & 1) | ((hx >> 30) & 2);

  if ((iy | ly) == 0) {
    switch (m) {
      case 0:
      case 1:
        return y;
      case 2:
        return pi + tiny;
      case 3:
        return -pi - tiny;
    }
  }

  if ((ix | lx) == 0) return (hy < 0) ? -pi_o_2 - tiny : pi_o_2 + tiny;

  if (ix == 0x7FF00000) {
    if (iy == 0x7FF00000) {
      switch (m) {
        case 0:
          return pi_o_4 + tiny;
        case 1:
          return -pi_o_4 - tiny;
        case 2:
          return 3.0 * pi_o_4 + tiny;
        case 3:
          return -3.0 * pi_o_4 - tiny;
      }
    } else {
      switch (m) {
        case 0:
          return zero;
        case 1:
          return -zero;
        case 2:
          return pi + tiny;
        case 3:
          return -pi - tiny;
      }
    }
  }

  if (iy == 0x7FF00000) return (hy < 0) ? -pi_o_2 - tiny : pi_o_2 + tiny;

  k = (iy - ix) >> 20;
  if (k > 60) {
    z = pi_o_2 + 0.5 * pi_lo;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0.0;
  } else {
    z = atan(Math.abs(y / x));
  }
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return pi - (z - pi_lo);
    default:
      return (z - pi_lo) - pi;
  }
}
function cos(x){

  let y=[0,0], z = 0.0;
  let n, ix;

  ix=getHighWord(x);

  ix &= 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    return __kernel_cos(x, z);
  } else if (ix >= 0x7FF00000) {

    return x - x;
  } else {

    n = __ieee754_rem_pio2(x, y);
    switch (n & 3) {
      case 0:
        return __kernel_cos(y[0], y[1]);
      case 1:
        return -__kernel_sin(y[0], y[1], 1);
      case 2:
        return -__kernel_cos(y[0], y[1]);
      default:
        return __kernel_sin(y[0], y[1], 1);
    }
  }
}
function sin(x){

  let y=[0,0], z = 0.0;
  let n, ix;

  ix=getHighWord(x);

  ix &= 0x7FFFFFFF;
  if (ix <= 0x3FE921FB) {
    return __kernel_sin(x, z, 0);
  } else if (ix >= 0x7FF00000) {

    return x - x;
  } else {

    n = __ieee754_rem_pio2(x, y);
    switch (n & 3) {
      case 0:
        return __kernel_sin(y[0], y[1], 1);
      case 1:
        return __kernel_cos(y[0], y[1]);
      case 2:
        return -__kernel_sin(y[0], y[1], 1);
      default:
        return -__kernel_cos(y[0], y[1]);
    }
  }
}
export {sin,cos,atan,atan2};


export function hypot(...values){
 let max=0,nan=false;
 for(let i=0;i<values.length;i++){const v=Math.abs(Number(values[i]));values[i]=v;if(Number.isNaN(v))nan=true;else if(v>max)max=v;}
 if(max===Infinity)return Infinity;if(nan)return NaN;if(max===0)return 0;
 let sum=0,compensation=0;
 for(const v of values){const n=v/max,summand=n*n-compensation,preliminary=sum+summand;compensation=(preliminary-sum)-summand;sum=preliminary;}
 return Math.sqrt(sum)*max;
}
