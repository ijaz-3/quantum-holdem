(() => {
  const {Game}=QuantumHoldem,{Density}=Quantum,results=[];
  const assert=(ok,text)=>{if(!ok)throw Error(text);},near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`),test=(name,fn)=>{fn();results.push(name);};
  test('Fresh preparations include all four phases and remain normalized',()=>{
    const phases=new Set();for(let seed=1;seed<=100;seed++){const g=new Game(seed);phases.add(g.initialQuantum.you.phase);near(g.cards.you[0].state.trace(),1);near(Quantum.probabilities(g.cards.you[0].wave)[0],g.initialQuantum.you.probability);}
    assert(phases.size===4,'Missing preparation phases');
  });
  test('H / ZH is not a universal strong-face shortcut; quarter-phase correction matters',()=>{
    let checked=0;for(let seed=1;seed<=80;seed++){const g=new Game(seed),phase=g.initialQuantum.you.phase;if(Math.abs(phase)!==Math.PI/2)continue;checked++;near(g.preview('you',0,['H'])[0],0.5);near(g.preview('you',0,['Z','H'])[0],0.5);assert(g.preview('you',0,['S','H'])[phase>0?1:0]>0.75,'Quarter phase correction was not useful');}assert(checked>20,'Insufficient quarter-phase cases');
  });
  test('Decision explanations use captured visible boards and distinguish category odds from wins',()=>{
    const g=new Game(2);g.street=1;g.board=[{rank:'A',suit:1,deck:1},{rank:'7',suit:2,deck:0},{rank:'3',suit:3,deck:1},{rank:'9',suit:1,deck:1},{rank:'J',suit:2,deck:0}];g.cards.you[0].ranks=['A','K'];g.cards.you[0].options=[0,3];g.cards.you[1].ranks=['2','4'];
    const before=Density.pure([Math.sqrt(.4),Math.sqrt(.6)]),after=before.clone().gate('H'),context=g.decisionContext();near(g.madeHandOdds('you',0,before,context)[1],.4);
    const message=g.describeChange('you',0,before,after,context);assert(message.includes('not win odds'),'Confused made-hand and winning probability');g.street=3;g.board.reverse();assert(g.describeChange('you',0,before,after,context)===message,'Future board changed an old explanation');
  });
  test('AI reuses classical samples and integrates different quantum forecasts fairly',()=>{
    const g=new Game(17),view=g.botView(),baseline=g.botEquity(view,12),size=g.equityCache.size;view.own[0].wave=Quantum.transform(view.own[0].wave,'H');const changed=g.botEquity(view,12);assert(g.equityCache.size===size,'Gate forecast regenerated samples');assert(baseline>=0&&baseline<=1&&changed>=0&&changed<=1,'Unnormalized equity');
  });
  test('Unfamiliar exercises cover H helping, hurting, and doing nothing and all useful link bases',()=>{
    const independent=new Set(),linked=new Set();for(let seed=1;seed<=160;seed++){const c=TransferModel.create(seed);(c.linked?linked:independent).add(c.correct);if(c.linked)assert(c.gains[c.correct]>.99,'Best basis failed to infer rank');else assert(Number.isFinite(c.before)&&Number.isFinite(c.after),'Invalid transfer forecast');}
    assert(independent.size===3&&linked.size===3,'Transfer questions are repetitive');
  });
  test('Playtest observations require opt-in and never infer verified participants',()=>{
    const saved=localStorage.getItem('quantum-holdem-playtest-v1');PlaytestStore.reset();PlaytestStore.record('automated-regression',{});assert(PlaytestStore.data.events.length===0,'Recorded without consent');PlaytestStore.consent(true);PlaytestStore.record('automated-regression',{automated:true});assert(PlaytestStore.data.events.length===1,'Opt-in did not record');PlaytestStore.consent(false);PlaytestStore.record('automated-regression',{});assert(PlaytestStore.data.events.length===1,'Opt-out ignored');PlaytestStore.reset();if(saved)localStorage.setItem('quantum-holdem-playtest-v1',saved);
  });
  globalThis.productTestResults={passed:results.length,tests:results};
})();
