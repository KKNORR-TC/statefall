const assert=require('node:assert/strict'),fs=require('fs'),{createHash}=require('crypto'),boot=require('../harness'),{replayScenario}=require('../parity-corpus-driver');
const options={seed:'CLASSICCOAST01',map:process.argv[2]||'random',diff:process.argv[3]||'supereasy',countryIdx:0,endgame:true,instant:true,billionaire:true,fog:true};
const game=boot(options),{S,engine}=game,systems=engine.compatibility.systems,actors=engine.compatibility.state.actors;
const observed={structures:new Set(),ships:new Set(),aircraft:new Set(),activeAircraft:new Set(),transports:new Set(),spy:false,merchant:false,truck:false,missile:false,shell:false},checkpoints=[],durations=[];
const observe=()=>{for(const st of S.structures)if(st.owner===S.me.id)observed.structures.add(st.type);for(const w of S.warships)if(w.owner===S.me.id)observed.ships.add(w.cls);for(const a of S.aircraft)if(a.owner===S.me.id){observed.aircraft.add(a.type);if(a.state!=='hangar')observed.activeAircraft.add(a.type);}for(const t of S.transports)if(t.owner===S.me.id)observed.transports.add(t.heavy?'heavy':'normal');observed.spy||=actors.planes.some(a=>a.owner===S.me.id);observed.merchant||=actors.traders.length>0;observed.truck||=actors.trucks.some(a=>a.owner===S.me.id);observed.missile||=S.missiles.length>0;observed.shell||=actors.shells.length>0;};
const advance=n=>{for(let i=0;i<n;i++){const before=S.tickN,t=performance.now();game.tick();durations.push(performance.now()-t);assert.equal(S.tickN,before+1);observe();if(S.tickN%100===0){assert.deepEqual(engine.checkInvariants(),[]);const h=S.CMD.hashes.at(-1);checkpoints.push({tick:S.tickN,legacyHash:h[1],...h[2]});}}};
const menu=(act,t,site=-1,extra={},selected=[],ratio=10)=>S.issueMenu({act,...extra},t,selected,site,ratio,0,0);
const own=()=>S.ownTilesOf(S.me.id),distance=(a,b)=>Math.hypot(a%S.W-b%S.W,Math.floor(a/S.W)-Math.floor(b/S.W));
// Choose protected owned sites so the roster exercise is not invalidated by
// an exposed first-row port being conquered during its upgrade timer.
const distanceFromEnemy=new Int32Array(S.W*S.H).fill(-1),queue=new Int32Array(S.W*S.H);
let head=0,tail=0;
for(let t=0;t<distanceFromEnemy.length;t++)if(S.land[t]&&S.owner[t]!==S.me.id){distanceFromEnemy[t]=0;queue[tail++]=t;}
while(head<tail){const t=queue[head++],x=t%S.W,y=Math.floor(t/S.W);for(const n of [x<S.W-1?t+1:-1,x?t-1:-1,y<S.H-1?t+S.W:-1,y?t-S.W:-1])if(n>=0&&distanceFromEnemy[n]<0){distanceFromEnemy[n]=distanceFromEnemy[t]+1;queue[tail++]=n;}}
const build=(type,{near=null,limit=Infinity,away=null}={})=>{const tiles=own().filter(t=>(near===null||distance(t,near)<=limit)&&(away===null||distance(t,away)>36));if(near!==null)tiles.sort((a,b)=>distance(a,near)-distance(b,near));else tiles.sort((a,b)=>distanceFromEnemy[b]-distanceFromEnemy[a]||a-b);const t=tiles.find(t=>engine.queries.snapBuild(S.me.id,t,type,0)===t);assert.notEqual(t,undefined,'no build site for '+type);menu('build',t,-1,{type});const st=S.structures.find(st=>st.owner===S.me.id&&st.type===type&&st.t===t);assert.ok(st,'build failed '+type);observe();return st;};
S.issue('airAuto',false);S.issue('logAuto',false);S.issue('autoFire',false);
const port=build('port'),field=build('airfield',{near:port.t}),water=systems.naval.waterNeighbor(port.t);
const enemies=Array.from(S.owner,(_,t)=>t).filter(t=>S.land[t]&&S.owner[t]!==S.me.id&&S.isCoast(t)).sort((a,b)=>distance(a,port.t)-distance(b,port.t));
for(const t of enemies.slice(0,60)){const before=S.transports.length;menu('transport',t);observe();if(S.transports.length>before)break;}
menu('upgrade',port.t,port.t);menu('upgrade',field.t,field.t);
for(const cls of Object.keys(S.SHIPS).filter(c=>!S.SHIPS[c].sub)){menu('warship',water,-1,{cls});assert.ok(S.warships.some(w=>w.cls===cls&&w.owner===S.me.id),'ship launch failed '+cls);}
for(const type of Object.keys(S.STRUCT).filter(t=>!['port','airfield','subbase'].includes(t)))build(type,{away:port.t});
advance(901);
assert.equal(port.level,2,'port upgrade state '+JSON.stringify({present:S.structures.includes(port),port,tileOwner:S.owner[port.t]}));assert.equal(field.level,2,'airfield upgrade state '+JSON.stringify({present:S.structures.includes(field),field,tileOwner:S.owner[field.t]}));
build('subbase',{near:port.t,limit:34});
for(const cls of ['sub','hunter']){menu('warship',water,-1,{cls});assert.ok(S.warships.some(w=>w.cls===cls&&w.owner===S.me.id),'ship launch failed '+cls);}
for(const act of ['buyf','buyb','buyc'])menu(act,field.t,field.t);advance(4);
const target=Array.from(S.owner,(_,t)=>t).find(t=>S.land[t]&&S.owner[t]!==S.me.id&&distance(t,field.t)<140);
assert.notEqual(target,undefined,'no aircraft target');
menu('fpatrol',target);menu('bstrike',target);menu('paradrop',target);menu('plane',target);S.issue('sat');observe();
for(const t of enemies.slice(0,80)){const before=S.transports.length;menu('transport',t);observe();if(S.transports.length>before)break;}
const bb=S.warships.find(w=>w.cls==='battleship'&&w.owner===S.me.id);if(bb)menu('refit',water,-1,{},[bb.id]);
menu('nuke',target);observe();
advance(1195);
for(const [key,expected]of [['structures',Object.keys(S.STRUCT)],['ships',Object.keys(S.SHIPS)],['aircraft',['fighter','bomber','carrier']],['activeAircraft',['fighter','bomber','carrier']],['transports',['normal','heavy']]])assert.deepEqual([...observed[key]].sort(),expected.sort(),key+' coverage');
assert.ok(observed.spy,'spy coverage');
const canonical={version:S.stateOracleVersion,sha256:createHash('sha256').update(S.serializeCanonicalState()).digest('hex')};
const fixture={name:'unit-campaign-'+options.map+'-'+options.diff,seed:options.seed,grid:{width:S.W,height:S.H},settings:{...S.START,diff:options.diff,country:0},controls:{},coverage:['complete-roster'],hashv:2,tick:S.tickN,cmds:structuredClone(S.CMD.log),hashes:structuredClone(S.CMD.hashes),checkpoints,final:{tick:S.tickN,legacyHash:S.stateHash(),canonical,rngDraws:S.srandN,commandCount:S.CMD.log.length,replayCursor:null}};
fs.mkdirSync('docs/evidence/comprehensive',{recursive:true});fs.writeFileSync('docs/evidence/comprehensive/'+fixture.name+'-replay.json',JSON.stringify(fixture));
const replay=replayScenario(fixture,boot);assert.deepEqual(replay.errors,[]);
durations.sort((a,b)=>a-b);const result={options,ticks:S.tickN,commands:S.CMD.log.length,observed:Object.fromEntries(Object.entries(observed).map(([k,v])=>[k,v instanceof Set?[...v]:v])),p95TickMs:durations[Math.floor(durations.length*.95)],maxTickMs:durations.at(-1),replay:'PASS'};
fs.writeFileSync('docs/evidence/comprehensive/'+fixture.name+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
