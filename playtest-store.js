/* Opt-in, anonymous, device-local observations. No network submission. */
(function(root){
  'use strict';
  const key='quantum-holdem-playtest-v1';let data;
  try{data=JSON.parse(localStorage.getItem(key));}catch(_){}
  if(!data||data.version!==1||!Array.isArray(data.events))data={version:1,consent:false,events:[],surveys:[],transfer:[]};
  data.surveys||=[];data.transfer||=[];
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(data));}catch(_) {}};
  const enabled=()=>data.consent===true;
  function record(kind,detail){if(!enabled())return;data.events.push({at:new Date().toISOString(),kind,...detail});data.events=data.events.slice(-1500);save();}
  function consent(value){data.consent=!!value;if(value&&!data.sessionId)data.sessionId='local-'+Math.random().toString(36).slice(2,10);save();}
  function survey(value){if(!enabled())throw Error('Please consent before recording a local response');if(![1,2,3,4,5].includes(value.clarity)||![1,2,3,4,5].includes(value.fun)||!['Yes','Maybe','No'].includes(value.replay))throw Error('Invalid response');data.surveys.push({at:new Date().toISOString(),...value,source:root.__quantumTestRun?'automated regression, not a participant':'self-reported local playtest'});save();}
  function transfer(value){if(!enabled())return;data.transfer.push({at:new Date().toISOString(),...value});save();}
  function reset(){data={version:1,consent:false,events:[],surveys:[],transfer:[]};save();}
  root.PlaytestStore={enabled,consent,record,survey,transfer,reset,get data(){return JSON.parse(JSON.stringify(data));}};
})(globalThis);
