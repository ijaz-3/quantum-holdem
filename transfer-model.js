/* Unfamiliar, scored predictions. No answer/route is revealed before responding. */
(function(root){
  'use strict';
  const {Density}=Quantum,{randomSource,evaluate,compare,Game}=QuantumHoldem;
  function create(seed){
    const rng=randomSource(seed),kind=Math.floor(rng()*6),linked=kind>=3,goal=rng()<0.5?0:1;
    const board=LearningHands.board.map(c=>({...c}));board[0].rank=goal===0?'A':'K';
    const p=kind===2?0.5:[0.2,0.5,0.8][Math.floor(rng()*3)],phase=kind===0?0:kind===1?Math.PI:Math.PI/2;
    const state=linked?Density.bell():Density.pure([Math.sqrt(p),{re:Math.sqrt(1-p)*Math.cos(phase),im:Math.sqrt(1-p)*Math.sin(phase)}]);
    if(kind>=4)state.gate('H',1);if(kind===5)state.gate('S',0);
    const win=s=>s.distribution('Z',0).reduce((value,weight,bit)=>{const you=evaluate([...LearningHands.hand(0,'you',bit),...board]),nova=evaluate([...LearningHands.hand(0,'nova',0),...board]);const order=compare(you.score,nova.score);return value+weight*(order>0?1:order===0?0.5:0);},0);
    const gains=linked?['Z','X','Y'].map(b=>Game.prototype.linkInformation.call({beliefs:{you:state}},'you',b)):null;
    const before=linked?null:win(state),after=linked?null:win(state.clone().gate('H',0));
    const correct=linked?gains.indexOf(Math.max(...gains)):Math.abs(after-before)<1e-9?2:after>before?0:1;
    return {seed,kind,linked,goal,board,state,before,after,gains,correct,options:linked?['Z · read my face','X · plus / minus','Y · phase direction']:['H improves my win chance','H reduces my win chance','H leaves my win chance unchanged'],question:linked?'Which one readout best predicts Nova’s final Z face now?':'Would H improve your win chance on this shown board?',preparation:linked?(kind===3?'Fresh opposite-face Bell pair.':kind===4?'Nova has publicly applied H to its half.':'The pair was prepared with a quarter-turn on your half; Nova then publicly applied H.'): 'Independent card. Read its initial face probabilities and phase arrows; the shown board may favor either candidate.'};
  }
  root.TransferModel={create};
})(globalThis);
