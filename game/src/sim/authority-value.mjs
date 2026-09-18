function fail(path,message){ throw new TypeError(`${path} ${message}.`); }

export function cloneAuthorityValue(value,{path='value',freeze=false}={},seen=new Map()){
  const type=typeof value;
  if(value===null||type==='string'||type==='boolean'||type==='undefined') return value;
  if(type==='number') return value;
  if(type!=='object') fail(path,`contains unsupported ${type} data`);
  if(seen.has(value)) return seen.get(value);
  if(value instanceof DataView) fail(path,'contains an unsupported DataView');
  if(ArrayBuffer.isView(value)){
    const copy=value.slice();
    seen.set(value,copy);
    return copy;
  }
  if(value instanceof ArrayBuffer){ const copy=value.slice(0); seen.set(value,copy); return copy; }
  if(value instanceof Set){
    const copy=new Set(); seen.set(value,copy);
    let index=0; for(const item of value) copy.add(cloneAuthorityValue(item,{path:`${path}<set:${index++}>`,freeze},seen));
    return copy;
  }
  if(value instanceof Map){
    const copy=new Map(); seen.set(value,copy);
    let index=0; for(const [key,item] of value){ copy.set(cloneAuthorityValue(key,{path:`${path}<key:${index}>`,freeze},seen),cloneAuthorityValue(item,{path:`${path}<value:${index++}>`,freeze},seen)); }
    return copy;
  }
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null) fail(path,'must contain only plain objects, arrays, typed arrays, ArrayBuffers, Sets, and Maps');
  if(Object.getOwnPropertySymbols(value).length) fail(path,'must not contain symbol properties');
  const copy=Array.isArray(value)?[]:Object.create(proto);
  seen.set(value,copy);
  for(const key of Object.keys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor||!('value' in descriptor)) fail(`${path}.${key}`,'must be a data property');
    copy[key]=cloneAuthorityValue(descriptor.value,{path:`${path}.${key}`,freeze},seen);
  }
  return freeze?Object.freeze(copy):copy;
}

export function freezeAuthorityValue(value,seen=new Set()){
  if(value===null||typeof value!=='object'||seen.has(value)) return value;
  seen.add(value);
  if(value instanceof Set){ for(const item of value) freezeAuthorityValue(item,seen); return value; }
  if(value instanceof Map){ for(const [key,item] of value){ freezeAuthorityValue(key,seen); freezeAuthorityValue(item,seen); } return value; }
  if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer) return value;
  for(const item of Object.values(value)) freezeAuthorityValue(item,seen);
  return Object.freeze(value);
}

export function ownAuthorityValue(value,options){
  const copy=cloneAuthorityValue(value,options);
  return options?.freeze?freezeAuthorityValue(copy):copy;
}
