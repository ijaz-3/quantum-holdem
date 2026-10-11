(() => {
  'use strict';const $=id=>document.getElementById(id);let exercise,answered=false;
  function start(){
    exercise=TransferModel.create(Math.floor(Math.random()*4294967296));answered=false;
    $('transferPreparation').textContent=exercise.preparation;$('transferCards').textContent='|0⟩ = A♥, |1⟩ = K♠ · different decks for linked copies';
    $('transferBoard').innerHTML=exercise.board.map(c=>'<div class="practice-card '+(c.suit<2?'red':'')+'">'+QuantumHoldem.SUITS[c.suit]+'<small>'+c.rank+'</small></div>').join('');
    $('transferContext').textContent=exercise.linked?'This is the public linked contract. Nova’s actual face is not known. Predict the useful basis, not its random readout.':'Your other card is 2♣. Nova’s shown Q♥ / Q♦ make a pair of queens. All five board cards are fixed here; no future cards are being inspected.';
    $('transferQuestion').textContent=exercise.question;$('transferAnswers').innerHTML=exercise.options.map((label,i)=>'<button type="button" data-answer="'+i+'">'+label+'</button>').join('');
    $('transferFeedback').textContent='';$('transferNext').disabled=true;$('transferVisual').innerHTML=StateView.stateHTML(exercise.state,{options:LearningHands.labels,title:'Initial state · before your answer',brief:true});
  }
  $('transferAnswers').addEventListener('click',event=>{
    const button=event.target.closest('[data-answer]');if(!button||answered)return;answered=true;const choice=Number(button.dataset.answer),right=choice===exercise.correct;
    document.querySelectorAll('[data-answer]').forEach(b=>{b.disabled=true;b.classList.toggle('selected',b===button);});
    const after=exercise.state.clone();let outcome,basis='Z',action='H';
    if(exercise.linked){basis=['Z','X','Y'][choice];action='measure';outcome=after.measure(basis,0,QuantumHoldem.randomSource(exercise.seed+17));}
    else after.gate('H',0);
    $('transferVisual').innerHTML=StateView.effectHTML(exercise.state,after,{options:LearningHands.labels,action,basis,outcome:outcome===undefined?null:outcome,target:exercise.linked?'linked pair':'independent card',brief:true});
    $('transferFeedback').textContent=(right?'Correct. ':'Not this time. ')+(exercise.linked?'The most informative basis is '+['Z','X','Y'][exercise.correct]+'. Your chosen readout is randomly sampled; it is not an outcome you selected. Changing the preparation changes which basis is useful.':'H changes the win forecast from '+StateView.pct(exercise.before)+' to '+StateView.pct(exercise.after)+'. That is a probability on the shown board, not a sampled win. The same gate is not an upgrade in every preparation.');
    PlaytestStore.transfer({seed:exercise.seed,kind:exercise.kind,choice,correct:right,before:exercise.before,after:exercise.after});$('transferNext').disabled=false;
  });
  $('transferNext').addEventListener('click',start);start();window.quantumTransfer={get exercise(){return exercise;}};
})();
