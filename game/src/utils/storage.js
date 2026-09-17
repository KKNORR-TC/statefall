export function readJson(storage,key,fallback){
  try{const value=JSON.parse(storage.getItem(key)||'null');return value===null?fallback:value;}catch{return fallback;}
}

export function writeJson(storage,key,value){
  try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
