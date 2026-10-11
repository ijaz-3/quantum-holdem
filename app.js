(() => {
  'use strict';
  const { Game, SUITS, SUIT_NAMES, STREETS, candidateLabel } = QuantumHoldem;
  const $ = id => document.getElementById(id);
  const game = new Game();
  let settings={novaVisibility:'showdown',advanced:false};
  try{const saved=JSON.parse(localStorage.getItem('quantum-holdem-settings-v1'));if(saved&&['always','showdown','never'].includes(saved.novaVisibility))settings={novaVisibility:saved.novaVisibility,advanced:!!saved.advanced};}catch(_){}
  let inspectedIndex=0,inspectorOwner='you',lastEffect=null,previewEffect=null;
  const novaVisible=()=>settings.novaVisibility==='always'||(settings.novaVisibility==='showdown'&&game.showdown);
  let measurementBasis = 'Z';
  let thinkingTimer = null, sound = false, audioContext = null, lastStreet = -1, lastHand = -1, lastOver = false;
  // Expose the local match for reproducible browser checks, never used by Nova's policy.
  window.quantumGame = game;
  const number = value => value.toLocaleString();
  const percent = value => value < 1e-9 ? '0%' : value > 1-1e-9 ? '100%' : Math.round(value*100)===100 ? '>99%' : Math.round(value*100)===0 ? '<1%' : `${Math.round(value*100)}%`;
  const suitHTML = suit => `<span class="${suit < 2 ? 'red-suit' : 'black-suit'}">${SUITS[suit]}</span>`;
  function chime(type = 'move') {
    if (!sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume();
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = type === 'win' ? 640 : type === 'lock' ? 420 : 280;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.16);
      oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 0.17);
    } catch (_) { /* Sound is optional; the game stays fully usable. */ }
  }
  function face(card,{hidden=false,winner=false}={}) {
    if(hidden)return '<div class="playing-card card-back" role="img" aria-label="Nova’s private card, face down"><span class="back-mark" aria-hidden="true">Q</span></div>';
    if(!card)return '<div class="playing-card unknown" role="img" aria-label="Community card not yet dealt"><span class="card-symbol" aria-hidden="true">·</span></div>';
    const known=card.suit!==null&&card.suit!==undefined,quantum=!!card.options&&!known;
    const labels=known?`${card.rank} of ${SUIT_NAMES[card.suit]}`:`${candidateLabel(card,0)} or ${candidateLabel(card,1)}, unresolved`;
    const symbol=known?`<span class="card-symbol" aria-hidden="true">${SUITS[card.suit]}</span>`:`<span class="quantum-faces" aria-hidden="true"><span>${card.ranks[0]}${suitHTML(card.options[0])}</span><small>or</small><span>${card.ranks[1]}${suitHTML(card.options[1])}</span></span>`;
    return `<div class="playing-card ${known&&card.suit<2?'red':''} ${quantum?'quantum':''} ${winner?'winning':''}" role="img" aria-label="${labels}, deck ${card.deck+1}"><span class="card-rank" aria-hidden="true">${known?card.rank:'ψ'}<small>${known?SUITS[card.suit]:'◇'}</small></span>${symbol}<span class="card-badge" aria-hidden="true">${quantum?(card.type==='linked'?'LINKED':'TUNABLE')+' · ':''}D${card.deck+1}</span></div>`;
  }
  function winningCard(card, owner) {
    const result = game.result;
    if (!result || !game.showdown || !(result.winner === owner || result.winner === 'split')) return false;
    return result[owner].cards.some(c => c.rank === card.rank && c.suit === card.suit && c.deck === card.deck);
  }
  function yourCard(card, index) {
    const chance = game.cardOdds('you', index);
    const readout = card.readout && card.readout.basis !== 'Z' ? `${card.readout.basis}: ${card.readout.outcome === 0 ? '+' : '−'}${card.readout.basis === 'Y' ? 'i' : ''}` : null;
    const detail = card.locked ? `${card.rank} of ${SUIT_NAMES[card.suit]}` : readout ? `${readout} · face still unresolved` : `${percent(chance[0])} / ${percent(chance[1])}`;
    const canLock = game.canMove('you', index);
    const next = game.preview('you', index, ['H']);
    const outlook=game.handOutlook('you',index);
    const quickTune = !card.locked ? `<button class="quick-tune" type="button" data-interfere="${index}" ${canLock ? '' : 'disabled'} aria-label="Mix ${card.type} card, one move. Resulting odds ${candidateLabel(card,0)} ${percent(next[0])}, ${candidateLabel(card,1)} ${percent(next[1])}">Mix · 1 move<small>${candidateLabel(card,0)} ${percent(next[0])} / ${candidateLabel(card,1)} ${percent(next[1])}</small></button>` : '';
    return `<article class="private-card">${face(card, { winner: winningCard(card, 'you') })}<div class="card-info"><h3>${index === 0 ? '01 · TUNABLE' : '02 · LINKED'} · D${card.deck + 1}</h3><p class="card-options">${candidateLabel(card,0)} <span aria-hidden="true">/</span> ${candidateLabel(card,1)}</p><p class="card-subtitle">${detail}</p><div class="card-outlook">${game.street?[0,1].filter(b=>!card.locked||card.readout.outcome===b).map(b=>`<span><b>${candidateLabel(card,b)}</b> → ${outlook[b]}</span>`).join(''):'See the flop, then compare faces.'}</div>${quickTune}<button class="lock-button ${card.locked ? 'locked' : ''}" type="button" data-lock="${index}" ${canLock ? '' : 'disabled'} aria-label="${card.locked ? `${card.type} card is locked` : `Measure ${card.type} card in ${measurementBasis}, costs one move`}">${card.locked ? 'Card locked ✓' : measurementBasis === 'Z' ? 'Lock face · 1 move' : `Read ${measurementBasis} · 1 move`}</button></div></article>`;
  }
  function renderOdds() {
    const card = game.cards.you[0], odds = game.cardOdds('you', 0);
    $('odds').innerHTML = `<div class="odds-row"><span>${candidateLabel(card,0)}<b>${percent(odds[0])}</b></span><span>${candidateLabel(card,1)}<b>${percent(odds[1])}</b></span></div><div class="odds-track" role="img" aria-label="${candidateLabel(card,0)} ${percent(odds[0])}, ${candidateLabel(card,1)} ${percent(odds[1])}"><span style="width:${odds[0] * 100}%"></span></div><p class="odds-caption">${card.locked ? 'Exact card revealed. Tuning is finished.' : 'Current face odds · your card is still in play'}</p>`;
    $('tunableWaveView').innerHTML=StateView.miniHTML(card.state,[0,1].map(b=>candidateLabel(card,b)));
    const next = game.preview('you', 0, ['H']);
    $('interferePreview').textContent = card.locked ? 'This card is already locked' : `After: ${candidateLabel(card,0)} ${percent(next[0])} · ${candidateLabel(card,1)} ${percent(next[1])}`;
    const flipped = game.preview('you', 0, ['Z', 'H']);
    $('phasePreview').textContent = card.locked ? 'This card is already locked' : `Then interfere: ${candidateLabel(card,0)} ${percent(flipped[0])} · ${candidateLabel(card,1)} ${percent(flipped[1])}`;
    $('advancedToggle').setAttribute('aria-expanded',String(settings.advanced));
    $('advancedToggle').textContent=settings.advanced?'Fewer controls ▴':'More quantum options · Z / S / X / Y ▾';
    document.querySelectorAll('.phase-buttons').forEach(el=>el.hidden=!settings.advanced);
    for(const option of $('measurementBasis').options)if(option.value!=='Z'){option.hidden=!settings.advanced;option.disabled=!settings.advanced;}
    $('phaseHint').textContent = game.moves.you < 2 ? 'You need two unused moves to flip phase and then interfere. Phase flip alone does not change face odds.' : 'Phase flip leaves current face odds unchanged. Follow it with Interfere to get the alternative odds shown above. Together they cost both moves.';
    $('interfereButton').disabled = !game.canMove('you'); $('phaseButton').disabled = !game.canMove('you');
    $('quarterPhaseButton').disabled = !game.canMove('you');
    $('measurementBasis').disabled = game.over || game.turn !== 'you';
    $('measurementBasis').value=measurementBasis;
    $('basisHint').textContent = measurementBasis === 'Z' ? 'Z chooses and locks one complete face: rank and suit.' : `${measurementBasis} reads ${measurementBasis === 'X' ? 'plus / minus' : '+i / −i'}, not a card face. It changes the state used at showdown.`;
    $('tuneState').textContent = card.locked ? 'LOCKED' : 'UNRESOLVED';
    $('moveTokens').innerHTML = [0, 1].map(i => `<span class="${i >= game.moves.you ? 'spent' : ''}"></span>`).join('');
    $('moveTokens').setAttribute('aria-label', `${game.moves.you} quantum moves remaining`);
  }
  function renderLink() {
    const own = game.cards.you[1], other = game.cards.nova[1];
    const ownLabel=own.locked?`${own.rank}${SUITS[own.suit]}`:`${candidateLabel(own,0)} / ${candidateLabel(own,1)}`;
    const odds = game.rivalOdds('you'), known = odds.findIndex(p => p > 1 - 1e-9);
    const otherLabel=novaVisible()?(other.locked?`${other.rank}${SUITS[other.suit]}`:`${candidateLabel(other,0)} / ${candidateLabel(other,1)}`):known>=0?`${candidateLabel(own,known)} · inferred`:'Hidden';
    $('linkDiagram').innerHTML = `<div class="link-node"><small>YOU</small><strong>${ownLabel}</strong></div><span class="link-connector" aria-hidden="true">↔</span><div class="link-node"><small>NOVA</small><strong class="${known >= 0 ? 'link-inferred' : ''}">${otherLabel}</strong></div>`;
    $('linkedWaveView').innerHTML=StateView.miniHTML(stateFor('you',1),own.options.map(s=>SUITS[s]));
    const joint = game.beliefs.you.jointZ(), same = joint[0] + joint[3];
    $('linkHint').textContent=game.showdown&&novaVisible()?'Both actual cards are revealed.':known>=0?`You earned Nova’s linked face: ${candidateLabel(own,known)}. A later gate can make this inference uncertain.`:`Public link: both decks share ${candidateLabel(own,0)} / ${candidateLabel(own,1)}. Initially, one player gets each face; gates can change that relation.`;
    if(game.canMove('you',1)&&known<0){const bases=['Z','X','Y'],gains=bases.map(b=>game.linkInformation('you',b)),best=gains.indexOf(Math.max(...gains));$('linkHint').textContent+=gains[best]>.1?` For information about Nova’s final face, ${bases[best]} is useful now${bases[best]!=='Z'&&!settings.advanced?' (open More quantum options)':''}. Z commits your own card; phase readouts do not.`:' No single readout currently predicts Nova’s Z face. Tuning and information are different goals.';}
    const mixed = game.beliefs.you.clone().gate('H',0).jointZ(), mixedSame = mixed[0] + mixed[3];
    $('linkPreview').textContent = `After: ${percent(mixedSame)} same / ${percent(1-mixedSame)} opposite faces`;
    $('linkInterfereButton').disabled = !game.canMove('you', 1); $('linkPhaseButton').disabled = !game.canMove('you', 1); $('linkQuarterPhaseButton').disabled = !game.canMove('you', 1);
  }
  function updateBetLabel() {
    const target = Number($('betSize').value);
    $('betOutput').textContent = number(target);
    $('betButton').textContent = `${game.due ? 'Raise to' : 'Bet'} ${number(target)}`;
    $('betSize').setAttribute('aria-valuetext', `${game.due ? 'Raise to' : 'Bet'} ${target} chips`);
  }
  function renderBetting() {
    const available = !game.over && game.turn === 'you', max = game.maxBet;
    const canRaise = max > Math.max(game.bets.you, game.bets.nova), min = Math.min(max, game.minimumRaise);
    $('foldButton').disabled = !available;
    $('checkCallButton').disabled = !available;
    $('checkCallButton').textContent = game.due ? `Call ${number(game.due)}` : 'Check';
    $('betLabel').textContent = game.due ? 'Raise to' : 'Bet size';
    const slider = $('betSize'), newStreet = lastStreet !== game.street || lastHand !== game.hand;
    slider.min = min; slider.max = Math.max(min, max);
    slider.value = Math.max(min, Math.min(max, newStreet ? 40 : Number(slider.value)));
    [slider, $('betButton'), $('potBetButton'), $('allInButton')].forEach(el => { el.disabled = !available || !canRaise; });
    updateBetLabel(); lastStreet = game.street; lastHand = game.hand;
    $('bettingControls').hidden = game.over; $('handResult').hidden = !game.over;
    $('handReview').hidden=!game.over;
    $('exportHandButton').hidden = !game.showdown||settings.novaVisibility==='never';
  }
  function renderResult() {
    if (!game.over) return;
    const result = game.result;
    $('resultTitle').textContent = result.winner === 'split' ? 'A split pot.' : result.winner === 'you' ? `You take ${number(result.pot)}.` : `Nova takes ${number(result.pot)}.`;
    $('resultDetail').textContent = result.folded ? `${result.winner === 'you' ? 'Nova' : 'You'} folded.` : `You: ${result.you.name.toLowerCase()}. ${settings.novaVisibility==='never'?'Nova’s cards remain hidden.':`Nova: ${result.nova.name.toLowerCase()}.`}`;
    $('resultEyebrow').textContent = 'HAND COMPLETE';
    $('handReview').innerHTML='<summary>Review your quantum decisions</summary>'+game.visualEvents.filter(e=>e.owner==='you'&&!e.automatic).map(e=>'<p>'+StateView.escape((e.action==='measure'?'Read '+e.basis:e.action)+' · '+game.describeChange('you',e.index,e.before.you,e.after.you,e.context))+'</p>').join('')+'<p>Forecasts explain your choices; they do not prove a move caused the win or loss.</p>';
    if (game.matchOver) {
      const difference = game.stacks.you - game.stacks.nova;
      $('resultEyebrow').textContent = difference > 0 ? 'MATCH WON' : difference < 0 ? 'MATCH LOST' : 'MATCH DRAWN';
      $('resultDetail').textContent += ` Final stacks: you ${number(game.stacks.you)}, Nova ${number(game.stacks.nova)}.`;
      $('nextButton').textContent = 'Play again →';
    } else $('nextButton').textContent = 'Next hand →';
  }
  function strategy() {
    if(game.over)return 'Next hand: fresh cards and two new quantum moves.';
    if(!game.moves.you)return 'Moves spent. Use your current card odds and linked information to bet.';
    if(!game.street)return 'Wait for the flop: either face can build a pair or a straight. Preview H before spending a move.';
    return 'Compare the made hands beneath each card. Mix for a better face, or read the link to learn what Nova can hold. Z commits; X/Y keep tuning open.';
  }
  function stateFor(owner,index){return index===0?game.cards[owner][0].state.clone():game.showdown&&novaVisible()?game.linked.clone():game.beliefs[owner].clone();}
  function renderDesk(){
    if(inspectorOwner==='nova'&&settings.novaVisibility!=='always')inspectorOwner='you';
    document.querySelectorAll('[data-inspect]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.inspect)===inspectedIndex)));
    $('inspectNova').hidden=settings.novaVisibility!=='always';$('inspectNova').setAttribute('aria-pressed',String(inspectorOwner==='nova'));
    const effect=previewEffect||lastEffect,options=[0,1].map(b=>candidateLabel(game.cards[inspectorOwner][inspectedIndex],b));
    $('decisionWhy').textContent='Choose a gate to compare what changes. Spending both moves on this card leaves none for the link.';
    $('stateDeskTitle').textContent=inspectorOwner==='nova'?'Nova’s knowledge · training':'Your state desk';
    if(effect&&effect.index===inspectedIndex){
      const before=effect.before[inspectorOwner],after=effect.after[inspectorOwner];
      if(before&&after){
        $('decisionWhy').textContent=game.describeChange(inspectorOwner,inspectedIndex,before,after,effect.context||game.decisionContext());
        $('stateDesk').innerHTML=StateView.effectHTML(before,after,{action:effect.action,basis:effect.basis||'Z',qubit:inspectedIndex===0?0:effect.owner==='you'?0:1,options,actor:effect.owner==='you'?'You':'Nova',target:inspectedIndex===0?'tunable card':'linked pair',preview:!!previewEffect,outcome:effect.owner===inspectorOwner&&effect.action==='measure'?effect.outcome:null,privateReadout:effect.owner!==inspectorOwner&&effect.action==='measure',brief:true});
      }else {$('decisionWhy').textContent='Nova’s independent change is private. Your own card is not changed by it.';$('stateDesk').innerHTML='<div class="state-private-note">Nova applied a quantum operation to its independent card. That state stays private in this visibility mode, and your own card does not change. Choose “Always” in Settings to inspect Nova’s state for learning.</div>'+StateView.stateHTML(stateFor('you',inspectedIndex),{options,title:'Your card · unchanged',brief:true});}
    }else $('stateDesk').innerHTML=StateView.stateHTML(stateFor(inspectorOwner,inspectedIndex),{options,title:inspectedIndex===0?'Current card state':'Current shared-state knowledge',brief:true});
    $('stateDeskKey').innerHTML=StateView.guideHTML();
    $('stateDeskHint').textContent=previewEffect?'Preview only: no move spent. Click the gate to apply it.':inspectorOwner==='nova'?'Training view shows Nova’s own knowledge; it does not include your private readouts.':inspectedIndex===1?'The pair is shown in order you, Nova. This is your knowledge, not an unseen private readout.':'Hover or focus a gate for a before/after preview. Phase arrows turn even when probability bars stay unchanged.';
  }
  function openState(){if(matchMedia('(max-width:1179px)').matches)$('statePanel').classList.add('state-peek');}
  function showEffect(event){if(!event)return;previewEffect=null;lastEffect=event;inspectedIndex=event.index;inspectorOwner=event.owner==='nova'&&settings.novaVisibility==='always'?'nova':'you';renderDesk();}
  function previewGate(action,index){
    if(!game.canMove('you',index))return;
    inspectedIndex=index;inspectorOwner='you';const before=stateFor('you',index),after=before.clone().gate(action,index===0?0:0);
    previewEffect={owner:'you',index,action,before:{you:before},after:{you:after},context:game.decisionContext()};renderDesk();
  }
  function humanMove(action,index=0,basis='Z'){
    if(!game.move('you',action,index,basis))return false;
    PlaytestStore.record('quantum',{hand:game.hand,street:game.street,index,action,basis,movesLeft:game.moves.you,advanced:settings.advanced});
    showEffect(game.visualEvents[game.visualEvents.length-1]);openState();chime(action==='measure'?'lock':'move');render();return true;
  }
  function activityHTML(event){
    const meta=event.quantum,badge=meta?`<span class="activity-gate">${meta.action==='measure'?'M'+meta.basis:meta.action}</span>`:'';
    const details=meta?` <button type="button" class="quiet-button activity-view" data-view-event="${meta.visual}">See change</button>`:'';
    return`<li class="${meta?'quantum-event':''}"><span>${event.street}</span>${badge}${StateView.escape(event.text)}${details}</li>`;
  }
  function render() {
    if(game.over&&!lastOver){lastEffect=null;previewEffect=null;}
    $('handNumber').innerHTML = `Hand ${game.hand} <span>/ ${game.limit}</span>`;
    $('matchScore').textContent = `You ${game.stats.wins} · Nova ${game.stats.losses}${game.stats.splits ? ` · Ties ${game.stats.splits}` : ''}`;
    $('youStack').textContent = number(game.stacks.you); $('novaStack').textContent = number(game.stacks.nova);
    $('youBet').textContent = !game.over && game.bets.you ? `· ${game.bets.you} in` : ''; $('novaBet').textContent = !game.over && game.bets.nova ? `· ${game.bets.nova} in` : '';
    $('pot').textContent = number(game.over ? game.result.pot : game.pot);
    $('street').textContent = game.showdown ? 'SHOWDOWN' : STREETS[game.street].toUpperCase();
    $('novaMoves').textContent = `${game.moves.nova} quantum move${game.moves.nova === 1 ? '' : 's'}`;
    $('novaState').textContent = game.turn === 'nova' ? 'Thinking…' : game.over ? 'Hand complete' : 'Watching the table';
    $('youState').textContent = game.over ? 'Hand complete' : game.turn === 'you' ? 'Your move' : 'Nova’s move';
    $('youState').classList.toggle('active', game.turn === 'you');
    $('novaCards').innerHTML = game.cards.nova.map((card, index) => `<div class="opponent-card">${face(card, { hidden: !novaVisible(), winner: winningCard(card, 'nova') })}<small>${index === 0 ? 'Tunable' : 'Linked'}${card.locked && !game.showdown ? ' · locked' : ''}</small>${settings.novaVisibility==='always'?`<span class="nova-quantum-info">${game.cardOdds('nova',index).map(percent).join(' / ')}${card.readout?` · ${card.readout.basis} ${card.readout.outcome===0?'+':'−'}${card.readout.basis==='Y'?'i':''}`:''}</span>`:''}</div>`).join('');
    $('yourCards').innerHTML = game.cards.you.map(yourCard).join('');
    const visible = game.visibleBoard;
    $('board').innerHTML = Array.from({ length: 5 }, (_, index) => face(visible[index], { winner: !!visible[index] && (winningCard(visible[index], 'you') || winningCard(visible[index], 'nova')) })).join('');
    $('boardHint').textContent = game.showdown ? 'Best five-card hand wins. The winning hand is highlighted.' : game.over ? 'The hand ended with a fold.' : game.street === 0 ? 'Community cards arrive after each betting round.' : 'Community cards are classical. Unlocked private cards resolve at showdown.';
    $('status').textContent = game.over ? game.history[game.history.length - 1].text : game.turn === 'nova' ? 'Nova is considering its cards and the visible board…' : game.due ? `Nova is betting. Call ${game.due}, raise, or fold. You can still use a quantum move first.` : game.street === 0 && game.history[game.history.length - 1].text.startsWith('Hand') ? 'Tune a card, lock a face, or check to see what Nova does.' : `${game.history[game.history.length - 1].text} Your move.`;
    $('strategyNote').textContent = strategy();
    $('activityLog').innerHTML = game.history.filter(event => event.hand === game.hand).slice(-18).reverse().map(activityHTML).join('');
    renderOdds(); renderLink(); renderBetting(); renderResult();
    renderDesk();
    if (game.over && !lastOver) $('nextButton').focus({ preventScroll: true });
    lastOver = game.over;
  }
  function respondLater() {
    clearTimeout(thinkingTimer);
    if (game.turn !== 'nova' || game.over) return;
    thinkingTimer = setTimeout(() => { const previous=game.visualEvents.length;game.respond();const events=game.visualEvents.slice(previous).filter(e=>!e.automatic);if(events.length)showEffect(events[events.length-1]);chime(game.over && game.result.winner === 'you' ? 'win' : 'move'); render(); }, 550);
  }
  function betting(action, target = 0) { if (!game.act(action, target)) return;PlaytestStore.record('betting',{hand:game.hand,street:game.street,action,movesLeft:game.moves.you}); $('statePanel').classList.remove('state-peek');chime(); render(); respondLater(); }
  $('yourCards').addEventListener('click', event => {
    const tune = event.target.closest('[data-interfere]');
    if (tune && humanMove('H', Number(tune.dataset.interfere))) {
      if (event.detail === 0) ($('yourCards').querySelector('[data-interfere]:not(:disabled)') || $('checkCallButton')).focus({ preventScroll: true });
      return;
    }
    const button = event.target.closest('[data-lock]');
    if (button && humanMove('measure', Number(button.dataset.lock), measurementBasis)) {
      const index = Number(button.dataset.lock), card = game.cards.you[index];
      const outcome = measurementBasis === 'Z' ? `${card.rank} of ${SUIT_NAMES[card.suit]}` : `${measurementBasis} ${card.readout.outcome === 0 ? '+' : '−'}${measurementBasis === 'Y' ? 'i' : ''}; face unresolved`;
      $('status').textContent = `Measurement: ${outcome}. ${game.moves.you} quantum moves left. ${index === 1 ? 'Check the updated linked prediction.' : ''}`;
      if (event.detail === 0) ($('yourCards').querySelector('[data-lock]:not(:disabled)') || $('checkCallButton')).focus({ preventScroll: true });
    }
  });
  [['interfereButton','H',0],['phaseButton','Z',0],['quarterPhaseButton','S',0],['linkInterfereButton','H',1],['linkPhaseButton','Z',1],['linkQuarterPhaseButton','S',1]].forEach(([id,action,index])=>{
    $(id).addEventListener('click',()=>humanMove(action,index));
    $(id).addEventListener('mouseenter',()=>previewGate(action,index));$(id).addEventListener('focus',()=>previewGate(action,index));
    $(id).addEventListener('mouseleave',()=>{previewEffect=null;renderDesk();});
  });
  document.querySelectorAll('[data-inspect]').forEach(button=>button.addEventListener('click',()=>{inspectedIndex=Number(button.dataset.inspect);inspectorOwner='you';lastEffect=null;previewEffect=null;renderDesk();}));
  $('inspectNova').addEventListener('click',()=>{inspectorOwner=inspectorOwner==='nova'?'you':'nova';lastEffect=null;previewEffect=null;renderDesk();});
  $('openStateDesk').addEventListener('click',openState);
  $('closeStateDesk').addEventListener('click',()=>{$('statePanel').classList.remove('state-peek');$('openStateDesk').focus({preventScroll:true});});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')$('statePanel').classList.remove('state-peek');});
  $('activityLog').addEventListener('click',event=>{const button=event.target.closest('[data-view-event]');if(button){showEffect(game.visualEvents[Number(button.dataset.viewEvent)]);openState();}});
  $('measurementBasis').addEventListener('change', event => { measurementBasis = event.target.value; render(); });
  $('foldButton').addEventListener('click', () => betting('fold'));
  $('checkCallButton').addEventListener('click', () => betting(game.due ? 'call' : 'check'));
  $('betButton').addEventListener('click', () => betting('bet', Number($('betSize').value)));
  $('betSize').addEventListener('input', updateBetLabel);
  $('potBetButton').addEventListener('click', () => { $('betSize').value = Math.min(game.maxBet, Math.max(Number($('betSize').min), Math.max(game.bets.you, game.bets.nova) + Math.round(game.pot / 20) * 10)); updateBetLabel(); });
  $('allInButton').addEventListener('click', () => { $('betSize').value = game.maxBet; updateBetLabel(); });
  $('nextButton').addEventListener('click', () => {
    clearTimeout(thinkingTimer); if (game.matchOver) game.reset(); else game.startHand();lastEffect=null;previewEffect=null;inspectorOwner='you';inspectedIndex=0;$('statePanel').classList.remove('state-peek');render();
    $('checkCallButton').focus();
  });
  $('exportHandButton').addEventListener('click', () => {
    if (!game.showdown||settings.novaVisibility==='never') return;
    const trace = { version: 3, encoding:'two-complete-faces', initialQuantum: game.initialQuantum, quantumEvents: game.quantumEvents, cards: game.cards, board: game.board, result: game.result };
    const url = URL.createObjectURL(new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `quantum-holdem-hand-${game.hand}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('rulesButton').addEventListener('click', () => $('rulesDialog').showModal());
  $('rulesGateGuide').innerHTML=Object.entries(StateView.operations).map(([key,operation])=>`<article><h3>${StateView.escape(operation.name)}</h3><code>${StateView.escape(operation.formula)}</code><p>${StateView.escape(operation.text)}</p>${['H','Z','S'].includes(key)?'<p>On a linked card, this acts only on your half. Watch the four joint amplitudes and the basis-correlation rows in the state desk.</p>':''}</article>`).join('');
  function updateSettings(){
    $('novaVisibility').value=settings.novaVisibility;
    $('visibilityExplanation').textContent=settings.novaVisibility==='always'?'Training view reveals Nova’s ranks, face candidates, private readouts, and its state inspector. It does not pick an outcome for an unmeasured card.':settings.novaVisibility==='never'?'Nova’s card faces stay hidden even after showdown. Faces you infer through your own quantum measurement remain available.':'Nova’s independent candidates and private readouts stay hidden until showdown. Linked candidates are a public contract; the actual face must be learned.';
  }
  $('advancedToggle').addEventListener('click',()=>{settings.advanced=!settings.advanced;if(!settings.advanced)measurementBasis='Z';try{localStorage.setItem('quantum-holdem-settings-v1',JSON.stringify(settings));}catch(_){}PlaytestStore.record('control-view',{advanced:settings.advanced});render();});
  $('recordPlaytest').checked=PlaytestStore.enabled();
  $('recordPlaytest').addEventListener('change',event=>PlaytestStore.consent(event.target.checked));
  $('settingsButton').addEventListener('click',()=>{updateSettings();$('settingsDialog').showModal();});
  $('novaVisibility').addEventListener('change',event=>{settings.novaVisibility=event.target.value;try{localStorage.setItem('quantum-holdem-settings-v1',JSON.stringify(settings));}catch(_){}lastEffect=null;previewEffect=null;inspectorOwner='you';updateSettings();render();});
  $('rulesDialog').addEventListener('click', event => { if (event.target === $('rulesDialog')) { const box = $('rulesDialog').getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('rulesDialog').close(); } });
  $('soundButton').addEventListener('click', () => { sound = !sound; $('soundButton').textContent = `Sound ${sound ? 'on' : 'off'}`; $('soundButton').setAttribute('aria-pressed', String(sound)); chime(); });
  $('fullscreenButton').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch (_) { $('status').textContent = 'Full screen is unavailable in this browser. You can keep playing here.'; }
  });
  document.addEventListener('fullscreenchange', () => { $('fullscreenButton').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; });
  render();
})();
