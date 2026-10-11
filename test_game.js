(() => {
  'use strict';
  const { Game, evaluate, compare, randomSource, faceKey } = QuantumHoldem;
  const { Density, transform, probabilities, experiment } = Quantum;
  const results = [];
  function assert(condition, message) { if (!condition) throw Error(message); }
  function near(a, b) { assert(Math.abs(a-b) < 1e-9, `Expected ${b}, got ${a}`); }
  function test(name, run) { run(); results.push(name); }
  const faces = text => text.split(' ').map((face, i) => ({ rank: face.slice(0, -1), suit: 'hdcs'.indexOf(face.slice(-1)), deck: i % 2 }));
  test('Coherence, phase, and unread measurement have distinct predictions', () => {
    const mix = experiment('interference'); near(mix.coherent.jointZ()[0], 1); near(mix.mixture.jointZ()[0], 0.5);
    near(experiment('phase').coherent.jointZ()[0], 0);
    near(experiment('disturbance').coherent.jointZ()[0], 0.5);
    const linked = experiment('link'); near(linked.coherent.jointZ()[0] + linked.coherent.jointZ()[3], 1);
    linked.mixture.jointZ().forEach(p => near(p, 0.25));
  });
  test('Quarter-turn phase is visible in Y, not Z', () => {
    const state = Density.pure([Math.SQRT1_2, Math.SQRT1_2]).gate('S');
    near(state.distribution('Z')[0], 0.5); near(state.distribution('Y')[0], 1); near(state.distribution('X')[0], 0.5);
    state.measure('Y', 0, () => 0.9); near(state.distribution('Z')[0], 0.5);
  });
  test('Incompatible measurements disturb later probabilities', () => {
    const source = Density.pure([Math.SQRT1_2, Math.SQRT1_2]);
    const x = source.clone(); x.measure('X', 0, () => 0.2); x.gate('H'); near(x.jointZ()[0], 1);
    const y = source.clone(); y.measure('Y', 0, () => 0.2); y.gate('H'); near(y.jointZ()[0], 0.5);
    const z = source.clone(); z.measure('Z', 0, () => 0.2); z.gate('H'); near(z.jointZ()[0], 0.5);
  });
  test('Local operations and unread readouts do not signal to the rival', () => {
    for (const gate of ['H', 'Z', 'S']) {
      const state = Density.bell().gate(gate, 0);
      for (const basis of ['X', 'Y', 'Z']) near(state.distribution(basis, 1)[0], 0.5);
    }
    for (const basis of ['X', 'Y', 'Z']) near(Density.bell().dephase(basis, 0).distribution('Z', 1)[0], 0.5);
  });
  test('Private readout branches do not leak through Nova knowledge', () => {
    const a = new Game(4), b = new Game(4); a.rng = () => 0.1; b.rng = () => 0.9;
    a.move('you', 'measure', 1, 'X'); b.move('you', 'measure', 1, 'X');
    assert(a.cards.you[1].readout.outcome !== b.cards.you[1].readout.outcome, 'Readout branches not different');
    assert(JSON.stringify(a.botView()) === JSON.stringify(b.botView()), 'Private readout leaked');
  });
  test('Linked suit inference reflects gates instead of a fixed lookup', () => {
    const a = new Game(5); a.move('you', 'lock', 1);
    const bit = a.cards.you[1].options.indexOf(a.cards.you[1].suit); near(a.rivalOdds('you')[1-bit], 1);
    a.turn = 'nova'; a.move('nova', 'H', 1); near(a.rivalOdds('you')[0], 0.5);
    const b = new Game(5); b.move('you', 'H', 1); b.move('you', 'lock', 1); near(b.rivalOdds('you')[0], 0.5);
  });
  test('Linked X readout leaves a suit unresolved until Z', () => {
    const game = new Game(2); game.move('you', 'measure', 1, 'X');
    assert(!game.cards.you[1].locked && game.cards.you[1].suit === null, 'X was mislabeled as a suit');
    near(game.cardOdds('you', 1)[0], 0.5);
    game.move('you', 'H', 1); const odds = game.cardOdds('you', 1); near(Math.max(...odds), 1);
    game.resolve('you', 1); assert(game.cards.you[1].locked, 'Showdown Z did not lock');
  });
  test('Density matrices stay normalized under public gates and measurements', () => {
    const rng = randomSource(717), state = Density.bell();
    for (let i=0;i<35;i++) {
      state.gate(['H','Z','S'][i%3], i%2);
      if (i%4===0) state.measure(['X','Y','Z'][i%3], i%2, rng);
      if (i%5===0) state.dephase('Y', (i+1)%2);
      near(state.trace(), 1); near(state.jointZ().reduce((a,b)=>a+b,0), 1);
      assert(state.purity() <= 1+1e-9 && state.purity() >= 0.25-1e-9, 'Unphysical purity');
    }
  });
  test('Reduced states agree with local measurement predictions',()=>{
    for(const gate of ['H','Z','S'])for(const qubit of [0,1]){
      const pair=Density.bell().gate(gate,qubit).condition('X',0,1-qubit);
      for(const basis of ['X','Y','Z'])near(pair.reduced(qubit).distribution(basis)[0],pair.distribution(basis,qubit)[0]);
    }
  });
  test('Visual amplitude arrows reconstruct the actual gated density matrix',()=>{
    for(const source of [Density.pure([Math.SQRT1_2,Math.SQRT1_2]),Density.pure([0.6,{re:0,im:0.8}]),Density.bell()]){
      for(let qubit=0;qubit<source.qubits;qubit++)for(const gate of ['H','Z','S']){
        const wave=StateView.gateKet(StateView.ket(source),gate,qubit),picture=Density.pure(wave),actual=source.clone().gate(gate,qubit);
        picture.data.forEach((value,i)=>{near(value.re,actual.data[i].re);near(value.im,actual.data[i].im);});
      }
    }
    assert(StateView.ket(Density.bell().dephase('Z',0))===null,'Invented a pure ket for mixed knowledge');
  });
  test('Nova uses gates for a draw and records the public quantum action',()=>{
    const game=new Game(101);game.street=3;game.turn='nova';
    game.board=faces('Ah Ad 4c 6d 9s');
    const card=game.cards.nova[0];card.ranks=['A','K'];card.options=[3,2];card.wave=[Math.sqrt(0.4),Math.sqrt(0.6)];card.state=Density.pure(card.wave);
    game.cards.nova[1].ranks=['2','3'];game.cards.you[1].ranks=['2','3'];game.cards.nova[1].options=[1,2];game.cards.you[1].options=[1,2];game.botQuantum();
    assert(game.quantumEvents.some(e=>e.owner==='nova'&&e.action==='H'),'Nova did not use interference');
    assert(game.history.some(e=>e.quantum&&e.quantum.owner==='nova'&&e.text.includes('applied H')),'Gate missing from table activity');
  });
  test('Nova selects Y when public linked phase operations make Y informative',()=>{
    const game=new Game(33);game.cards.nova[0].ranks=['4','8'];game.cards.nova[0].options=[0,1];game.cards.nova[1].ranks=['2','6'];game.cards.you[1].ranks=['2','6'];game.cards.nova[1].options=[0,1];game.cards.you[1].options=[0,1];
    game.move('you','S',1);game.move('you','H',1);game.turn='nova';game.street=3;
    game.board=faces('As Ks Qs Js 10s');
    game.botQuantum();assert(game.quantumEvents.some(e=>e.owner==='nova'&&e.action==='measure'&&e.basis==='Y'),'Nova ignored useful Y information');
    assert(game.history.every(e=>!e.quantum||!('outcome' in e.quantum)),'Private outcome exposed in public activity metadata');
  });
  test('Two-deck scoring handles five of a kind and valid best-five kickers', () => {
    const fiveCards = faces('Ah Ad Ac As Ah Kd Qc'); fiveCards[4].deck=1;
    assert(new Set(fiveCards.map(faceKey)).size===7, 'Five-of-kind example duplicates a physical card');
    const five = evaluate(fiveCards);
    assert(five.score.join(',') === '9,14', 'Five of a kind');
    assert(compare(five.score, evaluate(faces('Ah Kh Qh Jh 10h 2c 3d')).score)>0, 'Five of a kind ranking');
    assert(evaluate(faces('Ah Kh 8h 4h 2h Qd Jc')).score.join(',')==='5,14,13,8,4,2','Flush kicker');
    assert(evaluate(faces('Ah 2h 3h 4h 5h Kd Qc')).score.join(',')==='8,5','Wheel');
    assert(evaluate(faces('Ah Ad Ac Kh Kd Kc 2s')).score.join(',')==='6,14,13','Two trips');
  });
  test('Actions enforce budgets, lock commitment, and turn ownership', () => {
    const game = new Game(2); game.move('you','lock'); const suit=game.cards.you[0].suit;
    assert(!game.move('you','H') && !game.move('nova','H'), 'Illegal action');
    assert(game.cards.you[0].suit===suit, 'Locked suit changed');
    assert(game.move('you','S',1) && game.moves.you===0 && !game.move('you','H',1), 'Budget');
  });
  test('Nova input excludes opponent ranks, preparations, and future cards', () => {
    const game = new Game(5), view=JSON.stringify(game.botView()), equity=game.botEquity();
    assert(game.botView().board.length===0 && !('opponent' in game.botView()), 'Private input');
    game.cards.you[0].rank='A'; game.cards.you[0].options=[0,3]; game.cards.you[0].wave=[1,0]; game.cards.you[1].rank='K'; game.board.reverse();
    assert(JSON.stringify(game.botView())===view, 'Private metadata leaked'); near(game.botEquity(),equity);
  });
  test('Betting caps, raises, and all-in runouts conserve chips', () => {
    const game = new Game(9); game.pay('nova',60);
    assert(!game.act('check') && !game.act('bet',65) && !game.act('bet',10000),'Illegal bet');
    assert(game.act('call') && game.street===1,'Call'); near(game.stacks.you+game.stacks.nova+game.pot,2000);
    const short = new Game(7); short.stacks={you:10,nova:1970};
    assert(short.act('bet',10),'Short all-in'); short.respond();
    assert(short.over && short.stacks.you+short.stacks.nova===2000,'Runout');
  });
  test('Seeded matches with linked gates and X/Y readouts finish with valid physical cards', () => {
    for (let seed=1;seed<=8;seed++) {
      const game=new Game(seed*123); let guard=0;
      while(!game.matchOver && guard++<350) {
        near(game.stacks.you+game.stacks.nova+game.pot,2000);
        assert(game.stacks.you>=0 && game.stacks.nova>=0,'Negative chips');
        if(game.over){game.startHand();continue;}
        if(game.turn==='nova'){game.respond();continue;}
        const index=guard%2;
        if(game.canMove('you',index) && guard%3===0) game.move('you',guard%4===0?'S':guard%4===1?'H':'measure',index,['Z','X','Y'][guard%3]);
        if(guard%11===0 && game.maxBet>Math.max(game.bets.you,game.bets.nova)) assert(game.act('bet',Math.min(game.maxBet,Math.max(game.minimumRaise,80))),'Bet');
        else if(guard%17===0) game.act('fold');
        else assert(game.act(game.due?'call':'check'),'Legal turn');
        if(game.over && game.showdown) {
          assert(new Set([...game.cards.you,...game.cards.nova,...game.board].map(faceKey)).size===9,'Duplicate physical card');
          assert(!game.move('you','H') && !game.act('check'),'Post-hand action');
        }
      }
      assert(game.matchOver && game.stacks.you+game.stacks.nova===2000,'Match completion');
      game.reset();assert(game.hand===1 && game.moves.you===2,'Reset');
    }
  });
  test('Full-face branches reserve eight distinct physical candidates',()=>{
    const {candidateFace,candidateDeck}=QuantumHoldem;
    for(let seed=1;seed<=150;seed++){
      const game=new Game(seed),cards=[...game.cards.you,...game.cards.nova];
      const reserved=cards.flatMap(c=>[candidateFace(c,0),candidateFace(c,1)]);
      assert(cards.every(c=>c.ranks[0]!==c.ranks[1]&&c.rank===null),'Rank uncertainty was lost');
      assert(new Set(reserved.map(faceKey)).size===8,'Candidate collision');
      assert(candidateDeck(cards,[]).length===96,'Wrong shoe size');
      assert(new Set([...reserved,...game.board].map(faceKey)).size===13,'Board overlaps a candidate');
      assert(game.cards.you[1].ranks.join()===game.cards.nova[1].ranks.join(),'Broken public link');
      game.move('you','measure',0,'X');assert(game.cards.you[0].rank===null,'X exposed a classical rank');
      game.resolve('you',0);const c=game.cards.you[0];
      assert(c.rank===c.ranks[c.readout.outcome]&&c.suit===c.options[c.readout.outcome],'Resolved mismatched rank and suit');
    }
  });
  test('Interference changes rank-made hands, not just flush chances',()=>{
    const game=new Game(11);game.street=1;game.board=faces('Ah 6d 3c 8s 9d');
    game.cards.you[0].ranks=['A','K'];game.cards.you[0].options=[3,2];
    game.cards.you[0].wave=[Math.SQRT1_2,Math.SQRT1_2];game.cards.you[0].state=Density.pure(game.cards.you[0].wave);
    game.cards.you[1].ranks=['2','4'];game.cards.you[1].options=[1,2];
    assert(game.handOutlook('you',0).join('|')==='One pair|High card','Rank made-hand guidance incorrect');
    near(game.cardOdds('you',0)[0],0.5);game.move('you','H',0);near(game.cardOdds('you',0)[0],1);
    game.resolve('you',0);assert(game.cards.you[0].rank==='A','H did not select the pair-building branch');
  });
  test('Linked readouts earn face information without signaling or exposing the independent card',()=>{
    const game=new Game(28),publicRanks=game.cards.you[1].ranks.slice(),view=JSON.stringify(game.botView());
    game.cards.you[0].ranks=['A','K'];assert(JSON.stringify(game.botView())===view,'Private rank candidates leaked');
    game.rng=()=>0.1;game.move('you','measure',1,'Z');near(game.rivalOdds('you')[1],1);
    assert(game.cards.you[1].rank===publicRanks[0],'Linked rank readout mismatch');
    near(game.beliefs.nova.distribution('Z',1)[0],0.5);
    game.resolve('nova',1);assert(game.cards.nova[1].rank===publicRanks[1],'Opposite linked rank failed');
  });
  globalThis.gameTestResults={passed:results.length,tests:results};
})();
