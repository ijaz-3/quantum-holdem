/* Pure game rules. The browser and tests use the same implementation. */
(function (root) {
  'use strict';
  const SUITS = ['♥', '♦', '♣', '♠'];
  const SUIT_NAMES = ['hearts', 'diamonds', 'clubs', 'spades'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const HANDS = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Five of a kind'];
  const STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
  function randomSource(seed) {
    let value = seed >>> 0;
    return () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, 1 | value); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(items, rng) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function compare(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const delta = (a[i] || 0) - (b[i] || 0); if (delta) return Math.sign(delta); } return 0; }
  function five(cards) {
    const values = cards.map(c => RANKS.indexOf(c.rank) + 2).sort((a, b) => b - a);
    const counts = new Map(); values.forEach(n => counts.set(n, (counts.get(n) || 0) + 1));
    const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const flush = cards.every(c => c.suit === cards[0].suit);
    const unique = [...new Set(values)];
    let straight = unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : 0;
    if (unique.join(',') === '14,5,4,3,2') straight = 5;
    if (groups[0][1] === 5) return [9, groups[0][0]];
    if (flush && straight) return [8, straight];
    if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
    if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
    if (flush) return [5, ...values];
    if (straight) return [4, straight];
    if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(g => g[0])];
    if (groups[0][1] === 2 && groups[1][1] === 2) return [2, Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]];
    if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(g => g[0])];
    return [0, ...values];
  }
  function evaluate(cards) {
    if (cards.length < 5) return { score: [0], name: 'Drawing', cards: [] };
    let score = [-1], best = [];
    for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
        for (let e = d + 1; e < cards.length; e++) {
          const candidate = [cards[a], cards[b], cards[c], cards[d], cards[e]], value = five(candidate);
          if (compare(value, score) > 0) { score = value; best = candidate; }
        }
    return { score, name: HANDS[score[0]], cards: best };
  }
  const { Density, transform, probabilities, BASES } = Quantum;
  const faceKey = c => `${c.deck || 0}:${c.rank}:${c.suit}`;
  const candidateFace = (card, bit) => ({deck:card.deck,rank:card.ranks?card.ranks[bit]:card.rank,suit:card.options[bit]});
  const candidateLabel = (card, bit) => `${candidateFace(card,bit).rank}${SUITS[card.options[bit]]}`;
  function candidateDeck(cards, board) {
    const reserved = new Set();
    cards.forEach(c => c.options.forEach((_,bit) => reserved.add(faceKey(candidateFace(c,bit)))));
    board.forEach(c => reserved.add(faceKey(c)));
    return [0, 1].flatMap(deck => RANKS.flatMap(rank => [0, 1, 2, 3].map(suit => ({ deck, rank, suit })))).filter(c => !reserved.has(faceKey(c)));
  }
  class Game {
    constructor(seed = Math.floor(Math.random() * 4294967296)) { this.seed=seed>>>0;this.rng = randomSource(seed); this.reset(); }
    reset() {
      this.stacks = { you: 1000, nova: 1000 }; this.hand = 0; this.limit = 10; this.history = [];
      this.stats = { wins: 0, losses: 0, splits: 0 }; this.startHand();
    }
    log(text, quantum = null) { this.history.push({ hand: this.hand, street: STREETS[this.street], text, quantum }); }
    startHand() {
      if (this.hand && (!this.over || this.matchOver)) return false;
      this.hand++; this.street = 0; this.over = false; this.matchOver = false; this.showdown = false;
      this.result = null; this.turn = 'you'; this.bets = { you: 0, nova: 0 }; this.moves = { you: 2, nova: 2 }; this.novaRaised = false;
      this.linked = Density.bell(); this.beliefs = { you: this.linked.clone(), nova: this.linked.clone() };
      this.quantumEvents = [];
      this.visualEvents = [];this.equityCache=new Map();
      const linkedRanks=shuffle(RANKS,this.rng).slice(0,2), linked=shuffle([0,1,2,3],this.rng).slice(0,2);
      const linkedCard=deck=>({deck,rank:null,ranks:linkedRanks.slice(),options:linked.slice(),locked:false,suit:null,readout:null,type:'linked'});
      const pairCards=[linkedCard(0),linkedCard(1)];
      const tunable = deck => {
        const p = 0.08 + this.rng() * 0.84, phase=[0,Math.PI,Math.PI/2,-Math.PI/2][Math.floor(this.rng()*4)];
        const b=Math.sqrt(1-p),wave=[Math.sqrt(p),phase===0?b:phase===Math.PI?-b:{re:b*Math.cos(phase),im:b*Math.sin(phase)}];
        const available=shuffle(candidateDeck(pairCards,[]).filter(c=>c.deck===deck),this.rng),first=available[0],second=available.find(c=>c.rank!==first.rank);
        return {deck,rank:null,ranks:[first.rank,second.rank],options:[first.suit,second.suit],phase,wave,state:Density.pure(wave),locked:false,suit:null,readout:null,type:'tunable'};
      };
      this.cards = {
        you: [tunable(0),pairCards[0]], nova: [tunable(1),pairCards[1]]
      };
      this.initialQuantum = {
        you: { probability: probabilities(this.cards.you[0].wave)[0], phase:this.cards.you[0].phase,phaseFlipped:this.cards.you[0].phase===Math.PI },
        nova: { probability: probabilities(this.cards.nova[0].wave)[0], phase:this.cards.nova[0].phase,phaseFlipped:this.cards.nova[0].phase===Math.PI }
      };
      this.board = shuffle(candidateDeck([...this.cards.you, ...this.cards.nova], []), this.rng).slice(0, 5);
      const ante = Math.min(10, this.stacks.you, this.stacks.nova);
      this.stacks.you -= ante; this.stacks.nova -= ante; this.pot = ante * 2;
      this.log(`Hand ${this.hand}. Each player antes ${ante}. Two quantum moves each.`);
      if (this.stacks.you === 0 || this.stacks.nova === 0) this.finish();
      return true;
    }
    get visibleBoard() { return this.board.slice(0, [0, 3, 4, 5][this.street]); }
    get due() { return Math.max(0, this.bets.nova - this.bets.you); }
    get maxBet() { return Math.min(this.bets.you + this.stacks.you, this.bets.nova + this.stacks.nova); }
    get minimumRaise() { return Math.max(this.bets.you, this.bets.nova) + 20; }
    canMove(owner, index = 0) { return !this.over && this.moves[owner] > 0 && !this.cards[owner][index].locked && this.turn === owner; }
    cardOdds(owner, index, basis = 'Z') { return index === 0 ? this.cards[owner][0].state.distribution(basis) : this.beliefs[owner].distribution(basis, owner === 'you' ? 0 : 1); }
    rivalOdds(owner) { return this.beliefs[owner].distribution('Z', owner === 'you' ? 1 : 0); }
    linkInformation(owner,basis) {
      const state=this.beliefs[owner],qubit=owner==='you'?0:1;
      const entropy=p=>p<1e-10||p>1-1e-10?0:-p*Math.log2(p)-(1-p)*Math.log2(1-p);
      const prior=entropy(state.distribution('Z',1-qubit)[0]),weights=state.distribution(basis,qubit);
      let remaining=0;for(let bit=0;bit<2;bit++)if(weights[bit]>1e-10)remaining+=weights[bit]*entropy(state.clone().condition(basis,bit,qubit).distribution('Z',1-qubit)[0]);
      return Math.max(0,prior-remaining);
    }
    decisionContext() {return {board:this.visibleBoard.map(c=>({...c})),otherOdds:{you:[this.cardOdds('you',0),this.cardOdds('you',1)],nova:[this.cardOdds('nova',0),this.cardOdds('nova',1)]}};}
    madeHandOdds(owner,index,state,context=this.decisionContext()) {
      if(context.board.length<3)return null;
      const own=state.distribution('Z',index===0?0:owner==='you'?0:1),other=context.otherOdds[owner][1-index],categories=Array(10).fill(0);
      for(let bit=0;bit<2;bit++)for(let second=0;second<2;second++)categories[evaluate([candidateFace(this.cards[owner][index],bit),candidateFace(this.cards[owner][1-index],second),...context.board]).score[0]]+=own[bit]*other[second];
      return categories;
    }
    describeChange(owner,index,before,after,context=this.decisionContext()) {
      const a=this.madeHandOdds(owner,index,before,context),b=this.madeHandOdds(owner,index,after,context),pct=p=>Math.round(p*100)+'%';let poker='';
      if(a){let category=0;for(let i=1;i<10;i++)if(Math.abs(b[i]-a[i])>Math.abs(b[category]-a[category]))category=i;
        poker=Math.abs(b[category]-a[category])>0.005?`${HANDS[category]} on this board: ${pct(a[category])} → ${pct(b[category])}. These are made-hand odds, not win odds.`:'Made-hand categories stay the same on this board; face strength, kickers, and rival correlations can still matter.';
      }else poker='No flop yet: the board has not told you which face builds a hand. Saving moves preserves that choice.';
      if(index===1){const p=before.jointZ(),q=after.jointZ();return poker+` Matching linked faces: ${pct(p[0]+p[3])} → ${pct(q[0]+q[3])}. An unread rival outcome is not chosen remotely.`;}
      const first=before.distribution('Z'),last=after.distribution('Z');
      if(Math.abs(first[0]-last[0])<1e-9){const future=after.clone().gate('H').distribution('Z');return poker+` Face odds stay fixed now. A next H would give ${candidateLabel(this.cards[owner][0],0)} ${pct(future[0])} / ${candidateLabel(this.cards[owner][0],1)} ${pct(future[1])}; it needs another move.`;}
      return poker;
    }
    preview(owner, index, gates) {
      const state = index === 0 ? this.cards[owner][0].state.clone() : this.beliefs[owner].clone(), qubit = index === 0 ? 0 : owner === 'you' ? 0 : 1;
      gates.forEach(gate => state.gate(gate, qubit)); return state.distribution('Z', qubit);
    }
    quantumDistribution() {
      const a = this.cards.you[0].state.jointZ(), b = this.cards.nova[0].state.jointZ(), pair = this.linked.jointZ();
      return Array.from({ length: 16 }, (_, bits) => a[bits & 1] * b[(bits >> 1) & 1] * pair[bits >> 2]);
    }
    visualSnapshot(owner,index) { return index===0?{[owner]:this.cards[owner][0].state.clone()}:{you:this.beliefs.you.clone(),nova:this.beliefs.nova.clone()}; }
    move(owner, action, index = 0, basis = 'Z', reason = '') {
      if (!this.canMove(owner, index)) return false;
      const card = this.cards[owner][index];
      if (action === 'lock' || action === 'measure') {
        if (!['Z', 'X', 'Y'].includes(basis)) return false;
        this.resolve(owner, index, basis);
        this.log(`${owner === 'you' ? 'You' : 'Nova'} measured the ${card.type} card in ${basis} basis.${reason?' '+reason:' Readout stays private.'}`, {owner,index,action:'measure',basis,visual:this.visualEvents.length-1});
      } else {
        if (!['H', 'Z', 'S'].includes(action)) return false;
        const before=this.visualSnapshot(owner,index),context=this.decisionContext();
        if (index === 0) { card.wave = transform(card.wave, action); card.state.gate(action); }
        else { const qubit = owner === 'you' ? 0 : 1; this.linked.gate(action, qubit); this.beliefs.you.gate(action, qubit); this.beliefs.nova.gate(action, qubit); }
        card.readout = null;
        this.quantumEvents.push({ owner, index, action, probabilities: this.quantumDistribution() });
        this.visualEvents.push({owner,index,action,before,after:this.visualSnapshot(owner,index),context});
        this.log(`${owner === 'you' ? 'You' : 'Nova'} applied ${action} (${action==='H'?'mix amplitudes':action==='S'?'90° phase turn':'180° phase flip'}) to the ${card.type} card.${reason?' '+reason:''}`,{owner,index,action,visual:this.visualEvents.length-1});
      }
      this.moves[owner]--; return true;
    }
    resolve(owner, index, basis = 'Z', automatic = false) {
      const card = this.cards[owner][index]; if (card.locked) return;
      const before=this.visualSnapshot(owner,index),context=this.decisionContext();
      let outcome;
      if (index === 1) {
        const qubit = owner === 'you' ? 0 : 1, other = owner === 'you' ? 'nova' : 'you';
        outcome = this.linked.measure(basis, qubit, this.rng);
        this.beliefs[owner].condition(basis, outcome, qubit);
        this.beliefs[other].dephase(basis, qubit);
      } else { outcome = card.state.measure(basis, 0, this.rng); card.wave = BASES[basis][outcome].map(a => typeof a === 'number' ? a : { ...a }); }
      card.readout = { basis, outcome };
      if (basis === 'Z') { Object.assign(card,candidateFace(card,outcome)); card.locked = true; }
      this.quantumEvents.push({ owner, index, action: 'measure', basis, outcome, probabilities: this.quantumDistribution() });
      this.visualEvents.push({owner,index,action:'measure',basis,outcome,before,after:this.visualSnapshot(owner,index),automatic,context});
    }
    pay(owner, target) { const amount = target - this.bets[owner]; this.stacks[owner] -= amount; this.pot += amount; this.bets[owner] = target; }
    act(action, target = 0) {
      if (this.over || this.turn !== 'you') return false;
      if (action === 'fold') { this.finish('nova'); return true; }
      if (action === 'call') {
        if (!this.due) return false;
        const amount = this.due; this.pay('you', this.bets.nova); this.log(`You called ${amount}.`); this.nextStreet(); return true;
      }
      if (action === 'check') {
        if (this.due) return false; this.log('You checked.'); this.turn = 'nova'; return true;
      }
      if (action === 'bet') {
        if (!Number.isInteger(target) || target > this.maxBet || target <= Math.max(this.bets.you, this.bets.nova)) return false;
        if (target < this.minimumRaise && target !== this.maxBet) return false;
        const raised = this.bets.nova > 0; this.pay('you', target); this.log(`You ${raised ? 'raised to' : 'bet'} ${target}.`); this.turn = 'nova'; return true;
      }
      return false;
    }
    nextStreet() {
      if (this.street === 3 || this.stacks.you === 0 || this.stacks.nova === 0) { this.finish(); return; }
      this.street++; this.bets = { you: 0, nova: 0 }; this.novaRaised = false; this.turn = 'you';
      this.log(`${STREETS[this.street]} dealt.`);
    }
    finish(winner = null) {
      if (this.over) return;
      const pot = this.pot;
      let you = null, nova = null;
      if (!winner) {
        this.showdown = true; this.street = 3;
        ['you', 'nova'].forEach(owner => [0, 1].forEach(index => this.resolve(owner, index,'Z',true)));
        you = evaluate([...this.cards.you, ...this.board]); nova = evaluate([...this.cards.nova, ...this.board]);
        const order = compare(you.score, nova.score); winner = order > 0 ? 'you' : order < 0 ? 'nova' : 'split';
      }
      if (winner === 'split') { this.stacks.you += Math.floor(pot / 2); this.stacks.nova += Math.ceil(pot / 2); this.stats.splits++; }
      else { this.stacks[winner] += pot; this.stats[winner === 'you' ? 'wins' : 'losses']++; }
      this.result = { winner, pot, you, nova, folded: !this.showdown }; this.pot = 0; this.over = true; this.turn = null;
      this.matchOver = this.hand >= this.limit || this.stacks.you === 0 || this.stacks.nova === 0;
      this.log(winner === 'split' ? `Split pot: ${pot}.` : `${winner === 'you' ? 'You' : 'Nova'} won ${pot}${you ? ' with ' + (winner === 'you' ? you.name : nova.name).toLowerCase() : ' after a fold'}.`);
    }
    // Only Nova's own private cards, visible board, and earned linked knowledge.
    botView() {
      return {
        board: this.visibleBoard.map(c => ({ ...c })),
        own: this.cards.nova.map(c => ({ ...c, ranks:c.ranks.slice(), options: c.options.slice(), wave: c.wave ? c.wave.slice() : undefined })),
        linked: this.beliefs.nova.clone()
      };
    }
    botEquity(view = this.botView(), trials = 90) {
      // Integrate quantum Z branches exactly; sample only unseen classical cards.
      this.equityCache||=new Map();
      const seed=this.hand*997+this.street*97;
      const key=JSON.stringify({seed,board:view.board,own:view.own.map(c=>({deck:c.deck,ranks:c.ranks,options:c.options}))});
      let cache=this.equityCache.get(key);
      if(!cache){
        const counterpart={...view.own[1],deck:1-view.own[1].deck},deck=candidateDeck([...view.own,counterpart],view.board);
        cache={rng:randomSource(seed),samples:[],deck,counterpart};this.equityCache.set(key,cache);
      }
      while(cache.samples.length<trials){
        const unseen=cache.deck.filter(c=>c.deck===cache.counterpart.deck),tunable=unseen[Math.floor(cache.rng()*unseen.length)],alternate=unseen.find(c=>c.rank!==tunable.rank);
        const reserved=new Set([faceKey(tunable),faceKey(alternate)]),future=shuffle(cache.deck.filter(c=>!reserved.has(faceKey(c))),cache.rng).slice(0,5-view.board.length),board=[...view.board,...future];
        const values=Array.from({length:8},(_,bits)=>{
          const pair=bits>>1,own=[candidateFace(view.own[0],bits&1),candidateFace(view.own[1],pair>>1)],opponent=[tunable,candidateFace(cache.counterpart,pair&1)];
          const order=compare(evaluate([...own,...board]).score,evaluate([...opponent,...board]).score);
          return order>0?1:order===0?0.5:0;
        });
        cache.samples.push(values);
      }
      const independent=probabilities(view.own[0].wave),pair=view.linked.jointZ();let wins=0;
      for(const values of cache.samples.slice(0,trials))for(let bits=0;bits<8;bits++)wins+=values[bits]*independent[bits&1]*pair[bits>>1];
      return wins/trials;
    }
    handOutlook(owner,index) {
      if(this.visibleBoard.length<3)return ['Wait for the flop','Wait for the flop'];
      const other=this.cards[owner][1-index];
      return [0,1].map(bit=>{
        const odds=this.cardOdds(owner,1-index);
        const names=[0,1].filter(b=>odds[b]>1e-9).map(b=>evaluate([candidateFace(this.cards[owner][index],bit),candidateFace(other,b),...this.visibleBoard]).name);
        return [...new Set(names)].join(' / ');
      });
    }
    botQuantum() {
      if(!this.moves.nova||this.street===0)return;
      const original=this.botView(),baseline=this.botEquity(original,56);let best=null;
      const change=(view,index,gate)=>{
        if(index===0){view.own[0].wave=transform(view.own[0].wave,gate);}
        else view.linked.gate(gate,1);
      };
      const copy=()=>this.botView();
      for(const index of [0,1]){
        if(!this.canMove('nova',index))continue;
        const consider=(plan,expected,cost)=>{const score=expected-baseline-0.025*cost;if(score>0.035&&(!best||score>best.score))best={index,plan,score};};
        for(const gates of [['H'],['Z','H'],['S','H']])if(gates.length<=this.moves.nova){
          const view=copy();gates.forEach(gate=>change(view,index,gate));consider({gates},this.botEquity(view,56),gates.length);
        }
        if(this.moves.nova>=2)for(const basis of ['X','Y']){
          const state=index===0?this.cards.nova[0].state:this.beliefs.nova,qubit=index===0?0:1,weights=state.distribution(basis,qubit);let expected=0;
          for(let outcome=0;outcome<2;outcome++)if(weights[outcome]>1e-9){
            const view=copy();
            if(index===0)view.own[0].wave=BASES[basis][outcome].slice();
            else view.linked.condition(basis,outcome,1);
            const keep=this.botEquity(view,56);change(view,index,'H');
            expected+=weights[outcome]*Math.max(keep,this.botEquity(view,56));
          }
          consider({basis},expected,2);
        }
      }
      if(best){
        const reason='To improve its poker prospects on the visible board.';
        if(best.plan.gates){for(const gate of best.plan.gates)this.move('nova',gate,best.index,'Z',reason);}
        else{
          this.move('nova','measure',best.index,best.plan.basis,'Inspect phase before deciding whether to mix.');
          const keep=this.botEquity(this.botView(),56),view=this.botView();change(view,best.index,'H');
          if(this.moves.nova&&this.botEquity(view,56)>keep+0.01)this.move('nova','H',best.index,'Z',reason);
        }
        return;
      }
      if(this.canMove('nova',1)){
        const entropy=p=>p<1e-9||p>1-1e-9?0:-p*Math.log2(p)-(1-p)*Math.log2(1-p);
        const prior=entropy(this.beliefs.nova.distribution('Z',0)[0]);let basisBest='Z',gainBest=-1;
        for(const basis of ['Z','X','Y']){const weights=this.beliefs.nova.distribution(basis,1);let residual=0;for(let outcome=0;outcome<2;outcome++)if(weights[outcome]>1e-9)residual+=weights[outcome]*entropy(this.beliefs.nova.clone().condition(basis,outcome,1).distribution('Z',0)[0]);const gain=prior-residual;if(gain>gainBest+1e-9){gainBest=gain;basisBest=basis;}}
        if(gainBest>0.1){this.move('nova','measure',1,basisBest,'This basis can reveal your linked face, including rank.');return;}
        const exposed=this.history.some(e=>e.quantum&&e.quantum.owner==='you'&&e.quantum.index===1&&e.quantum.action==='measure'&&e.quantum.basis==='Z');
        if(exposed)this.move('nova','H',1,'Z','To make your earlier exact-face inference uncertain again.');
      }
      if(this.street>=2&&this.canMove('nova',0))this.move('nova','measure',0,'Z','To learn its exact card before betting.');
    }
    respond() {
      if (this.over || this.turn !== 'nova') return;
      this.botQuantum();
      const equity = this.botEquity(), facing = this.bets.you - this.bets.nova;
      const bluff = this.rng() < 0.12, max = this.maxBet;
      if (facing > 0) {
        const price = facing / (this.pot + facing);
        if (equity < price + 0.035 && !bluff) { this.finish('you'); return; }
        if (!this.novaRaised && equity > 0.73 && max >= this.bets.you + 20 && this.rng() < 0.5) {
          const target = Math.min(max, this.bets.you + Math.max(20, Math.round(this.pot / 40) * 10));
          this.pay('nova', target); this.novaRaised = true; this.log(`Nova raised to ${target}.`); this.turn = 'you'; return;
        }
        this.pay('nova', this.bets.you); this.log(`Nova called ${facing}.`); this.nextStreet(); return;
      }
      if ((equity > 0.57 || bluff) && max > 0) {
        const target = Math.min(max, Math.max(20, Math.round(this.pot * (equity > 0.75 ? 0.65 : 0.4) / 10) * 10));
        this.pay('nova', target); this.novaRaised = true; this.log(`Nova bet ${target}.`); this.turn = 'you';
      } else { this.log('Nova checked.'); this.nextStreet(); }
    }
  }
  root.QuantumHoldem = { Game, evaluate, compare, transform, probabilities, randomSource, SUITS, SUIT_NAMES, RANKS, HANDS, STREETS, candidateDeck, faceKey, candidateFace, candidateLabel };
})(typeof globalThis !== 'undefined' ? globalThis : window);
