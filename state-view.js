/* Shared visible state and operation explanations. Render only authorized knowledge. */
(function(root){
  'use strict';
  const {Density,GATES,norm}=Quantum;
  const escape=text=>String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=p=>p<1e-9?'0%':p>1-1e-9?'100%':Math.round(p*1000)===1000?'>99.9%':Math.round(p*1000)===0?'<0.1%':`${(p*100).toFixed(1).replace(/\.0$/,'')}%`;
  const complex=a=>typeof a==='number'?{re:a,im:0}:a;
  const multiply=(a,b)=>{a=complex(a);b=complex(b);return{re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re};};
  const sum=(a,b)=>({re:a.re+b.re,im:a.im+b.im});
  function ket(state){
    if(state.purity()<1-1e-8)return null;
    const pivot=state.jointZ().findIndex(p=>p>1e-9), magnitude=Math.sqrt(state.data[pivot*state.dim+pivot].re);
    return Array.from({length:state.dim},(_,i)=>{const value=state.data[i*state.dim+pivot];return{re:value.re/magnitude,im:value.im/magnitude};});
  }
  function gateKet(wave,gate,qubit){
    if(!wave)return null;
    const mask=1<<qubit;
    return wave.map((_,index)=>sum(multiply(GATES[gate][(index>>qubit)&1][0],wave[index&~mask]),multiply(GATES[gate][(index>>qubit)&1][1],wave[index|mask])));
  }
  function coefficient(a){a=complex(a);const re=Math.abs(a.re)<1e-6?0:a.re,im=Math.abs(a.im)<1e-6?0:a.im;
    if(!im)return re.toFixed(3).replace(/^-0\.000$/,'0.000');
    if(!re)return`${im<0?'−':''}${Math.abs(im).toFixed(3)}i`;
    return`(${re.toFixed(3)} ${im<0?'−':'+'} ${Math.abs(im).toFixed(3)}i)`;
  }
  const symbols=(state,options)=>state.qubits===1?options:Array.from({length:4},(_,i)=>`${options[i&1]} ${options[(i>>1)&1]}`);
  function equation(state,options,wave=ket(state)){
    if(!wave)return'Mixed knowledge: there is no single amplitude vector to display.';
    const labels=symbols(state,options);
    return wave.map((a,i)=>norm(a)<1e-10?'':`${coefficient(a)} |${labels[i]}⟩`).filter(Boolean).join(' + ');
  }
  function phaseWheel(amplitude){
    if(amplitude===null)return'<span class="phase-wheel unknown-phase" aria-label="No single phase for this mixed state">?</span>';
    const a=complex(amplitude), magnitude=Math.sqrt(norm(a));
    if(magnitude<1e-8)return'<span class="phase-wheel empty-phase" aria-label="Zero amplitude">·</span>';
    const angle=Math.atan2(a.im,a.re), degrees=Math.round(angle*180/Math.PI);
    const length=15*Math.min(1,magnitude),x=22+length*Math.cos(angle),y=22-length*Math.sin(angle);
    return`<svg class="phase-wheel" viewBox="0 0 44 44" role="img" aria-label="Amplitude length ${magnitude.toFixed(3)}, phase ${degrees} degrees"><circle cx="22" cy="22" r="19"/><path class="phase-grid" d="M3 22H41M22 3V41"/><line class="phase-arrow" x1="22" y1="22" x2="${x}" y2="${y}"/><circle class="phase-tip" cx="${x}" cy="${y}" r="2.5"/><circle class="phase-origin" cx="22" cy="22" r="2"/></svg>`;
  }
  function stateHTML(state,{options=['0','1'],title='Current state',wave=null,compact=false,brief=false}={}){
    const amplitudes=wave||ket(state), probabilities=state.jointZ(),labels=symbols(state,options);
    const cells=probabilities.map((p,i)=>`<div class="amplitude-cell"><div class="amplitude-label">${escape(labels[i])}</div>${phaseWheel(amplitudes?amplitudes[i]:null)}<span class="amplitude-number">${amplitudes?escape(coefficient(amplitudes[i])):'no single amplitude'}</span><div class="amplitude-track"><span style="width:${p*100}%"></span></div><strong>${pct(p)}</strong></div>`).join('');
    const axes=state.qubits===1?['X','Y','Z'].map(basis=>`<div class="basis-readout"><span>${basis}</span><span>${basis==='Z'?`${escape(options[0])} / ${escape(options[1])}`:basis==='X'?'+ / −':'+i / −i'}</span><strong>${pct(state.distribution(basis)[0])} / ${pct(state.distribution(basis)[1])}</strong></div>`).join(''):[['Z','Z'],['X','X'],['Y','X']].map(bases=>{const p=state.joint(bases),same=p[0]+p[3];return`<div class="basis-readout"><span>${bases.join('/')}</span><span>${bases[0]==='Z'?'same faces':'matching readouts'}</span><strong>${pct(same)}</strong></div>`;}).join('');
    let coherence='';
    if(state.qubits===2){
      const links=[];
      for(let a=0;a<4;a++)for(let b=a+1;b<4;b++){const value=state.data[a*4+b];if(norm(value)>1e-10)links.push(`<span class="coherence-link">${escape(labels[a])} ↔ ${escape(labels[b])} <b>${escape(coefficient(value))}</b></span>`);}
      coherence=`<details class="coherence-links"><summary>Interference links · density matrix</summary>${links.length?links.join(''):'No interference links remain in this knowledge state.'}</details>`;
    }
    return`<section class="state-card-view ${compact?'compact-state':''}"><div class="state-view-title">${escape(title)}<span>${state.qubits===2?'PAIR · ORDER YOU, NOVA':amplitudes?'COHERENT STATE':'MIXED STATE'}</span></div><div class="amplitude-grid ${state.qubits===2?'four-amplitudes':''}">${cells}</div>${brief?'<details class="state-math"><summary>Equation &amp; coherence</summary>':''}<div class="state-equation-live">${escape(equation(state,options,amplitudes))}</div>${coherence}${brief?'</details>':''}<div class="basis-readouts">${axes}</div></section>`;
  }
  const operations={
    H:{name:'Mix amplitudes · H',formula:'(a, b) → ((a + b)/√2, (a − b)/√2)',text:'H adds the two amplitudes for the first outcome and subtracts them for the second. Aligned waves can reinforce; opposite waves can cancel. Probabilities are the squared lengths of the resulting amplitudes.'},
    Z:{name:'Flip phase · Z gate',formula:'(a, b) → (a, −b)',text:'The second amplitude rotates by 180°. Its length stays the same, so face probabilities do not change now. A later H can turn that phase change into a different face preference.'},
    S:{name:'Quarter-turn phase · S gate',formula:'(a, b) → (a, i·b)',text:'The second amplitude rotates by 90°. Face probabilities stay the same. This shifts which X/Y questions can detect the phase; a prepared plus state becomes +i.'},
    MZ:{name:'Measure exact face · Z basis',formula:'Project onto |0⟩ or |1⟩',text:'One of the two face outcomes is sampled. The card is projected into that face state, and the game locks it. This is a state change, not a peek at a predetermined hidden face.'},
    MX:{name:'Read phase · X basis',formula:'Project onto (|0⟩ ± |1⟩)/√2',text:'The readout is plus or minus, not a face. The card becomes the corresponding X state. Its later Z face probabilities are 50/50 unless another gate changes them.'},
    MY:{name:'Read phase direction · Y basis',formula:'Project onto (|0⟩ ± i|1⟩)/√2',text:'The readout is +i or −i, not a face. The card becomes that Y state. Its Z probabilities are 50/50, but its phase is different from an X state.'}
  };
  function effectHTML(before,after,{action='H',basis='Z',options=['0','1'],qubit=0,actor='You',target='tunable card',outcome=null,preview=false,privateReadout=false,brief=false}={}){
    const operation=operations[action==='measure'?'M'+basis:action], isGate=action!=='measure';
    const beforeWave=ket(before), afterWave=isGate?gateKet(beforeWave,action,qubit):null;
    const isPair=before.qubits===2;
    const unchanged=before.data.every((a,i)=>Math.abs(a.re-after.data[i].re)<1e-9&&Math.abs(a.im-after.data[i].im)<1e-9);
    const pairText=!isPair?'':action==='H'?` In the pair, H mixes branches that differ in ${actor==='Nova'?'Nova’s':'your'} face bit while holding the other bit fixed. This can change two nonzero joint amplitudes into four.`:action==='Z'||action==='S'?` In the pair, every branch where ${actor==='Nova'?'Nova has':'you have'} the second candidate face receives this phase turn. The other branches are unchanged.`:' The readout projects one half and changes what can be inferred about the other half.';
    const explanation=operation.text+pairText+(isPair?' Each card separately can stay 50/50 even when the pair changes.':'')+(unchanged?(isGate?' For this particular state, the operation leaves the density matrix unchanged.':' This state already fits the selected readout branch, so this measurement leaves it unchanged.'):'');
    const readout=outcome===null?'':basis==='Z'?options[outcome]:`${outcome===0?'+':'−'}${basis==='Y'?'i':''}`;
    return`<div class="effect-heading"><span class="gate-badge">${action==='measure'?'M'+basis:action}</span><div><h3>${escape(actor)} ${preview?'would apply':'applied'} ${escape(operation.name)} to the ${escape(target)}</h3><p>${escape(operation.formula)}</p></div></div>${brief?'<details class="effect-details"><summary>Why this changes the state</summary>':''}<p class="effect-explanation">${escape(explanation)}</p>${brief?'</details>':''}${preview&&action==='measure'?'<p class="effect-result">Preview averages possible readouts. Your actual result will select one branch.</p>':''}${privateReadout?'<p class="effect-result">Nova’s readout is private. The after-view averages its possible results.</p>':''}${outcome!==null?`<p class="effect-result">Readout: <strong>${escape(readout)}</strong>. The after-state is conditioned on this result.</p>`:''}<div class="state-transition">${stateHTML(before,{title:'Before',options,wave:beforeWave,compact:true,brief})}<div class="transition-arrow" aria-hidden="true">→</div>${stateHTML(after,{title:preview?'After · preview':'After',options,wave:afterWave,compact:true,brief})}</div>`;
  }
  function guideHTML(){return`<div class="visual-key"><span>${phaseWheel({re:1,im:0})} Arrow length = amplitude; direction = phase</span><span><i class="key-probability"></i> Bar = probability</span></div><p class="visual-key-note">Square the amplitude length to get probability. Phase turns can leave the bars unchanged; H can make waves reinforce or cancel. Turning every arrow together is an unobservable global phase.</p>`;}
  function miniHTML(state,options){const wave=ket(state),labels=symbols(state,options),probs=state.jointZ();return`<div class="mini-state ${state.qubits===2?'mini-pair':''}">${labels.map((label,i)=>`<div><span>${escape(label)}</span>${phaseWheel(wave?wave[i]:null)}<small>${wave?escape(coefficient(wave[i])):pct(probs[i])}</small></div>`).join('')}</div><p class="mini-state-note">${wave?'Arrows show phase; these numbers are amplitudes. Square their lengths to get probabilities.':'This is mixed knowledge after an unread private result. No single set of phase arrows describes it.'}</p>`;}
  root.StateView={stateHTML,effectHTML,guideHTML,miniHTML,operations,ket,gateKet,equation,pct,escape};
})(typeof globalThis!=='undefined'?globalThis:window);
