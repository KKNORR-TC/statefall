// Review-only arrangement of the actual start card and its existing controls.
const $=id=>document.getElementById(id);
while($('bootStatus'))await new Promise(r=>setTimeout(r,80));
const card=document.querySelector('#start>.card');
const intro=card.querySelector('.logo').nextElementSibling;
intro.textContent='Build your economy. Expand your territory. Control 72% of the land to win.';
const navigation=document.createElement('div');navigation.className='openingChoices';
navigation.innerHTML=`<a class="learnChoice" href="/?browserTest=1&art=classic"><small>NEW TO STATEFALL?</small><strong>Learn to play →</strong><span>A guided first match: controls, building, attacking and understanding your gains.</span><em>Introductory tutorial · learn at your own pace</em></a><button id="openingNew"><strong>New match ↓</strong><span>Choose your battlefield and start a campaign.</span></button><div id="openingSaved"><strong>Pick up where you left off</strong><span>Continue a saved match or watch a replay.</span></div>`;
intro.after(navigation);$('openingSaved').append($('gamesBtn'));$('gamesBtn').style.marginLeft='0';
const panel=document.createElement('section');panel.id='openingMatch';panel.innerHTML='<h2>New match</h2><p class="muted">Start with the essentials. Customize the rules when you are ready.</p>';
navigation.after(panel);
const difficulty=$('diffSel').parentElement.parentElement;
panel.append(difficulty);
const maps=$('maps'),mapTitle=maps.previousElementSibling;panel.append(mapTitle,maps);
panel.append($('countrySel').parentElement);
const flagPicker=document.createElement('details');flagPicker.innerHTML='<summary>Browse country flags</summary>';flagPicker.append($('flags'));panel.append(flagPicker);
const options=document.createElement('details');options.innerHTML='<summary>Special rules & starting setup</summary><p class="muted">Change how the match plays. Some options have separate leaderboard classes.</p>';
const modes=$('modes'),modesTitle=modes.previousElementSibling;
const settingsButton=$('settingsBtn');
options.append(card.querySelector('.toggleRow'),$('teamSel').parentElement,modesTitle,modes,$('seedIn').parentElement,settingsButton);
settingsButton.textContent='Starting resources & allowed units';settingsButton.style.margin='12px 0 0';panel.append(options);
const actions=document.createElement('div');actions.className='openingActions';actions.append($('startBtn'));panel.append(actions);
const footer=document.createElement('footer');for(const id of ['helpBtn1','boardBtn','musicBtn']){const el=$(id);el.style.marginLeft='0';footer.append(el);}card.append(footer);
$('helpBtn1').textContent='Game guide';$('musicBtn').textContent='Music';
$('openingNew').onclick=()=>{panel.scrollIntoView({behavior:'smooth',block:'start'});$('diffSel').focus({preventScroll:true});};
const style=document.createElement('style');style.textContent=`
#start>.card{width:min(960px,94vw);text-align:left;padding:28px;max-height:94vh;overflow:auto}#start .logo{display:block;margin:auto}#start>.card>p:first-of-type{text-align:center;color:#bacbdd}.openingChoices{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;margin:24px 0}.openingChoices>a,.openingChoices>button,.openingChoices>div{display:flex;flex-direction:column;gap:12px;border:1px solid #465c74;border-radius:12px;padding:20px;text-align:left;background:#203247;color:#e8ecef;text-decoration:none;font:inherit}.openingChoices .learnChoice{background:#2e3b39;border-color:#d8b979}.openingChoices strong{font-size:20px}.openingChoices small{color:#eed298;font-size:10px;letter-spacing:1.5px}.openingChoices span,.openingChoices em{font-size:13px;line-height:1.5;color:#b9cadb}.openingChoices em{font-style:normal;color:#eed298}.openingChoices button:hover,.openingChoices a:hover{border-color:#f2ce88}#openingSaved #gamesBtn{margin-top:auto}#openingMatch{border:1px solid #41546a;border-radius:12px;padding:22px;scroll-margin:16px}#openingMatch h2{margin:0;font-size:22px}#openingMatch>p{margin:6px 0 18px}#openingMatch>div:first-of-type{grid-template-columns:1fr!important}#openingMatch #maps{grid-template-columns:repeat(4,1fr)!important;margin-bottom:18px}#openingMatch details{border-top:1px solid #435367;padding-top:16px;margin-top:18px}#openingMatch summary{cursor:pointer;font-weight:600}#openingMatch details>label{display:block;margin:14px 0}#openingMatch details #modes{margin:12px 0!important}.openingActions{margin-top:20px}#startBtn{background:#e2bd77;color:#172535;font-weight:700;padding:12px 28px}#start footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:18px;border-top:1px solid #41546a}#start footer button{background:transparent}#start>.card>p:empty{display:none}@media(max-width:700px){#start>.card{padding:18px}.openingChoices{grid-template-columns:1fr}.openingChoices>a,.openingChoices>button,.openingChoices>div{padding:16px}#openingMatch{padding:16px}#openingMatch #maps{grid-template-columns:repeat(2,1fr)!important}#openingMatch #modes{grid-template-columns:repeat(2,1fr)!important}}
`;document.head.append(style);
