/* Deterministic multi-policy soak and branch-relevance audit; run in the browser harness. */
(() => {
  'use strict';
  const {Game,candidateFace,faceKey,evaluate,compare}=QuantumHoldem;
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const report={matches:0,hands:0,quantumActions:0,policies:{},relevance:{deals:400,faceScoreSensitive:0,categorySensitive:0,linkedFaceScoreSensitive:0,suitOnlyScoreSensitive:0,suitOnlyCategorySensitive:0}};
  for(const policy of ['no-quantum','phase-interference','linked-inspection','mixed-bases']){
    let count=0;
    for(let seed=1;seed<=6;seed++){
      const game=new Game(3100+seed*31),rng=QuantumHoldem.randomSource(seed*1709);let guard=0,inspectedHand=0;
      const inspectHand=()=>{
        if(!game.over||inspectedHand===game.hand)return;
        inspectedHand=game.hand;report.hands++;
        if(game.showdown){
          assert(new Set([...game.cards.you,...game.cards.nova,...game.board].map(faceKey)).size===9,'Smoke: repeated physical face');
          assert([...game.cards.you,...game.cards.nova].every(c=>c.locked&&c.rank===c.ranks[c.readout.outcome]),'Smoke: incomplete resolution');
        }
      };
      while(!game.matchOver&&guard++<250){
        assert(Math.abs(game.stacks.you+game.stacks.nova+game.pot-2000)<1e-9,'Smoke: chips not conserved');
        assert(Math.min(game.stacks.you,game.stacks.nova,game.pot)>=0,'Smoke: negative chips');
        if(game.over){game.startHand();continue;}
        if(game.turn==='nova'){game.respond();inspectHand();continue;}
        if(game.street&&game.moves.you){
          const index=policy==='linked-inspection'?1:Math.floor(rng()*2);
          if(game.canMove('you',index)){
            const action=policy==='no-quantum'?null:policy==='phase-interference'?(game.moves.you===2?'Z':'H'):policy==='linked-inspection'?(game.moves.you===2?'measure':'H'):['H','Z','S','measure'][Math.floor(rng()*4)];
            if(action){game.move('you',action,index,policy==='linked-inspection'?'X':['Z','X','Y'][Math.floor(rng()*3)]);report.quantumActions++;}
          }
        }
        assert(game.act(game.due?'call':'check'),'Smoke: a legal action was rejected');
        inspectHand();
      }
      assert(game.matchOver,'Smoke: match failed to finish');count++;report.matches++;
    }
    report.policies[policy]=count;
  }
  // Offline audit uses complete boards deliberately. It is NOT a live hint, win-rate,
  // human fun score, or proof that any particular gate will improve a hand.
  for(let seed=1;seed<=report.relevance.deals;seed++){
    const game=new Game(seed*43),cards=game.cards.you;
    const scores=index=>[0,1].map(bit=>[0,1].map(other=>evaluate([candidateFace(cards[index],bit),candidateFace(cards[1-index],other),...game.board]).score));
    const tunable=scores(0),linked=scores(1);
    if(tunable[0].some((s,i)=>compare(s,tunable[1][i])!==0))report.relevance.faceScoreSensitive++;
    if(tunable[0].some((s,i)=>s[0]!==tunable[1][i][0]))report.relevance.categorySensitive++;
    if(linked[0].some((s,i)=>compare(s,linked[1][i])!==0))report.relevance.linkedFaceScoreSensitive++;
    const suitOnly=[0,1].map(bit=>[0,1].map(other=>evaluate([{...candidateFace(cards[0],bit),rank:cards[0].ranks[0]},{...candidateFace(cards[1],other),rank:cards[1].ranks[0]},...game.board]).score));
    if(suitOnly[0].some((s,i)=>compare(s,suitOnly[1][i])!==0))report.relevance.suitOnlyScoreSensitive++;
    if(suitOnly[0].some((s,i)=>s[0]!==suitOnly[1][i][0]))report.relevance.suitOnlyCategorySensitive++;
  }
  assert(report.relevance.faceScoreSensitive>report.relevance.deals/3,'Smoke: tunable branches rarely affect scoring');
  assert(report.relevance.linkedFaceScoreSensitive>report.relevance.deals/3,'Smoke: linked branches rarely affect scoring');
  globalThis.smokeTestResults=report;
})();
