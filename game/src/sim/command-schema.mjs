export const SIMPLE_COMMAND_KINDS=Object.freeze(['focus','airAuto','logAuto','autoFire','recall','recallAll','sat','accept','decline','decShare','decWar','continueAfterEnd','surrender']);
export const MENU_ACTIONS=Object.freeze(['plane','fpatrol','bstrike','recallnear','upgrade','buyf','buyb','buyc','paradrop','sat','refit','move','blockade','warship','build','focus','unfocus','repair','repairstop','cancelship','cancel','nuke','nap','ally','war','giveTroops','giveGold','askTroops','askGold','pickreinf','pickattack','attackfrom','transportfrom','transport']);
export const COMMAND_KINDS=Object.freeze(['menu','click',...SIMPLE_COMMAND_KINDS]);
const commandKinds=new Set(COMMAND_KINDS),menuActions=new Set(MENU_ACTIONS);
const SHIP_TYPES=new Set(['scout','sub','hunter','rship','privateer','warship','cruiser','battleship']);
const BUILD_TYPES=new Set(['city','factory','port','sam','silo','fort','command','shield','battery','shore','bertha','airfield','flightops','subbase','troopcmd','engcmd','radar','lradar','satellite','jammer']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function assertCommandKind(kind){
  if(!commandKinds.has(kind)) throw new TypeError(`Unsupported command kind: ${String(kind)}.`);
  return kind;
}

export function assertMenuAction(data){
  if(!plain(data)) throw new TypeError('Menu command data must be a plain object.');
  if(!menuActions.has(data.act)) throw new TypeError(`Unsupported menu action: ${String(data.act)}.`);
  const fields=data.act==='warship'?['act','cls']:data.act==='build'?['act','type']:data.act==='attackfrom'||data.act==='transportfrom'?['act','area']:['act'];
  if(!exact(data,fields)) throw new TypeError(`Invalid data for menu action ${data.act}.`);
  if(data.act==='warship'&&!SHIP_TYPES.has(data.cls)) throw new TypeError('Invalid warship class.');
  if(data.act==='build'&&!BUILD_TYPES.has(data.type)) throw new TypeError('Invalid structure type.');
  if((data.act==='attackfrom'||data.act==='transportfrom')&&!integer(data.area)) throw new TypeError('Invalid source area ID.');
  return data.act;
}

const integer=value=>Number.isSafeInteger(value)&&value>=0;
const finite=(value,min=-Infinity,max=Infinity)=>Number.isFinite(value)&&value>=min&&value<=max;
export function assertCommandArguments(kind,args){
  if(!Array.isArray(args)) throw new TypeError('Command arguments must be an array.');
  let valid=false;
  switch(kind){
    case 'menu': valid=args.length===7&&plain(args[0])&&integer(args[1])&&Array.isArray(args[2])&&args[2].length<=10_000&&args[2].every(integer)&&new Set(args[2]).size===args[2].length&&Number.isSafeInteger(args[3])&&args[3]>=-1&&finite(args[4],0,100)&&args.slice(5).every(value=>finite(value,0,1_000_000)); if(valid) assertMenuAction(args[0]); break;
    case 'click': { const env=args[1],pick=env&&env.pick; valid=args.length===2&&integer(args[0])&&exact(env,['ratio','pick','build'])&&finite(env.ratio,0,100)&&(pick==null||exact(pick,['kind','t'])&&['attack','reinforce'].includes(pick.kind)&&integer(pick.t))&&(env.build==null||env.build==='nuke'||BUILD_TYPES.has(env.build)); break; }
    case 'focus': valid=args.length===1&&finite(args[0],0,1); break;
    case 'airAuto': case 'logAuto': case 'autoFire': valid=args.length===1&&typeof args[0]==='boolean'; break;
    case 'recall': case 'decline': valid=args.length===1&&integer(args[0]); break;
    case 'recallAll': valid=args.length===1&&(args[0]==='all'||args[0]==='dmg'); break;
    case 'sat': case 'decShare': case 'decWar': case 'surrender': valid=args.length===0; break;
    case 'continueAfterEnd': valid=args.length===1&&typeof args[0]==='boolean'; break;
    case 'accept': valid=args.length===3&&integer(args[0])&&['ally','nap','reqTroops','reqGold'].includes(args[1])&&finite(args[2],0,1_000_000_000); break;
  }
  if(!valid) throw new TypeError(`Invalid arguments for command kind ${kind}.`);
  return args;
}

export function assertCommand(command){
  if(!plain(command)) throw new TypeError('Command must be a plain object.');
  const keys=command.p==null?(command.phase==null?['t','k','a']:['t','k','a','phase']):(command.phase==null?['t','k','a','p']:['t','k','a','p','phase']);
  if(!exact(command,keys)||!integer(command.t)||command.t>10_000_000||(command.p!=null&&(!integer(command.p)||command.p>1_000_000))) throw new TypeError('Invalid command envelope.');
  assertCommandKind(command.k);
  assertCommandArguments(command.k,command.a);
  if(command.phase!=null&&(command.phase!=='post-systems'||command.k!=='continueAfterEnd')) throw new TypeError('Invalid command phase.');
  if(command.k==='continueAfterEnd'&&command.phase!=='post-systems') throw new TypeError('Continuation commands require the post-systems phase.');
  return command;
}
