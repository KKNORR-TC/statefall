export const GRAPH_CODEC_VERSION='statefall-graph/v1';

const TYPED_ARRAYS=Object.freeze({
  Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array
});
const DEFAULT_LIMITS=Object.freeze({maxNodes:100000,maxValues:5000000,maxDepth:256,maxStringLength:1000000});
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

function limitsFor(options={}){
  const limits={...DEFAULT_LIMITS,...options};
  for(const [name,value] of Object.entries(limits)) if(!Number.isSafeInteger(value)||value<1) throw new TypeError(`Invalid graph codec limit ${name}.`);
  return limits;
}

function exactKeys(value,keys){
  if(!value||typeof value!=='object'||Array.isArray(value)) return false;
  const actual=Object.keys(value);
  return actual.length===keys.length&&keys.every(key=>own(value,key));
}

export function encodeGraph(root,options={}){
  const limits=limitsFor(options),nodes=[],seen=new Map();
  let values=0;
  const count=(amount=1)=>{ values+=amount; if(values>limits.maxValues) throw new RangeError('Graph value limit exceeded.'); };
  function encode(value,depth){
    if(depth>limits.maxDepth) throw new RangeError('Graph depth limit exceeded.');
    if(value===null||typeof value==='boolean') return value;
    if(typeof value==='string'){ if(value.length>limits.maxStringLength) throw new RangeError('Graph string limit exceeded.'); return value; }
    if(typeof value==='number'){
      if(Number.isNaN(value)) return {$number:'NaN'};
      if(value===Infinity) return {$number:'Infinity'};
      if(value===-Infinity) return {$number:'-Infinity'};
      if(Object.is(value,-0)) return {$number:'-0'};
      return value;
    }
    if(typeof value==='undefined') return {$undefined:true};
    if(typeof value!=='object') throw new TypeError(`Unsupported graph value: ${typeof value}.`);
    if(seen.has(value)) return {$ref:seen.get(value)};
    if(nodes.length>=limits.maxNodes) throw new RangeError('Graph node limit exceeded.');
    const id=nodes.length; seen.set(value,id); nodes.push(null);
    if(ArrayBuffer.isView(value)){
      if(value instanceof DataView||!own(TYPED_ARRAYS,value.constructor.name)||Object.getPrototypeOf(value)!==TYPED_ARRAYS[value.constructor.name].prototype||Reflect.ownKeys(value).some(key=>typeof key!=='string'||!(/^0$|^[1-9]\d*$/.test(key))||+key>=value.length)) throw new TypeError('Unsupported typed-array view.');
      count(value.length);
      nodes[id]={kind:'TypedArray',type:value.constructor.name,values:Array.from(value,item=>encode(item,depth+1))};
    }else if(value instanceof Set){
      if(Object.getPrototypeOf(value)!==Set.prototype||Reflect.ownKeys(value).length) throw new TypeError('Graph sets must not contain custom state.');
      count(value.size); nodes[id]={kind:'Set',values:Array.from(value,item=>encode(item,depth+1))};
    }else if(value instanceof Map){
      if(Object.getPrototypeOf(value)!==Map.prototype||Reflect.ownKeys(value).length) throw new TypeError('Graph maps must not contain custom state.');
      count(value.size*2); nodes[id]={kind:'Map',entries:Array.from(value,([key,item])=>[encode(key,depth+1),encode(item,depth+1)])};
    }else if(Array.isArray(value)){
      if(Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).some(key=>typeof key==='symbol')||Object.keys(value).some(key=>!(/^0$|^[1-9]\d*$/.test(key))||+key>=value.length)) throw new TypeError('Graph arrays must not contain custom properties.');
      count(value.length); nodes[id]={kind:'Array',values:Array.from(value,item=>encode(item,depth+1))};
    }else{
      const prototype=Object.getPrototypeOf(value);
      if(prototype!==Object.prototype&&prototype!==null) throw new TypeError('Graph objects must have plain or null prototypes.');
      const descriptors=Object.getOwnPropertyDescriptors(value),entries=[];
      if(Reflect.ownKeys(value).some(key=>typeof key==='symbol')) throw new TypeError('Graph objects must not contain symbol keys.');
      for(const key of Object.keys(descriptors)){
        const descriptor=descriptors[key];
        if(!('value' in descriptor)) throw new TypeError('Graph objects must not contain accessors.');
        if(key.length>limits.maxStringLength) throw new RangeError('Graph string limit exceeded.');
        entries.push([key,encode(descriptor.value,depth+1)]);
      }
      count(entries.length); nodes[id]={kind:'Object',nullPrototype:prototype===null,entries};
    }
    return {$ref:id};
  }
  return {version:GRAPH_CODEC_VERSION,root:encode(root,0),nodes};
}

export function decodeGraph(encoded,options={}){
  const limits=limitsFor(options);
  if(!exactKeys(encoded,['version','root','nodes'])||encoded.version!==GRAPH_CODEC_VERSION||!Array.isArray(encoded.nodes)||encoded.nodes.length>limits.maxNodes) throw new TypeError('Invalid graph encoding.');
  const nodes=encoded.nodes,targets=new Array(nodes.length);
  let values=0;
  const count=amount=>{ values+=amount; if(values>limits.maxValues) throw new RangeError('Graph value limit exceeded.'); };
  for(let id=0;id<nodes.length;id++){
    const node=nodes[id];
    if(!node||typeof node!=='object'||Array.isArray(node)||typeof node.kind!=='string') throw new TypeError('Invalid graph node.');
    if(node.kind==='Array'&&exactKeys(node,['kind','values'])&&Array.isArray(node.values)){ count(node.values.length); targets[id]=[]; }
    else if(node.kind==='Set'&&exactKeys(node,['kind','values'])&&Array.isArray(node.values)){ count(node.values.length); targets[id]=new Set(); }
    else if(node.kind==='Map'&&exactKeys(node,['kind','entries'])&&Array.isArray(node.entries)){ count(node.entries.length*2); targets[id]=new Map(); }
    else if(node.kind==='Object'&&exactKeys(node,['kind','nullPrototype','entries'])&&typeof node.nullPrototype==='boolean'&&Array.isArray(node.entries)){ count(node.entries.length); targets[id]=node.nullPrototype?Object.create(null):{}; }
    else if(node.kind==='TypedArray'&&exactKeys(node,['kind','type','values'])&&own(TYPED_ARRAYS,node.type)&&Array.isArray(node.values)){ count(node.values.length); targets[id]=null; }
    else throw new TypeError('Invalid or unsupported graph node.');
  }
  function decode(value,depth){
    if(depth>limits.maxDepth) throw new RangeError('Graph depth limit exceeded.');
    if(value===null||typeof value==='boolean'||typeof value==='number') return value;
    if(typeof value==='string'){ if(value.length>limits.maxStringLength) throw new RangeError('Graph string limit exceeded.'); return value; }
    if(!value||typeof value!=='object'||Array.isArray(value)) throw new TypeError('Invalid graph value.');
    if(exactKeys(value,['$ref'])){
      if(!Number.isSafeInteger(value.$ref)||value.$ref<0||value.$ref>=nodes.length) throw new TypeError('Invalid graph reference.');
      return materialize(value.$ref,depth+1);
    }
    if(exactKeys(value,['$undefined'])&&value.$undefined===true) return undefined;
    if(exactKeys(value,['$number'])&&['NaN','Infinity','-Infinity','-0'].includes(value.$number)) return value.$number==='NaN'?NaN:value.$number==='Infinity'?Infinity:value.$number==='-Infinity'?-Infinity:-0;
    throw new TypeError('Invalid graph value descriptor.');
  }
  const filling=new Set(),filled=new Set();
  const validTypedValue=(type,value)=>{
    if(typeof value!=='number') return false;
    if(type.startsWith('Float')) return Number.isNaN(value)||Object.is(new TYPED_ARRAYS[type]([value])[0],value);
    const ranges={Int8Array:[-128,127],Uint8Array:[0,255],Uint8ClampedArray:[0,255],Int16Array:[-32768,32767],Uint16Array:[0,65535],Int32Array:[-2147483648,2147483647],Uint32Array:[0,4294967295]};
    return Number.isInteger(value)&&value>=ranges[type][0]&&value<=ranges[type][1];
  };
  function materialize(id,depth){
    if(filled.has(id)||filling.has(id)) return targets[id];
    const node=nodes[id];
    if(node.kind==='TypedArray'){
      const raw=node.values.map(item=>decode(item,depth+1));
      if(raw.some(item=>!validTypedValue(node.type,item))) throw new TypeError('Invalid typed-array value.');
      targets[id]=new TYPED_ARRAYS[node.type](raw); filled.add(id); return targets[id];
    }
    filling.add(id); const target=targets[id];
    if(node.kind==='Array') for(const item of node.values) target.push(decode(item,depth+1));
    else if(node.kind==='Set') for(const item of node.values) target.add(decode(item,depth+1));
    else if(node.kind==='Map') for(const entry of node.entries){ if(!Array.isArray(entry)||entry.length!==2) throw new TypeError('Invalid graph map entry.'); target.set(decode(entry[0],depth+1),decode(entry[1],depth+1)); }
    else {
      const keys=new Set();
      for(const entry of node.entries){
        if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||entry[0].length>limits.maxStringLength||keys.has(entry[0])) throw new TypeError('Invalid graph object entry.');
        keys.add(entry[0]); Object.defineProperty(target,entry[0],{value:decode(entry[1],depth+1),writable:true,enumerable:true,configurable:true});
      }
    }
    filling.delete(id); filled.add(id); return target;
  }
  const result=decode(encoded.root,0);
  if(filled.size!==nodes.length) throw new TypeError('Graph contains unreachable nodes.');
  return result;
}
