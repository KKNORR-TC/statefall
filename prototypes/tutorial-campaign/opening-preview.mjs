// Review-only arrangement of the actual start card and its existing controls.
const $=id=>document.getElementById(id);
while($('bootStatus'))await new Promise(r=>setTimeout(r,80));
const card=document.querySelector('#start>.card');
const intro=card.querySelector('.logo').nextElementSibling;
intro.textContent='Build your economy. Expand your territory. Control 72% of the land to win.';
const navigation=document.createElement('div');navigation.className='openingChoices';
navigation.innerHTML=`<div class="learnChoice"><small>NEW TO STATEFALL?</small><strong>Learn to play</strong><span>Build your first city, capture territory, and understand your economy.</span><a class="tutorialLaunch" href="/?browserTest=1&art=classic">Start tutorial →</a><em>Introductory lesson · at your own pace</em></div><div id="openingSaved"><strong id="savedHeading">Games & replays</strong><span id="savedMessage">Checking for a saved game…</span><button id="openingContinue" hidden>Continue game</button></div>`;
intro.after(navigation);$('openingSaved').append($('gamesBtn'));$('gamesBtn').style.marginLeft='0';
const panel=document.createElement('section');panel.id='openingMatch';panel.innerHTML='<h2>New match</h2><p class="muted">Start with the essentials. Customize the rules when you are ready.</p>';
navigation.after(panel);
const difficulty=$('diffSel').parentElement.parentElement;
panel.append(difficulty);
const difficultyDescriptions=new Map([...$('diffSel').options].map(o=>{const [name,...rest]=o.textContent.split(' — ');o.textContent=name;return [o.value,rest.join(' — ')];}));
const difficultyHelp=document.createElement('p');difficultyHelp.id='difficultyHelp';difficultyHelp.className='muted';difficulty.after(difficultyHelp);$('diffSel').setAttribute('aria-describedby','difficultyHelp');
const maps=$('maps'),mapTitle=maps.previousElementSibling;panel.append(mapTitle,maps);
panel.append($('countrySel').parentElement);
const flagPicker=document.createElement('details');flagPicker.innerHTML='<summary>Browse country flags</summary>';flagPicker.append($('flags'));panel.append(flagPicker);
const options=document.createElement('details');options.innerHTML='<summary>Special rules & starting setup <span id="activeRules"></span></summary><p class="muted">Change how the match plays. Some options have separate leaderboard classes.</p><button id="resetStandard" type="button">Reset to standard</button>';
const modes=$('modes'),modesTitle=modes.previousElementSibling;
const settingsButton=$('settingsBtn');
options.append(card.querySelector('.toggleRow'),$('teamSel').parentElement,modesTitle,modes,$('seedIn').parentElement,settingsButton);
settingsButton.textContent='Starting resources & allowed units';settingsButton.style.margin='12px 0 0';panel.append(options);
const layoutIds=['quickStart','riskyOn','endgameOn'];
const layout=document.createElement('label');layout.innerHTML='Starting mode <select id="openingLayout" class="sel"><option value="">Standard</option><option value="quickStart">Quick start</option><option value="riskyOn">Risky start</option><option value="endgameOn">End game</option></select>';modes.before(layout);modesTitle.textContent='Additional rules';
for(const id of layoutIds)$(id).parentElement.hidden=true;
function setLayout(id){for(const key of layoutIds)$(key).checked=key===id;for(const key of layoutIds)$(key).onchange?.();$('openingLayout').value=id;}
setLayout(layoutIds.find(id=>$(id).checked)||'');
const actions=document.createElement('div');actions.className='openingActions';actions.innerHTML='<span id="openingSummary" aria-live="polite"></span>';actions.append($('startBtn'));
const footer=document.createElement('footer');for(const id of ['helpBtn1','boardBtn','musicBtn']){const el=$(id);el.style.marginLeft='0';footer.append(el);}card.append(footer);
$('helpBtn1').textContent='Game guide';$('musicBtn').textContent='Music';
card.append(actions);
const ruleLabels={garrisonOn:'Garrisons',fogOn:'Fog of war',instantOn:'Instant build',billionaireOn:'Billionaire',stPauseBuild:'Paused orders',stNoCap:'No troop cap',stBots:'Bots share starting resources'};
function updateSummary(){
 $('difficultyHelp').textContent=difficultyDescriptions.get($('diffSel').value)||'';
 const rules=Object.entries(ruleLabels).filter(([id])=>$(id).checked).map(([,label])=>label);
 if($('openingLayout').value)rules.unshift($('openingLayout').selectedOptions[0].textContent);
 if($('teamSel').value!=='0')rules.push($('teamSel').selectedOptions[0].textContent);
 if(+$('stTroops').value!==120||+$('stGold').value!==100)rules.push('Custom resources');
 if(document.querySelector('#unitsB input:not(:checked),#unitsS input:not(:checked)'))rules.push('Restricted units');
 $('activeRules').textContent=rules.length?rules.join(' · '):'Standard rules';
 $('openingSummary').textContent=[$('diffSel').selectedOptions[0].textContent,document.querySelector('#maps .on')?.textContent,$('countrySel').selectedOptions[0]?.textContent,rules.length?`${rules.length} custom rule${rules.length===1?'':'s'}`:'Standard rules'].filter(Boolean).join(' · ');
}
$('openingLayout').onchange=()=>{setLayout($('openingLayout').value);updateSummary();};
$('resetStandard').onclick=()=>{setLayout('');for(const id of Object.keys(ruleLabels))$(id).checked=false;$('teamSel').value='0';$('teamSel').dispatchEvent(new Event('change',{bubbles:true}));$('stTroops').value='120';$('stGold').value='100';for(const input of document.querySelectorAll('#unitsB input,#unitsS input')){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}updateSummary();};
document.addEventListener('change',updateSummary);card.addEventListener('click',()=>queueMicrotask(updateSummary));updateSummary();
async function loadContinue(){
 try{const result=await window.__STATEFALL_OPENING_SAVES__.latest();
 if(!result.available){$('savedMessage').textContent='Account saves are available when you play signed in on the website.';return;}
 if(!result.save){$('savedMessage').textContent='No saved match yet. Start a new match or browse your replays.';return;}
 $('savedHeading').textContent='Pick up where you left off';$('savedMessage').textContent=result.save.slot||'Your latest saved match';const button=$('openingContinue');button.hidden=false;
 button.onclick=async()=>{button.disabled=true;button.textContent='Loading…';try{await window.__STATEFALL_OPENING_SAVES__.resume(result.save);}catch{$('savedMessage').textContent='Could not load this save. Try again or open Games & replays.';}finally{button.disabled=false;button.textContent='Continue game';}};
 }catch{$('savedMessage').textContent='Could not check saved games. Open Games & replays to try again.';}
}
loadContinue();
// Guided setup: all native inputs stay mounted so the game reads the same settings.
const countryRow=$('countrySel').parentElement;
const modeStep=document.createElement('section'),countryStep=document.createElement('section'),reviewStep=document.createElement('section');
modeStep.id='setupMode';countryStep.id='setupCountry';reviewStep.id='setupReview';
modeStep.innerHTML='<h2 tabindex="-1">Pick your mode</h2><p class="muted">Choose your starting style. Standard is a good place to begin.</p>';
modeStep.append($('garrisonOn').closest('.toggleRow'),layout,options);options.open=true;
const battlefield=document.createElement('section');battlefield.id='setupBattlefield';battlefield.innerHTML='<h2 tabindex="-1">Map & difficulty</h2><p class="muted">Choose your battlefield and how challenging the opposition will be.</p>';battlefield.append(difficulty,difficultyHelp,mapTitle,maps);
countryStep.innerHTML='<h2 tabindex="-1">Pick your country</h2><p class="muted">Choose the flag you will lead into the match.</p>';countryStep.append(countryRow,flagPicker);
reviewStep.innerHTML='<h2 tabindex="-1">Ready?</h2><p class="muted">Review your match. Go back to change any selection.</p><dl id="setupRecap"></dl>';
const progress=document.createElement('p');progress.id='setupProgress';progress.textContent='Mode → Country → Summary';
panel.replaceChildren(progress,modeStep,battlefield,countryStep,reviewStep);
const entry=document.createElement('div');entry.className='matchEntry';entry.innerHTML='<button id="guidedMatch"><strong>New match →</strong><span>Pick your mode, choose your country, then review.</span></button><button id="randomMatch"><strong>Random match ↗</strong><span>Start now with a random map and difficulty.</span></button>';panel.before(entry);
actions.insertAdjacentHTML('afterbegin','<button id="setupBack" type="button">Back</button>');actions.insertAdjacentHTML('beforeend','<button id="setupNext" type="button">Next: Country →</button>');
const startButton=$('startBtn'),nextButton=$('setupNext'),backButton=$('setupBack');let setupStep=-1;
function recap(){const fields=[['Starting mode',$('openingLayout').selectedOptions[0].textContent],['Country',$('countrySel').selectedOptions[0].textContent],['Map',document.querySelector('#maps .on')?.textContent||'Continents'],['Difficulty',$('diffSel').selectedOptions[0].textContent],['Rules',$('activeRules').textContent]];const dl=$('setupRecap');dl.replaceChildren();for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}}
function showSetup(value,focus=true){const screens=[modeStep,battlefield,countryStep,reviewStep];setupStep=value;panel.hidden=value<0;entry.hidden=value>=0;navigation.hidden=value>=0;actions.hidden=value<0;screens.forEach((el,i)=>el.hidden=i!==value);startButton.hidden=value!==3;nextButton.hidden=value===3;nextButton.textContent=['Next: Map & difficulty →','Next: Country →','Next: Summary →'][value]||'';backButton.textContent=value===0?'Back to menu':'Back';progress.textContent=value<0?'':`${value+1} / 4 · Mode → Map & difficulty → Country → Summary`;updateSummary();if(value===3)recap();card.scrollTop=0;if(focus)(value<0?$('guidedMatch'):screens[value].querySelector('h2')).focus({preventScroll:true});}
$('guidedMatch').onclick=()=>showSetup(0);nextButton.onclick=()=>showSetup(setupStep+1);backButton.onclick=()=>showSetup(setupStep-1);
$('randomMatch').onclick=()=>{const choose=items=>items[Math.floor(Math.random()*items.length)];$('resetStandard').click();choose([...document.querySelectorAll('#maps button')]).click();$('diffSel').value=choose([...$('diffSel').options]).value;$('diffSel').dispatchEvent(new Event('change',{bubbles:true}));$('seedNew').click();startButton.click();};
showSetup(-1,false);
const style=document.createElement('style');style.textContent=`
#start>.card{width:min(960px,94vw);text-align:left;padding:28px;max-height:94vh;overflow:auto}#start .logo{display:block;margin:auto}#start>.card>p:first-of-type{text-align:center;color:#bacbdd}.openingChoices{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;margin:24px 0}.openingChoices>a,.openingChoices>button,.openingChoices>div{display:flex;flex-direction:column;gap:12px;border:1px solid #465c74;border-radius:12px;padding:20px;text-align:left;background:#203247;color:#e8ecef;text-decoration:none;font:inherit}.openingChoices .learnChoice{background:#2e3b39;border-color:#d8b979}.openingChoices strong{font-size:20px}.openingChoices small{color:#eed298;font-size:10px;letter-spacing:1.5px}.openingChoices span,.openingChoices em{font-size:13px;line-height:1.5;color:#b9cadb}.openingChoices em{font-style:normal;color:#eed298}.openingChoices button:hover,.openingChoices a:hover{border-color:#f2ce88}#openingSaved #gamesBtn{margin-top:auto}#openingMatch{border:1px solid #41546a;border-radius:12px;padding:22px;scroll-margin:16px}#openingMatch h2{margin:0;font-size:22px}#openingMatch>p{margin:6px 0 18px}#openingMatch>div:first-of-type{grid-template-columns:1fr!important}#openingMatch #maps{grid-template-columns:repeat(4,1fr)!important;margin-bottom:18px}#openingMatch details{border-top:1px solid #435367;padding-top:16px;margin-top:18px}#openingMatch summary{cursor:pointer;font-weight:600}#openingMatch details>label{display:block;margin:14px 0}#openingMatch details #modes{margin:12px 0!important}.openingActions{margin-top:20px}#startBtn{background:#e2bd77;color:#172535;font-weight:700;padding:12px 28px}#start footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:18px;border-top:1px solid #41546a}#start footer button{background:transparent}#start>.card>p:empty{display:none}@media(max-width:700px){#start>.card{padding:18px}.openingChoices{grid-template-columns:1fr}.openingChoices>a,.openingChoices>button,.openingChoices>div{padding:16px}#openingMatch{padding:16px}#openingMatch #maps{grid-template-columns:repeat(2,1fr)!important}#openingMatch #modes{grid-template-columns:repeat(2,1fr)!important}}
`;document.head.append(style);
style.textContent+=`.openingChoices{grid-template-columns:1.4fr 1fr}.tutorialLaunch{align-self:flex-start;padding:10px 18px;border-radius:6px;background:#e2bd77;color:#172535;text-decoration:none;font-weight:700}.openingChoices .learnChoice{border-color:#d8b979;background:#2e3b39}#difficultyHelp{font-size:13px;line-height:1.5;margin:4px 0 16px}#activeRules{display:block;font-weight:400;font-size:12px;color:#c6d3df;margin:7px 0 0}#openingLayout{display:block;width:100%;margin-top:6px}#modes label[hidden]{display:none!important}.openingActions{position:sticky;bottom:-28px;z-index:2;background:#263849;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;margin-top:12px;border-top:1px solid #52677b;box-shadow:0 -10px 20px #263849}#openingSummary{font-size:12px;color:#c6d3df;line-height:1.5}#startBtn{flex-shrink:0}#resetStandard{margin:4px 0 12px}@media(max-width:700px){.openingChoices{grid-template-columns:1fr}.openingActions{bottom:-18px;gap:10px}#startBtn{padding:12px 16px}}`;
style.textContent+=`#start [hidden]{display:none!important}.matchEntry{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.matchEntry button{padding:22px;text-align:left;display:flex;flex-direction:column;gap:10px;border-radius:12px}.matchEntry strong{font-size:20px}.matchEntry span{font-size:13px;color:#bacbdd;line-height:1.5}#setupProgress{font-size:12px;color:#e2bd77;margin:0 0 18px}#setupRecap{display:grid;grid-template-columns:130px 1fr;gap:16px;padding:20px;background:#1b2b3c;border-radius:8px}#setupRecap dt{color:#aabed0}#setupRecap dd{margin:0}#setupNext{background:#e2bd77;color:#172535;font-weight:700;padding:12px 18px}.openingActions{flex-wrap:wrap}#openingSummary{flex:1}#setupMode>label{display:block;margin-top:16px}#setupMode>details{margin-top:20px}@media(max-width:700px){.matchEntry{grid-template-columns:1fr}#setupRecap{grid-template-columns:1fr;gap:8px}#setupRecap dd{margin-bottom:10px}#openingSummary{flex-basis:50%}}`;
