(() => {
  'use strict';
  const {Density}=Quantum,{randomSource,SUITS}=QuantumHoldem;
  const $=id=>document.getElementById(id),percent=StateView.pct,options=LearningHands.labels;
  const storageKey='quantum-holdem-learning-v3';
  const definitions=[
    {title:'Build a pair, not just a flush.',eyebrow:'01 · FULL-FACE INTERFERENCE',intro:'Your tunable card is A♥ or K♠, not an ace with an unknown suit. On this fixed river board, A♥ makes a pair of aces that beats Nova’s shown queens; K♠ gives high card and loses. The two amplitudes start equal and aligned. Try H or commit with Z, one operation at a time.',pre:'For this aligned preparation, can H raise the winning chance from 50% to 100%?',preOptions:['Yes, its amplitudes can reinforce and cancel.','No, it is only a hidden coin flip.'],preCorrect:0,post:'Do identical initial face probabilities guarantee identical results after H?',postOptions:['Yes, probabilities tell the whole story.','No, phase and coherence also matter.'],postCorrect:1,actions:[{label:'Mix H, then showdown',value:'H'},{label:'Commit now with Z',value:'Z'}]},
    {title:'Read phase without pretending to read rank.',eyebrow:'02 · INCOMPATIBLE MEASUREMENTS',intro:'Use the same A♥ / K♠ card and board. You have two moves: read X or Y, then apply H. Neither phase read tells you a rank or suit. Watch the projected state: X preserves this prepared plus state; Y changes the phase. H must act on the new state. The last Z read is free at showdown.',pre:'Which inspection leaves this prepared plus state unchanged?',preOptions:['X · plus / minus','Y · +i / −i'],preCorrect:0,post:'After a Y readout, can you reuse the old H prediction without updating the state?',postOptions:['No, the readout projected a new state.','Yes, it only revealed information.'],postCorrect:0,actions:[{label:'Read X, then H',value:'X'},{label:'Read Y, then H',value:'Y'}]},
    {title:'Read, change, and tune the linked faces.',eyebrow:'03 · LINKED RANKS & SUITS',intro:'The public link is A♥ / K♠, one copy in each deck. Initially one player gets each face. Your other card is Q♣; Nova’s is 2♣. Try reading the intact link, mixing your half, or inspecting after Nova H. H can change winning chances through correlations even when both local face odds stay 50/50. Nova’s actual linked face stays hidden until the final verification.',pre:'After Nova’s H, which readout can predict its final Z face?',preOptions:['X · plus / minus','Z · my exact face'],preCorrect:0,post:'Did your choice of measurement force which face Nova received?',postOptions:['Yes, I can choose its outcome remotely.','No, I learned a random correlated outcome.'],postCorrect:1,actions:[{label:'Read intact link · Z',value:'Z'},{label:'Mix my half · H',value:'H'},{label:'After Nova H: X, then H',value:'X'},{label:'After Nova H: read Z',value:'NZ'}]}
  ];
  const fresh=()=>({version:3,encoding:'two-complete-faces',createdAt:new Date().toISOString(),participant:'anonymous-local',attempts:[]});
  let session;try{session=JSON.parse(localStorage.getItem(storageKey));}catch(_){}
  if(!session||session.version!==3||!Array.isArray(session.attempts))session=fresh();
  let active=0,attempt,prediction=null,reflected=false,current,queue=[],frames=[],path=null,rng,completed=false,moves,locked;
  const source=()=>LearningHands.source(0);
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(session));}catch(_){}}
  function card(rank,suit,hidden=false,deck=0){return `<div class="practice-card ${hidden?'back':suit<2?'red':''}" role="img" aria-label="${hidden?'Nova’s linked card, face down':rank+' '+['hearts','diamonds','clubs','spades'][suit]+', deck '+(deck+1)}">${hidden?'Q':SUITS[suit]}<small>${hidden?'?':rank}</small><span class="practice-deck">D${deck+1}</span></div>`;}
  const displayFace=c=>card(c.rank,c.suit,false,c.deck);
  const unresolved=()=>'<div class="practice-card candidate-card" role="img" aria-label="Unresolved A of hearts or K of spades, deck 1"><b>A♥</b><span>or</span><b>K♠</b><small>D1 · unresolved</small></div>';
  function summary(){const first=definitions.map((_,i)=>session.attempts.find(a=>a.lesson===i&&a.afterCorrect!==undefined)),done=first.filter(Boolean),answered=done.filter(a=>a.beforeCorrect!==null),before=answered.filter(a=>a.beforeCorrect).length,after=done.filter(a=>a.afterCorrect).length;$('courseProgress').textContent=`${done.length} / 3 completed`;$('assessmentSummary').textContent=done.length?`Full-face course · first completed attempts: predictions ${before}/${answered.length}; reflections ${after}/${done.length}. ${session.attempts.length} attempts recorded.`:'Watch each operation, then answer a reflection. Previous course logs remain stored separately.';}
  function startLesson(index){
    active=index;prediction=null;reflected=false;completed=false;queue=[];path=null;moves={you:2,nova:2};locked={you:false,nova:false};
    current=LearningHands.source(index);frames=[{state:current.clone(),moves:{...moves},locked:{...locked},verified:false,text:index===2?'Public preparation: (|A♥, K♠⟩ + |K♠, A♥⟩)/√2. Each player has 50/50 face odds, but the two faces are opposite with certainty. Decks make all outcomes physically distinct.':'Prepared (|A♥⟩ + |K♠⟩)/√2. Both phase arrows align and each face has probability 50%. A pair of aces wins; high card loses.'}];
    attempt={lesson:index,encoding:'two-complete-faces',startedAt:new Date().toISOString(),seed:Math.floor(Math.random()*4294967296),steps:[]};rng=randomSource(attempt.seed);
    document.querySelectorAll('[data-lesson]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.lesson)===index);b.setAttribute('aria-current',Number(b.dataset.lesson)===index?'step':'false');});
    const d=definitions[index];$('lessonEyebrow').textContent=d.eyebrow;$('lessonTitle').textContent=d.title;$('lessonIntro').textContent=d.intro;
    $('lessonBoard').innerHTML=LearningHands.board.map(displayFace).join('');
    $('lessonContract').textContent=index===2?'PUBLIC LINK · You D1 / Nova D2 · |0⟩ = A♥, |1⟩ = K♠ · opposite initially':'YOUR INDEPENDENT CARD · D1 · |0⟩ = A♥, |1⟩ = K♠';
    $('lessonActions').innerHTML=d.actions.map((a,i)=>`<button type="button" class="button ${i?'secondary-button':'primary-button'}" data-play="${a.value}">${a.label}</button>`).join('');
    $('predictionQuestion').textContent=d.pre;$('predictionAnswers').innerHTML=d.preOptions.map((text,i)=>`<button type="button" data-predict="${i}">${text}</button>`).join('');$('predictionStatus').textContent='Predict if you want, or choose a route and step through it.';
    $('reflection').hidden=true;$('nextLesson').hidden=true;$('lessonStepNext').hidden=true;$('lessonVisualKey').innerHTML=StateView.guideHTML();renderLessonFrame(0);summary();
  }
  function operationText(op){return `${op.actor||'You'} · ${op.action==='measure'?'read '+op.basis:op.action}${op.showdown?' · free showdown':op.lock?' · commit':''}`;}
  function renderLessonHands(frame){
    const own=frame.state.distribution('Z',0),bit=own.findIndex(p=>p>1-1e-9);
    const ownFace=bit<0?unresolved():displayFace(LearningHands.face(bit));
    const note=frame.locked.you?'FACE Z-LOCKED':bit<0?'RANK & SUIT UNRESOLVED':'FACE PREDICTED · NOT Z-LOCKED';
    const ownOther=LearningHands.hand(active,'you',0)[1];
    let other;
    if(active===2){const odds=frame.state.distribution('Z',1),known=odds.findIndex(p=>p>1-1e-9);other=`<div class="practice-hand"><div class="practice-hand-cards">${frame.verified?displayFace(LearningHands.face(known,'nova')):card('?',0,true,1)}${displayFace(LearningHands.hand(active,'nova',0)[1])}</div><small>NOVA · ${frame.verified?'VERIFIED '+options[known]:known<0?'LINKED FACE HIDDEN':'INFERRED '+options[known]}</small></div>`;}
    else other=`<div class="practice-hand"><div class="practice-hand-cards">${LearningHands.hand(active,'nova',0).map(displayFace).join('')}</div><small>NOVA · SHOWN PAIR OF QUEENS</small></div>`;
    $('lessonCards').innerHTML=`<div class="practice-hand"><div class="practice-hand-cards">${ownFace}${displayFace(ownOther)}</div><small>YOU · ${note}</small></div>${other}`;
  }
  function renderLessonFrame(index){
    const frame=frames[index],state=frame.state;renderLessonHands(frame);
    $('lessonSteps').innerHTML=frames.map((f,i)=>`<button type="button" data-state-step="${i}" class="${i===index?'active':''}">${i===0?'0 · Prepare':i+' · '+operationText(f.operation)}</button>`).join('');
    $('lessonVisual').innerHTML=frame.operation?StateView.effectHTML(frame.before,state,{action:frame.operation.action,basis:frame.operation.basis||'Z',qubit:frame.operation.qubit||0,options,actor:frame.operation.actor||'You',target:active===2?'linked pair':'tunable card',outcome:frame.outcome===undefined?null:frame.outcome,brief:true}):StateView.stateHTML(state,{options,title:'Prepared complete-face state',brief:true});
    $('lessonObservation').textContent=frame.text;$('lessonOddsLabel').textContent=frame.verified||frame.locked.you&&active!==2?'This prepared hand’s result':'Win chance on this fixed board';$('lessonOdds').textContent=percent(LearningHands.winChance(active,state));
    const own=state.distribution('Z',0);$('lessonState').textContent=`Your faces: A♥ ${percent(own[0])} / K♠ ${percent(own[1])}`+(active===2?` · Nova: A♥ ${percent(state.distribution('Z',1)[0])} / K♠ ${percent(state.distribution('Z',1)[1])}`:'');
    $('lessonBudget').textContent=`Moves left · You ${frame.moves.you}/2 · Nova ${frame.moves.nova}/2. Z commits a face; X/Y leave it tunable.`;
    $('lessonVisualBudget').textContent=`Step ${index} · You ${frame.moves.you}/2 moves left · ${frame.locked.you?'your face is Z-locked':'your card remains tunable'}`+(index<frames.length-1?` · Reviewing history; next continues from step ${frames.length-1}.`:'');
    const next=queue[frames.length-1];$('lessonStepNext').hidden=!next;$('lessonStepNext').textContent=next?'Next: '+operationText(next)+' →':'Sequence complete';
  }
  function choosePath(value){
    if(path)return;path=value;attempt.action=value;attempt.prediction=prediction;attempt.beforeCorrect=prediction===null?null:prediction===definitions[active].preCorrect;
    document.querySelectorAll('[data-play],[data-predict]').forEach(b=>b.disabled=true);
    const youZ={action:'measure',basis:'Z',actor:'You',showdown:true,cost:0},novaZ={action:'measure',basis:'Z',qubit:1,actor:'Nova',showdown:true,verify:true,cost:0},novaH={action:'H',qubit:1,actor:'Nova'};
    if(active===0)queue=value==='H'?[{action:'H',actor:'You'},youZ]:[{action:'measure',basis:'Z',actor:'You',lock:true}];
    else if(active===1)queue=[{action:'measure',basis:value,actor:'You'},{action:'H',actor:'You'},youZ];
    else if(value==='Z')queue=[{action:'measure',basis:'Z',actor:'You',lock:true},novaZ];
    else if(value==='H')queue=[{action:'H',actor:'You'},youZ,novaZ];
    else if(value==='X')queue=[novaH,{action:'measure',basis:'X',actor:'You'},{action:'H',actor:'You'},youZ,novaZ];
    else queue=[novaH,{action:'measure',basis:'Z',actor:'You',lock:true},novaZ];
    $('predictionStatus').textContent='Apply one operation per press. Showdown reads cost no move.';renderLessonFrame(0);
    if(matchMedia('(max-width:780px)').matches)document.querySelector('.lesson-visual-panel').scrollIntoView({block:'start',behavior:'auto'});
  }
  function nextOperation(){
    const op=queue[frames.length-1];if(!op)return;
    const owner=op.actor==='Nova'?'nova':'you',cost=op.cost===0?0:1;
    if(locked[owner]||moves[owner]<cost)throw Error('Learning route violates the match commitment or move budget');
    const before=current.clone();let outcome;
    if(attempt.routeChance===undefined&&(op.showdown||op.lock))attempt.routeChance=LearningHands.winChance(active,before);
    if(op.action==='measure'){outcome=current.measure(op.basis,op.qubit||0,rng);if(op.basis==='Z')locked[owner]=true;}
    else current.gate(op.action,op.qubit||0);
    moves[owner]-=cost;
    let text=StateView.operations[op.action==='measure'?'M'+op.basis:op.action].text;
    if(active===0&&op.action==='H')text='H adds the aligned amplitudes for A♥ and cancels K♠. The card is now certainly the pair-building ace, not merely a better suit. It has not been Z-locked yet. This certainty comes from the prepared plus state; H is not an “always get an ace” button.';
    if(active===1&&op.action==='measure'&&!op.showdown)text=op.basis==='X'?'X returns plus with certainty because this preparation is already an X eigenstate. Both complete faces remain 50/50; next H can turn this preserved phase into A♥.':'Y returns +i or −i, not a rank or suit. Face odds remain 50/50, but the phase arrows now differ. Next H must use this projected state.';
    if(active===1&&op.action==='H')text=path==='X'?'H maps the known plus phase to A♥. The pair of aces is now certain and beats Nova’s queens on this prepared board.':'After Y, the relative phase is ±90°. H leaves A♥ and K♠ at 50/50: pair of aces or high card. Reusing the original 100% H forecast would be wrong.';
    if(active===2){
      if(op.action==='H'&&op.actor==='Nova')text='Nova H changes two opposite-face branches into four equally likely joint branches. Each card alone stays 50/50. On this prepared board, changed correlations raise your win chance from 50% to 75%, because your shown Q♣ beats Nova’s 2♣ when both linked faces match. The old opposite-face deduction is gone.';
      if(op.action==='H'&&op.actor==='You'&&path==='H')text='Your H leaves both local face distributions 50/50, but changes opposite-only outcomes into four equally likely pairs. Your stronger Q♣ wins the matching-face cases too: 75% here instead of 50%. Local odds alone do not describe a linked poker hand.';
      if(op.actor==='You'&&op.action==='measure'&&!op.showdown){
        attempt.inference={own:current.distribution('Z',0),rival:current.distribution('Z',1)};
        text=op.basis==='X'?'After Nova H, your X readout predicts Nova’s complete face, including rank. Your own Z face is still 50/50, but its phase is known. One move remains: H can convert that phase to a definite face. You did not choose the readout.':path==='Z'?'Z commits your rank and suit and predicts Nova’s opposite face because the original link is intact. Nova’s card remains face down; the inferred face is earned information. A later gate on Nova can invalidate this inference.':'After Nova H, reading your Z face no longer predicts Nova: its linked face remains 50/50. You have committed your own card, so you cannot repair it with a later H.';
      }
      if(op.actor==='You'&&op.action==='H'&&path==='X')text='Your H converts the measured plus/minus phase into a definite A♥ or K♠. Here the two linked faces now match; your Q♣ wins the kicker comparison against Nova’s 2♣. The outcome was random, not chosen remotely. This prepared advantage is not a universal guarantee for the match.';
    }
    if(op.showdown||op.lock){const chance=LearningHands.winChance(active,current);text+=` ${op.verify?'Nova’s public showdown verification':'Your Z readout'} is ${options[outcome]}. ${active===2&&!op.verify?'The rival stays face down until verification.':chance>1-1e-9?'You win on this fixed board.':chance<1e-9?'Nova wins on this fixed board.':'The rival’s remaining readout still matters.'} One sampled result is not a frequency estimate.`;}
    const frame={before,state:current.clone(),operation:op,outcome,text,moves:{...moves},locked:{...locked},verified:!!op.verify};frames.push(frame);
    attempt.steps.push({actor:op.actor,action:op.action,basis:op.basis,qubit:op.qubit||0,cost,outcome,before:before.jointZ(),after:current.jointZ(),moves:{...moves},locked:{...locked}});
    renderLessonFrame(frames.length-1);if(frames.length-1===queue.length)completeSequence();
  }
  function completeSequence(){
    if(completed)return;completed=true;attempt.result={...attempt.inference,chance:attempt.routeChance,finalDistribution:current.jointZ(),finalWinChance:LearningHands.winChance(active,current)};
    session.attempts.push(attempt);save();summary();$('reflection').hidden=false;$('reflectionQuestion').textContent=definitions[active].post;$('reflectionAnswers').innerHTML=definitions[active].postOptions.map((text,i)=>`<button type="button" data-reflect="${i}">${text}</button>`).join('');$('reflectionStatus').textContent='Explain the change, then record your reflection.';
  }
  $('predictionAnswers').addEventListener('click',event=>{const b=event.target.closest('[data-predict]');if(!b||prediction!==null||path)return;prediction=Number(b.dataset.predict);document.querySelectorAll('[data-predict]').forEach(x=>{x.disabled=true;x.classList.toggle('selected',x===b);});$('predictionStatus').textContent='Prediction recorded. Choose a route.';});
  $('lessonActions').addEventListener('click',event=>{const b=event.target.closest('[data-play]');if(b)choosePath(b.dataset.play);});
  $('lessonStepNext').addEventListener('click',nextOperation);
  $('lessonSteps').addEventListener('click',event=>{const b=event.target.closest('[data-state-step]');if(b)renderLessonFrame(Number(b.dataset.stateStep));});
  $('lessonRestart').addEventListener('click',()=>{startLesson(active);if(matchMedia('(max-width:780px)').matches)$('lessonActions').scrollIntoView({block:'center',behavior:'auto'});});
  $('reflectionAnswers').addEventListener('click',event=>{const b=event.target.closest('[data-reflect]');if(!b||reflected||!completed)return;reflected=true;attempt.reflection=Number(b.dataset.reflect);attempt.afterCorrect=attempt.reflection===definitions[active].postCorrect;attempt.completedAt=new Date().toISOString();attempt.elapsedMs=Date.parse(attempt.completedAt)-Date.parse(attempt.startedAt);document.querySelectorAll('[data-reflect]').forEach(x=>{x.disabled=true;x.classList.toggle('selected',x===b);});$('reflectionStatus').textContent=attempt.afterCorrect?'Correct. Revisit any recorded state.':'The other answer is correct. Your original answer stays in the log.';$('nextLesson').hidden=false;$('nextLesson').textContent=active===2?'Replay another link route ↻':'Next challenge →';save();summary();});
  document.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>startLesson(Number(b.dataset.lesson))));
  $('nextLesson').addEventListener('click',()=>{startLesson(active===2?2:active+1);$('lessonTitle').focus({preventScroll:true});});
  $('resetLearning').addEventListener('click',()=>{session=fresh();save();startLesson(0);});
  $('exportSession').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(session,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='quantum-holdem-full-face-learning.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

  const guideOptions=options;
  let guideChoice='H',guideState,guideDone=false,guideFollow=[],guideCount=0;
  function guideOperation(){const linked=guideChoice.startsWith('L'),action=linked?guideChoice.slice(1):guideChoice;return{linked,action:action.startsWith('M')?'measure':action,basis:action.startsWith('M')?action.slice(1):'Z',qubit:0,actor:'You'};}
  function setGuide(choice){
    guideChoice=choice;guideDone=false;guideCount=0;guideState=LearningHands.source(choice.startsWith('L')?2:0);const op=guideOperation(),definition=StateView.operations[op.action==='measure'?'M'+op.basis:op.action];
    document.querySelectorAll('[data-guide]').forEach(b=>b.classList.toggle('active',b.dataset.guide===choice));$('guideBadge').textContent=choice;$('guideTitle').textContent=definition.name+(op.linked?' · your half of the pair':'');$('guideFormula').textContent=definition.formula;$('guideExplanation').textContent=definition.text+(op.linked?' In this example, watch four joint amplitudes and the Z/Z, X/X, Y/X relations.':'');
    $('guideVisual').innerHTML=StateView.stateHTML(guideState,{options:guideOptions,title:'Prepared state · before this operation'});$('guideKey').innerHTML=StateView.guideHTML();$('guideApply').hidden=false;$('guideApply').textContent=op.action==='measure'?`Measure ${op.basis} now`:`Apply ${op.action} now`;$('guideFollow').hidden=true;$('guideStatus').textContent='The operation has not been applied. Press the button to see its actual effect.';
    guideFollow=op.action==='measure'&&op.basis==='Z'?[]:op.linked?(op.action==='H'?[{action:'H',qubit:1,actor:'Nova'}]:[{action:'H',qubit:0,actor:'You'},{action:'H',qubit:1,actor:'Nova'}]):op.action==='S'?[{action:'measure',basis:'Y',qubit:0,actor:'You'}]:[{action:'H',qubit:0,actor:'You'}];
  }
  function applyGuide(op){const before=guideState.clone();let outcome;if(op.action==='measure')outcome=guideState.measure(op.basis,op.qubit||0);else guideState.gate(op.action,op.qubit||0);$('guideVisual').innerHTML=StateView.effectHTML(before,guideState,{...op,options:guideOptions,target:guideState.qubits===2?'linked pair':'prepared card',outcome:outcome===undefined?null:outcome});$('guideStatus').textContent=op.action==='measure'?`Readout ${op.basis==='Z'?guideOptions[outcome]:`${outcome===0?'+':'−'}${op.basis==='Y'?'i':''}`} in ${op.basis}, with pre-read probability ${percent(before.distribution(op.basis,op.qubit||0)[outcome])}. The after-state is the selected branch; certainty depends on the state you prepared.`:guideState.qubits===2?'Watch the four joint branches and correlation rows. A 50/50 local card can still be part of a changed joint state.':'Compare the phase arrows, probability bars, and X/Y/Z predictions. A phase change need not change Z odds.';}
  $('guideApply').addEventListener('click',()=>{if(guideDone)return;guideDone=true;applyGuide(guideOperation());$('guideApply').hidden=true;$('guideFollow').hidden=!guideFollow.length;if(!guideFollow.length){$('guideStatus').textContent+=' Z commits this face in the match. Reset to explore another preparation.';return;}$('guideFollow').textContent=guideFollow[0].action==='measure'?`Then read ${guideFollow[0].basis}`:`Then ${guideFollow[0].actor==='Nova'?'Nova applies':'apply'} H`;});
  $('guideFollow').addEventListener('click',()=>{const op=guideFollow[guideCount++];if(!op)return;applyGuide(op);const next=guideFollow[guideCount];$('guideFollow').hidden=!next;if(next)$('guideFollow').textContent=`Then ${next.actor==='Nova'?'Nova applies':'apply'} H`;});
  $('guideReset').addEventListener('click',()=>setGuide(guideChoice));
  document.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click',()=>setGuide(b.dataset.guide)));

  const experiments={
    interference:{title:'H changes the whole face, including rank.',sequence:'Prepare + versus a 50/50 Z mixture → H → compare A♥ / K♠',steps:['Both sources begin at A♥ 50% / K♠ 50%. Only the coherent source has aligned amplitudes that can interfere.','H makes A♥ certain in the coherent source: its amplitudes reinforce for the ace and cancel for the king. The mixture stays 50/50. On the practice board, this is pair of aces versus high card.']},
    phase:{title:'A phase flip reverses the preferred rank.',sequence:'Same sources → Z phase gate → H → compare faces',steps:['Both sources have equal face probabilities. The coherent source starts with aligned phase.','Z turns the second amplitude by 180°. A♥ / K♠ probabilities do not change yet. This is a gate, not a Z measurement.','H now favors K♠ with certainty in the coherent source, while the mixture stays 50/50. Phase controls change later rank outcomes; choosing the wrong sequence can hurt your hand.']},
    disturbance:{title:'An unread face measurement removes useful coherence.',sequence:'Same sources → unread Z measurement → H',steps:['The sources start with the same face odds but different coherence.','A Z measurement whose result is discarded averages the complete-face branches. The formerly coherent source now has mixed knowledge too. This is an experiment channel; a live Z read also locks the card.','H leaves both sources at A♥ 50% / K♠ 50%. The original 100% ace prediction no longer applies after unread measurement.']},
    link:{title:'Local odds stay 50/50 while the face relation changes.',sequence:'Opposite A♥ / K♠ pair versus dephased pair → your H → Nova H',steps:['Both sources start with opposite complete faces in different decks. Their Z/Z distributions match. Only the coherent pair retains interference between the two branches.','Your H produces four equally likely Z pairs in both sources. Neither local face changes from 50/50. Watch the coherent pair’s phase arrows: the sources still differ even though these bars match.','Nova H makes the coherent pair’s faces match with certainty. The dephased pair stays at four equally likely outcomes: 50% matching. Both cards individually are still 50/50; joint coherence is what distinguishes the predictions.']},
    quarter:{title:'Y detects a quarter-turn without revealing a rank.',sequence:'Same sources → S → compare Y readouts and Z face odds',steps:['Y readouts begin at +i / −i 50/50 for both sources. Neither Y label names a rank or suit.','S rotates the coherent second amplitude by 90°: Y now returns +i with certainty. The mixture still gives 50/50. Both sources remain A♥ / K♠ 50/50 in Z, as shown in their basis rows.']}
  };
  let labName='interference',labFrames=[],labPosition=0,labReached=0;
  function plot(state,name){
    const values=name==='quarter'?state.distribution('Y'):state.jointZ();
    const labels=name==='link'?Array.from({length:4},(_,bits)=>'You '+options[bits&1]+' · Nova '+options[(bits>>1)&1]):name==='quarter'?['Y +i · phase readout','Y −i · phase readout']:['|0⟩ · A♥','|1⟩ · K♠'];
    return values.map((p,i)=>`<div class="lab-bar"><div class="lab-bar-label"><span>${labels[i]}</span><strong>${percent(p)}</strong></div><div class="lab-bar-track" role="img" aria-label="${labels[i]} ${percent(p)}"><div class="lab-bar-fill" style="width:${p*100}%"></div></div></div>`).join('')+StateView.stateHTML(state,{options,title:'Current '+(name==='link'?'shared-face state':'complete-face state'),compact:true,brief:true});
  }
  function renderExperiment(){
    const frame=labFrames[labPosition],d=experiments[labName];
    $('coherentPlot').innerHTML=plot(frame.coherent,labName);$('mixturePlot').innerHTML=plot(frame.mixture,labName);$('mixturePlot').querySelectorAll('.lab-bar-fill').forEach(b=>b.classList.add('mixture-fill'));
    $('experimentTitle').textContent=d.title;$('experimentSequence').textContent=d.sequence;$('experimentExplanation').textContent=d.steps[labPosition];
    $('labSteps').innerHTML=labFrames.slice(0,labReached+1).map((f,i)=>`<button type="button" data-lab-step="${i}" class="${i===labPosition?'active':''}">${i===0?'0 · Prepare':i+' · '+(f.operation.action==='dephase'?'Unread Z':(f.operation.actor||'You')+' '+f.operation.action)}</button>`).join('');
    const next=labFrames[labReached+1];$('labNext').hidden=!next;$('labNext').textContent=next?'Next: '+(next.operation.action==='dephase'?'unread Z measurement':(next.operation.actor||'You')+' applies '+next.operation.action)+' →':'Experiment complete';
    $('labStage').textContent=`Step ${labPosition} / ${labFrames.length-1} · exact probabilities, no outcomes selected`;
  }
  function showExperiment(name){labName=name;labFrames=LearningHands.experimentFrames(name);labPosition=labReached=0;document.querySelectorAll('[data-experiment]').forEach(b=>b.classList.toggle('active',b.dataset.experiment===name));renderExperiment();}
  $('labNext').addEventListener('click',()=>{if(labReached+1<labFrames.length){labPosition=++labReached;renderExperiment();}});
  $('labReset').addEventListener('click',()=>showExperiment(labName));
  $('labSteps').addEventListener('click',event=>{const b=event.target.closest('[data-lab-step]');if(b){labPosition=Number(b.dataset.labStep);renderExperiment();}});
  const tabNames=['guide','challenge','lab'];
  function showTab(name){for(const tab of tabNames){$(tab+'View').hidden=tab!==name;$(tab+'Tab').setAttribute('aria-selected',String(tab===name));$(tab+'Tab').tabIndex=tab===name?0:-1;}history.replaceState(null,'',name==='challenge'?'#challenges':'#'+name);}
  tabNames.forEach(name=>$(name+'Tab').addEventListener('click',()=>showTab(name)));
  $('startChallenges').addEventListener('click',event=>{event.preventDefault();showTab('challenge');});
  document.querySelector('.learning-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=tabNames.findIndex(n=>$(n+'Tab').getAttribute('aria-selected')==='true');const next=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:2))%3;showTab(tabNames[next]);$(tabNames[next]+'Tab').focus();});
  document.querySelectorAll('[data-experiment]').forEach(b=>b.addEventListener('click',()=>showExperiment(b.dataset.experiment)));
  startLesson(0);setGuide('H');showExperiment('interference');showTab(location.hash==='#lab'?'lab':location.hash==='#challenges'?'challenge':'guide');
  window.quantumLearning={get session(){return JSON.parse(JSON.stringify(session));},definitions,get stepCount(){return frames.length;}};
})();
