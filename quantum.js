/* Small, exact density-matrix simulator. Qubit 0 is the least significant bit. */
(function (root) {
  'use strict';
  const c = value => typeof value === 'number' ? { re: value, im: 0 } : value;
  const add = (a, b) => { a = c(a); b = c(b); return { re: a.re + b.re, im: a.im + b.im }; };
  const mul = (a, b) => { a = c(a); b = c(b); return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; };
  const conj = a => { a = c(a); return { re: a.re, im: -a.im }; };
  const scale = (a, value) => { a = c(a); return { re: a.re * value, im: a.im * value }; };
  const norm = a => { a = c(a); return a.re * a.re + a.im * a.im; };
  const h = Math.SQRT1_2;
  const GATES = { H: [[h, h], [h, -h]], Z: [[1, 0], [0, -1]], S: [[1, 0], [0, { re: 0, im: 1 }]], SDG: [[1, 0], [0, { re: 0, im: -1 }]] };
  const BASES = { Z: [[1, 0], [0, 1]], X: [[h, h], [h, -h]], Y: [[h, { re: 0, im: h }], [h, { re: 0, im: -h }]] };
  function transform(wave, gate) {
    if (!GATES[gate]) throw Error('Unknown gate');
    if (wave.every(a => typeof a === 'number') && (gate === 'H' || gate === 'Z')) {
      return gate === 'H' ? [(wave[0] + wave[1]) * h, (wave[0] - wave[1]) * h] : [wave[0], -wave[1]];
    }
    return GATES[gate].map(row => add(mul(row[0], wave[0]), mul(row[1], wave[1])));
  }
  const probabilities = wave => wave.map(a => Math.max(0, Math.min(1, norm(a))));
  class Density {
    constructor(qubits, data) { this.qubits = qubits; this.dim = 2 ** qubits; this.data = data.map(a => ({ ...c(a) })); }
    static pure(wave) {
      const qubits = Math.log2(wave.length);
      if (!Number.isInteger(qubits) || Math.abs(wave.reduce((s, a) => s + norm(a), 0) - 1) > 1e-9) throw Error('Invalid normalized state');
      return new Density(qubits, wave.flatMap(a => wave.map(b => mul(a, conj(b)))));
    }
    static bell() { return Density.pure([0, h, h, 0]); }
    clone() { return new Density(this.qubits, this.data); }
    trace() { let value = 0; for (let i = 0; i < this.dim; i++) value += this.data[i * this.dim + i].re; return value; }
    // Return U rho U† (or P rho P† for a projector), acting on one qubit.
    evolved(matrix, qubit = 0) {
      if (qubit < 0 || qubit >= this.qubits) throw Error('Invalid qubit');
      const mask = 1 << qubit, result = [];
      for (let row = 0; row < this.dim; row++) for (let col = 0; col < this.dim; col++) {
        let value = c(0);
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const sourceRow = (row & ~mask) | (a << qubit), sourceCol = (col & ~mask) | (b << qubit);
          value = add(value, mul(mul(matrix[(row >> qubit) & 1][a], this.data[sourceRow * this.dim + sourceCol]), conj(matrix[(col >> qubit) & 1][b])));
        }
        result.push(value);
      }
      return new Density(this.qubits, result);
    }
    gate(gate, qubit = 0) { if (!GATES[gate]) throw Error('Unknown gate'); this.data = this.evolved(GATES[gate], qubit).data; return this; }
    projector(basis, outcome) {
      if (!BASES[basis] || ![0, 1].includes(outcome)) throw Error('Invalid measurement');
      const wave = BASES[basis][outcome]; return wave.map(a => wave.map(b => mul(a, conj(b))));
    }
    distribution(basis = 'Z', qubit = 0) {
      const p = this.evolved(this.projector(basis, 0), qubit).trace();
      const first = Math.max(0, Math.min(1, p)); return [first, 1 - first];
    }
    condition(basis, outcome, qubit = 0) {
      const projected = this.evolved(this.projector(basis, outcome), qubit), probability = projected.trace();
      if (probability < 1e-12) throw Error('Impossible measurement outcome');
      this.data = projected.data.map(a => scale(a, 1 / probability)); return this;
    }
    measure(basis = 'Z', qubit = 0, rng = Math.random) {
      const outcome = rng() < this.distribution(basis, qubit)[0] ? 0 : 1;
      this.condition(basis, outcome, qubit); return outcome;
    }
    // An announced measurement with an unknown readout: average over outcomes.
    dephase(basis = 'Z', qubit = 0) {
      const a = this.evolved(this.projector(basis, 0), qubit), b = this.evolved(this.projector(basis, 1), qubit);
      this.data = a.data.map((value, i) => add(value, b.data[i])); return this;
    }
    jointZ() { const result = []; for (let i = 0; i < this.dim; i++) result.push(Math.max(0, this.data[i * this.dim + i].re)); return result; }
    reduced(qubit = 0) {
      const mask=1<<qubit, values=[];
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        let value=c(0);
        for(let other=0;other<this.dim;other++)if(!(other&mask))value=add(value,this.data[(other|(row<<qubit))*this.dim+(other|(col<<qubit))]);
        values.push(value);
      }
      return new Density(1,values);
    }
    joint(bases) {
      if(bases.length!==this.qubits)throw Error('One basis per qubit is required');
      const state=this.clone();
      bases.forEach((basis,qubit)=>{if(basis==='X')state.gate('H',qubit);else if(basis==='Y')state.gate('SDG',qubit).gate('H',qubit);else if(basis!=='Z')throw Error('Unknown basis');});
      return state.jointZ();
    }
    sampleZ(rng = Math.random) { const probs = this.jointZ(); let value = rng(); for (let i = 0; i < probs.length; i++) { value -= probs[i]; if (value < 0) return i; } return probs.length - 1; }
    purity() { let result = 0; for (let i = 0; i < this.dim; i++) for (let j = 0; j < this.dim; j++) result += mul(this.data[i * this.dim + j], this.data[j * this.dim + i]).re; return result; }
  }
  function experiment(name) {
    let coherent, mixture;
    if (name === 'link') {
      coherent = Density.bell(); mixture = coherent.clone().dephase('Z', 0);
      [coherent, mixture].forEach(state => state.gate('H', 0).gate('H', 1));
    } else {
      coherent = Density.pure([h, h]); mixture = coherent.clone().dephase('Z');
      [coherent, mixture].forEach(state => {
        if (name === 'phase') state.gate('Z');
        if (name === 'disturbance') state.dephase('Z');
        if (name === 'quarter') state.gate('S');
        if (name !== 'quarter') state.gate('H');
      });
    }
    return { coherent, mixture };
  }
  root.Quantum = { Density, transform, probabilities, BASES, GATES, experiment, norm };
})(typeof globalThis !== 'undefined' ? globalThis : window);
