export const DIFFICULTY_IDS=Object.freeze(['supereasy','easy','normal','hard','superhard','impossible']);
export const MAP_IDS=Object.freeze(['random','land','islands_l','islands_m','islands_s','atoll','world','europe','americas','africa','asia','mideast']);
export const RULE_IDS=Object.freeze(['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','troopcmd','engcmd','radar','lradar','satellite','jammer','scout','sub','hunter','rship','privateer','warship','cruiser','battleship','missile']);
export const BOOLEAN_SETTING_NAMES=Object.freeze(['bots','noCap','quick','fog','instant','risky','endgame','billionaire','garrison','pauseBuild']);
export const SETTING_NAMES=Object.freeze(['troops','gold','bots','teams','noCap','map','quick','fog','instant','risky','endgame','billionaire','garrison','pauseBuild','seed','customBots']);

const difficulties=new Set(DIFFICULTY_IDS),maps=new Set(MAP_IDS),rules=new Set(RULE_IDS),settingNames=new Set(SETTING_NAMES);
const mapAliases=new Map([
  ['continents','random'],['large_islands','islands_l'],['large-islands','islands_l'],['medium_islands','islands_m'],['medium-islands','islands_m'],['small_islands','islands_s'],['small-islands','islands_s'],['middle_east','mideast'],['middle-east','mideast']
]);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;

export function normalizeMapId(value){ return mapAliases.get(value)||value; }
export function assertDifficulty(value){ if(!difficulties.has(value)) throw new TypeError(`Unsupported difficulty: ${String(value)}.`); return value; }
export function assertMapId(value){ const normalized=normalizeMapId(value); if(!maps.has(normalized)) throw new TypeError(`Unsupported map: ${String(value)}.`); return normalized; }
export function assertAllowedRules(value){
  if(!Array.isArray(value)&&!(value instanceof Set)) throw new TypeError('allowed must be an array or Set.');
  const result=[];
  for(const id of value){ if(typeof id!=='string'||!rules.has(id)) throw new TypeError(`Unsupported allowed rule: ${String(id)}.`); if(result.includes(id)) throw new TypeError(`Duplicate allowed rule: ${id}.`); result.push(id); }
  if(result.length>RULE_IDS.length) throw new TypeError('Too many allowed rules.');
  return result;
}
function assertLayer(layer,path){
  if(!Array.isArray(layer)||layer.length<2||layer.length>32) throw new TypeError(`${path} must be a short flag layer array.`);
  const valid=value=>['string','number','boolean'].includes(typeof value)?(typeof value!=='number'||Number.isFinite(value))&&(typeof value!=='string'||value.length<=200):Array.isArray(value)&&value.length<=20&&value.every(item=>typeof item==='number'&&Number.isFinite(item));
  for(const value of layer) if(!valid(value)) throw new TypeError(`${path} contains an invalid value.`);
}
export function assertIdentity(value,path='identity'){
  if(!plain(value)) throw new TypeError(`${path} must be a plain object.`);
  const keys=new Set(['name','layers','idx','custom','userId','slot']);
  for(const key of Object.keys(value)) if(!keys.has(key)) throw new TypeError(`${path}.${key} is not supported.`);
  if(typeof value.name!=='string'||value.name.length<1||value.name.length>100) throw new TypeError(`${path}.name must be 1-100 characters.`);
  if(!Array.isArray(value.layers)||value.layers.length<1||value.layers.length>20) throw new TypeError(`${path}.layers must contain 1-20 layers.`);
  value.layers.forEach((layer,index)=>assertLayer(layer,`${path}.layers[${index}]`));
  if(value.idx!=null&&(!Number.isSafeInteger(value.idx)||value.idx< -1||value.idx>10000)) throw new TypeError(`${path}.idx is invalid.`);
  if(value.custom!=null&&typeof value.custom!=='boolean') throw new TypeError(`${path}.custom must be boolean.`);
  if(value.userId!=null&&(!Number.isSafeInteger(value.userId)||value.userId<0)) throw new TypeError(`${path}.userId is invalid.`);
  if(value.slot!=null&&(!Number.isSafeInteger(value.slot)||value.slot<0||value.slot>8)) throw new TypeError(`${path}.slot is invalid.`);
  return value;
}
export function validateSettingsCandidate(candidate,current={}){
  if(!plain(candidate)) throw new TypeError('settings must be a plain object.');
  for(const key of Object.keys(candidate)) if(!settingNames.has(key)) throw new TypeError(`Unsupported setting: ${key}.`);
  const next={...current,...candidate};
  next.map=assertMapId(next.map);
  if(!finite(next.troops,1,1_000_000_000)) throw new TypeError('settings.troops must be finite and between 1 and 1000000000.');
  if(!finite(next.gold,0,1_000_000_000)) throw new TypeError('settings.gold must be finite and between 0 and 1000000000.');
  if(!Number.isSafeInteger(next.teams)||next.teams<0||next.teams>4) throw new TypeError('settings.teams must be an integer from 0 to 4.');
  for(const key of BOOLEAN_SETTING_NAMES) if(typeof next[key]!=='boolean') throw new TypeError(`settings.${key} must be boolean.`);
  if(!['string','number'].includes(typeof next.seed)||typeof next.seed==='number'&&!Number.isFinite(next.seed)||typeof next.seed==='string'&&(next.seed.length>200||/[\u0000-\u001f\u007f]/.test(next.seed))) throw new TypeError('settings.seed must be a finite number or a short string.');
  if(next.customBots!=null){
    if(!Array.isArray(next.customBots)||next.customBots.length>9) throw new TypeError('settings.customBots must contain at most 9 entries.');
    next.customBots.forEach((bot,index)=>assertIdentity(bot,`settings.customBots[${index}]`));
  }
  return next;
}
