/* Prepared teaching deals. Labels/scoring use the same two-face encoding as the match. */
(function(root){
  'use strict';
  const {Density}=Quantum,{evaluate,compare}=QuantumHoldem;
  const labels=['A♥','K♠'];
  const board=[{rank:'A',suit:1,deck:1},{rank:'7',suit:2,deck:0},{rank:'3',suit:3,deck:1},{rank:'9',suit:1,deck:1},{rank:'J',suit:2,deck:0}];
  const face=(bit,owner='you')=>({rank:bit===0?'A':'K',suit:bit===0?0:3,deck:owner==='you'?0:1});
  const hand=(lesson,owner,bit)=>owner==='you'?[face(bit),{rank:lesson===2?'Q':'2',suit:2,deck:0}]:lesson===2?[face(bit,'nova'),{rank:'2',suit:2,deck:1}]:[{rank:'Q',suit:0,deck:1},{rank:'Q',suit:1,deck:1}];
  const result=(lesson,youBit,novaBit=0)=>{
    const you=evaluate([...hand(lesson,'you',youBit),...board]),nova=evaluate([...hand(lesson,'nova',novaBit),...board]);
    return {you,nova,order:compare(you.score,nova.score)};
  };
  const winChance=(lesson,state)=>state.jointZ().reduce((total,p,bits)=>{const order=result(lesson,bits&1,(bits>>1)&1).order;return total+p*(order>0?1:order===0?0.5:0);},0);
  const source=lesson=>lesson===2?Density.bell():Density.pure([Math.SQRT1_2,Math.SQRT1_2]);
  const experimentPlan=name=>name==='link'?[{action:'H',qubit:0,actor:'You'},{action:'H',qubit:1,actor:'Nova'}]:name==='phase'?[{action:'Z'},{action:'H'}]:name==='disturbance'?[{action:'dephase',basis:'Z'},{action:'H'}]:name==='quarter'?[{action:'S'}]:[{action:'H'}];
  function experimentFrames(name){
    const coherent=source(name==='link'?2:0),mixture=coherent.clone().dephase('Z',0);
    const frames=[{coherent:coherent.clone(),mixture:mixture.clone(),operation:null}];
    for(const op of experimentPlan(name)){
      for(const state of [coherent,mixture])op.action==='dephase'?state.dephase(op.basis,op.qubit||0):state.gate(op.action,op.qubit||0);
      frames.push({coherent:coherent.clone(),mixture:mixture.clone(),operation:op});
    }
    return frames;
  }
  root.LearningHands={labels,board,face,hand,result,winChance,source,experimentPlan,experimentFrames};
})(typeof globalThis!=='undefined'?globalThis:window);
