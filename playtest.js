(() => {
  const $=id=>document.getElementById(id);$('consent').checked=PlaytestStore.enabled();
  function render(){const d=PlaytestStore.data;$('localCounts').textContent=`Stored locally: ${d.events.length} actions, ${d.transfer.length} unfamiliar-hand answers, ${d.surveys.length} self-reported responses. No verified participant count is inferred.`;}
  $('consent').addEventListener('change',e=>PlaytestStore.consent(e.target.checked));
  $('feedbackForm').addEventListener('submit',e=>{e.preventDefault();if(!PlaytestStore.enabled()){$('feedbackStatus').textContent='Please consent before saving a response.';return;}PlaytestStore.survey({clarity:Number($('clarity').value),fun:Number($('fun').value),replay:$('replay').value,confusion:$('confusion').value});$('feedbackStatus').textContent='Saved on this device. Nothing was uploaded.';render();});
  $('exportPlaytest').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(PlaytestStore.data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='quantum-holdem-local-playtest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('deletePlaytest').addEventListener('click',()=>{if(!confirm('Delete only this device’s playtest records? Learning-course logs are kept separately.'))return;PlaytestStore.reset();$('consent').checked=false;$('feedbackStatus').textContent='Local playtest records deleted; course logs were not changed.';render();});render();
})();
