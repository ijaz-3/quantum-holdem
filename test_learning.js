/* Full-face teaching fixtures and sequences are checked against the live rules. */
(() => {
  'use strict';
  const {Density}=Quantum,{Game,faceKey}=QuantumHoldem,L=LearningHands,results=[];
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`Expected ${b}, got ${a}`);
  const test=(name,fn)=>{fn();results.push(name);};
  const same=(a,b)=>a.data.forEach((v,i)=>{near(v.re,b.data[i].re);near(v.im,b.data[i].im);});
  test('Every teaching branch uses legal faces from two physical decks',()=>{
    for(let lesson=0;lesson<3;lesson++)for(let you=0;you<2;you++)for(let nova=0;nova<2;nova++){
      const cards=[...L.hand(lesson,'you',you),...L.hand(lesson,'nova',nova),...L.board];
      assert(cards.length===9&&new Set(cards.map(faceKey)).size===9,'Teaching deal duplicates a physical card');
      assert(L.face(you).rank!==L.face(1-you).rank,'Teaching a suit-only card');
    }
  });
  test('Aces pair wins the independent challenge; the king branch loses',()=>{
    assert(L.result(0,0).you.name==='One pair'&&L.result(0,0).order===1,'Ace branch');
    assert(L.result(0,1).you.name==='High card'&&L.result(0,1).order===-1,'King branch');
    assert(L.result(0,0).nova.name==='One pair','Nova is not holding the described queens');
  });
  test('H and phase-then-H change complete-face rank outcomes',()=>{
    near(L.winChance(0,L.source(0)),0.5);near(L.winChance(0,L.source(0).gate('H')),1);
    near(L.winChance(0,L.source(0).gate('Z')),0.5);near(L.winChance(0,L.source(0).gate('Z').gate('H')),0);
  });
  test('X preserves plus; either Y readout changes the later pair forecast',()=>{
    const x=L.source(1);x.measure('X',0,()=>0.9);near(L.winChance(1,x.gate('H')),1);
    for(const outcome of [0,1]){const y=L.source(1).condition('Y',outcome);near(y.distribution('Z')[0],0.5);near(L.winChance(1,y.gate('H')),0.5);}
  });
  test('Linked H changes poker equity even when both local odds stay 50/50',()=>{
    const pair=L.source(2);near(L.winChance(2,pair),0.5);pair.gate('H',0);
    pair.jointZ().forEach(p=>near(p,0.25));near(pair.distribution('Z',0)[0],0.5);near(pair.distribution('Z',1)[0],0.5);near(L.winChance(2,pair),0.75);
  });
  test('An intact Z read earns the opposite complete face; unread results do not signal',()=>{
    for(const outcome of [0,1]){const pair=L.source(2).condition('Z',outcome,0);near(pair.distribution('Z',1)[1-outcome],1);}
    near(L.source(2).dephase('Z',0).distribution('Z',1)[0],0.5);
    // A local projective readout removes this Bell pair's entanglement.
    // Conditional knowledge can still infer the partner; later local gates do not re-entangle it.
    for(const basis of ['X','Y','Z'])for(const outcome of [0,1]){
      const pair=L.source(2).condition(basis,outcome,0);near(pair.reduced(0).purity(),1);near(pair.reduced(1).purity(),1);
      pair.gate('H',0);near(pair.reduced(0).purity(),1);near(pair.reduced(1).purity(),1);
    }
  });
  test('After Nova H, X infers its face while Z does not; H can tune your phase',()=>{
    for(const outcome of [0,1]){
      const x=L.source(2).gate('H',1).condition('X',outcome,0);near(Math.max(...x.distribution('Z',1)),1);near(x.distribution('Z',0)[0],0.5);
      x.gate('H',0);near(Math.max(...x.distribution('Z',0)),1);near(x.jointZ()[0]+x.jointZ()[3],1);near(L.winChance(2,x),1);
      const z=L.source(2).gate('H',1).condition('Z',outcome,0);near(z.distribution('Z',1)[0],0.5);
    }
  });
  test('All five stepped labs end at the independently tested quantum experiment',()=>{
    for(const name of ['interference','phase','disturbance','link','quarter']){
      const frames=L.experimentFrames(name),expected=Quantum.experiment(name),last=frames[frames.length-1];
      assert(frames[0].operation===null&&frames.length===L.experimentPlan(name).length+1,'Experiment skipped preparation');
      same(last.coherent,expected.coherent);same(last.mixture,expected.mixture);
      frames.forEach(f=>{near(f.coherent.trace(),1);near(f.mixture.trace(),1);});
    }
  });
  test('Linked lesson gates/readouts and lock rules agree with the live Game',()=>{
    for(const rng of [()=>0.1,()=>0.9]){
      const game=new Game(10);game.rng=rng;
      game.cards.you[1].ranks=['A','K'];game.cards.you[1].options=[0,3];game.cards.nova[1].ranks=['A','K'];game.cards.nova[1].options=[0,3];
      game.turn='nova';assert(game.move('nova','H',1),'Nova H rejected');
      const state=L.source(2).gate('H',1);game.turn='you';assert(game.move('you','measure',1,'X'),'X rejected');state.condition('X',game.cards.you[1].readout.outcome,0);same(game.beliefs.you,state);
      assert(game.cards.you[1].rank===null&&!game.cards.you[1].locked,'X falsely revealed a rank');
      game.move('you','H',1);state.gate('H',0);same(game.beliefs.you,state);near(game.moves.you,0);
      game.resolve('you',1);assert(game.cards.you[1].rank===L.face(game.cards.you[1].readout.outcome).rank,'Game/lesson rank mismatch');assert(!game.move('you','H',1),'Z commitment bypassed');
    }
  });
  globalThis.learningTestResults={passed:results.length,tests:results};
})();
