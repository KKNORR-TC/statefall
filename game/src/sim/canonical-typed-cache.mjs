// Reuse JSON for unchanged typed buffers, but compare bytes on every serialization.
// This cache is outside authoritative state and remains valid across resets/restores.
export function createCanonicalTypedCache(){
  const cache=new WeakMap(),raw=new WeakSet();
  function typedValues(value){
    if(value instanceof DataView||value instanceof BigInt64Array||value instanceof BigUint64Array||value.length<256) return null;
    const bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength),prior=cache.get(value);
    let same=!!prior&&prior.bytes.length===bytes.length;
    if(same){
      let offset=0;
      if(value.byteOffset%4===0){
        const words=new Uint32Array(value.buffer,value.byteOffset,Math.floor(bytes.length/4));
        const previous=new Uint32Array(prior.bytes.buffer,0,words.length);
        for(let i=0;i<words.length;i++) if(words[i]!==previous[i]){same=false;break;}
        offset=words.length*4;
      }
      if(same) for(let i=offset;i<bytes.length;i++) if(bytes[i]!==prior.bytes[i]){same=false;break;}
    }
    if(same) return prior.json;
    const values=new Array(value.length);
    for(let i=0;i<value.length;i++) values[i]=value[i];
    const json={text:JSON.stringify(values)};
    raw.add(json);cache.set(value,{bytes:bytes.slice(),json});return json;
  }
  // Input is the serializer's normalized graph: cycles and unsupported values
  // have already become ordinary JSON objects. Only our private markers are raw.
  function stringify(value){
    if(value===null||typeof value!=='object') return JSON.stringify(value);
    if(raw.has(value)) return value.text;
    if(Array.isArray(value)){
      const parts=new Array(value.length);
      for(let i=0;i<value.length;i++) parts[i]=stringify(value[i])??'null';
      return '['+parts.join(',')+']';
    }
    const parts=[];
    for(const key of Object.keys(value)){
      const encoded=stringify(value[key]);
      if(encoded!==undefined) parts.push(JSON.stringify(key)+':'+encoded);
    }
    return '{'+parts.join(',')+'}';
  }
  return Object.freeze({typedValues,stringify});
}
