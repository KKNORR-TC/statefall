// Internal rollback snapshots only. External checkpoints still use the bounded,
// validating graph codec. Preserve graph identity while bulk-copying typed buffers.
export function copyRollbackGraph(root){
  const seen=new Map();
  function copy(value){
    if(value===null||typeof value!=='object')return value;
    if(seen.has(value))return seen.get(value);
    if(ArrayBuffer.isView(value)){
      if(value instanceof DataView)throw new TypeError('Unsupported rollback view');
      const result=value.slice();seen.set(value,result);return result;
    }
    let result;
    if(Array.isArray(value)){result=[];seen.set(value,result);for(const item of value)result.push(copy(item));}
    else if(value instanceof Set){result=new Set();seen.set(value,result);for(const item of value)result.add(copy(item));}
    else if(value instanceof Map){result=new Map();seen.set(value,result);for(const [key,item] of value)result.set(copy(key),copy(item));}
    else{
      const proto=Object.getPrototypeOf(value);
      if(proto!==null&&proto!==Object.prototype)throw new TypeError('Unsupported rollback object');
      result=Object.create(proto);seen.set(value,result);
      for(const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))){
        if(!('value' in descriptor))throw new TypeError('Rollback objects must not contain accessors');
        Object.defineProperty(result,key,{value:copy(descriptor.value),writable:true,enumerable:true,configurable:true});
      }
    }
    return result;
  }
  return copy(root);
}
