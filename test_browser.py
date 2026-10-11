"""Headless Edge integration checks, screenshots, and JS/Qiskit parity.

Uses the installed Edge browser and websocket-client, no browser downloads.
python test_browser.py
"""
import base64
import functools
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.request
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from qiskit_engine import tunable_probabilities, quantum_fixtures, replay_hand

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/_replay-hand?"):
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            trace = json.loads(query["data"][0])
            content = json.dumps({"steps": len(replay_hand(trace))}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        if self.path == "/_quantum-density-fixtures":
            content = json.dumps(quantum_fixtures()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        if self.path == '/_phase-fixtures':
            import math
            fixtures=[{'p':p,'phase':phase,'moves':moves,'expected':tunable_probabilities(p,moves=moves,phase=phase)} for p in (.08,.2,.5,.92) for phase in (0,math.pi,math.pi/2,-math.pi/2) for moves in ((),('H',),('Z','H'),('S','H'),('H','H'))]
            content=json.dumps(fixtures).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content);return
        if self.path == "/_quantum-fixtures":
            fixtures = [
                {"p": p, "flipped": flipped, "moves": moves,
                 "expected": tunable_probabilities(p, flipped, moves)}
                for p in (0.18, 0.35, 0.5, 0.82)
                for flipped in (False, True)
                for moves in ((), ("H",), ("Z",), ("Z", "H"), ("H", "H"))
            ]
            content = json.dumps(fixtures).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        super().do_GET()


class Browser:
    def __init__(self, url):
        import websocket
        self.socket = websocket.create_connection(url, suppress_origin=True, timeout=60)
        self.sequence = 0
        self.errors = []

    def command(self, method, params=None):
        self.sequence += 1
        identifier = self.sequence
        self.socket.send(json.dumps({"id": identifier, "method": method, "params": params or {}}))
        while True:
            event = json.loads(self.socket.recv())
            if event.get("method") == "Runtime.exceptionThrown":
                self.errors.append(event["params"])
            if event.get("id") == identifier:
                if "error" in event:
                    raise RuntimeError(event["error"])
                return event.get("result", {})

    def evaluate(self, expression):
        result = self.command("Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return result["result"].get("value")

    def screenshot(self, path, width, height, full_page=True):
        self.command("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
        self.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        self.evaluate("new Promise(resolve => setTimeout(resolve, 350))")
        metrics = self.command("Page.getLayoutMetrics")["cssContentSize"]
        capture={"format":"png","captureBeyondViewport":full_page}
        if full_page:
            capture['clip']={"x":0,"y":0,"width":width,"height":metrics['height'],"scale":1}
        result = self.command("Page.captureScreenshot",capture)
        path.write_bytes(base64.b64decode(result["data"]))
        return self.evaluate("({viewport: innerWidth, document: document.documentElement.scrollWidth})")


def main():
    import websocket
    edge = Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe"
    if not edge.exists():
        raise RuntimeError("Microsoft Edge was not found")
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    artifacts = ROOT / ".artifacts"
    artifacts.mkdir(exist_ok=True)
    browser = None
    with tempfile.TemporaryDirectory(prefix="quantum-holdem-edge-") as profile:
        startup = subprocess.STARTUPINFO()
        startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = subprocess.SW_HIDE
        process = subprocess.Popen([str(edge), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", f"--user-data-dir={profile}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, startupinfo=startup, creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            port_file = Path(profile) / "DevToolsActivePort"
            deadline = time.monotonic() + 25
            while not port_file.exists() and time.monotonic() < deadline:
                time.sleep(0.1)
            if not port_file.exists():
                raise RuntimeError("Headless Edge did not start")
            port = port_file.read_text().splitlines()[0]
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list") as response:
                page = next(page for page in json.load(response) if page["type"] == "page" and page["url"] == "about:blank")
            browser = Browser(page["webSocketDebuggerUrl"])
            browser.command("Runtime.enable")
            browser.command("Page.enable")
            browser.command('Page.addScriptToEvaluateOnNewDocument',{'source':'window.__quantumTestRun=true;'})
            browser.command("Page.navigate", {"url": base + "/index.html"})
            deadline = time.monotonic() + 15
            while not browser.evaluate("!!window.quantumGame") and time.monotonic() < deadline:
                time.sleep(0.1)
            assert browser.evaluate("!!window.quantumGame"), "Game failed to initialize"
            privacy = browser.evaluate("""(() => {
              const cards = document.getElementById('novaCards');
              if (cards.querySelectorAll('.card-back').length !== 2 || cards.querySelector('.card-rank')) throw Error('Nova card faces leak');
              if (document.querySelector('#linkDiagram .link-node:last-child strong').textContent !== 'Hidden') throw Error('Linked panel leaks before measurement');
              return {initialHandPrivacy: 'passed'};
            })()""")
            print(json.dumps(privacy), flush=True)
            settings=browser.evaluate("""(() => {
              document.getElementById('settingsButton').click();
              if(!document.getElementById('settingsDialog').open)throw Error('Settings dialog');
              const visibility=document.getElementById('novaVisibility');visibility.value='always';visibility.dispatchEvent(new Event('change'));
              if(document.getElementById('novaCards').querySelectorAll('.card-rank').length!==2)throw Error('Always-visible training mode');
              document.getElementById('inspectNova').click();
              if(!document.getElementById('stateDeskTitle').textContent.includes('Nova'))throw Error('Nova training state inspector');
              visibility.value='never';visibility.dispatchEvent(new Event('change'));
              if(document.getElementById('novaCards').querySelectorAll('.card-back').length!==2||!document.getElementById('inspectNova').hidden)throw Error('Never mode privacy');
              visibility.value='showdown';visibility.dispatchEvent(new Event('change'));document.getElementById('settingsDialog').close();
              return {visibilitySettings:'passed'};
            })()""")
            print(json.dumps(settings),flush=True)
            product=browser.evaluate("""(async()=>{for(const file of ['learning-hands.js','transfer-model.js','test_product.js']){(0,eval)(await fetch(file).then(r=>r.text()));}return productTestResults;})()""")
            print(json.dumps({'productRevision':product}),flush=True)
            modes=browser.evaluate("""(()=>{if(document.getElementById('advancedToggle').getAttribute('aria-expanded')!=='false')throw Error('Expected simple view');document.getElementById('advancedToggle').click();const basis=document.getElementById('measurementBasis');basis.value='X';basis.dispatchEvent(new Event('change'));document.getElementById('advancedToggle').click();if(basis.value!=='Z'||!basis.querySelector('[value=X]').disabled)throw Error('Simple view kept an advanced measurement');return {simpleAdvancedViews:'passed'};})()""")
            print(json.dumps(modes),flush=True)
            browser.evaluate("document.getElementById('advancedToggle').click();if(document.getElementById('advancedToggle').getAttribute('aria-expanded')!=='true')throw Error('Advanced controls did not open')")
            result = browser.evaluate("fetch('/test_game.js').then(r => r.text()).then(source => { (0, eval)(source); return gameTestResults; })")
            print(json.dumps(result), flush=True)
            parity = browser.evaluate("""fetch('/_quantum-fixtures').then(r => r.json()).then(fixtures => {
              for (const item of fixtures) {
                let wave = [Math.sqrt(item.p), (item.flipped ? -1 : 1) * Math.sqrt(1-item.p)];
                for (const move of item.moves) wave = QuantumHoldem.transform(wave, move);
                const actual = QuantumHoldem.probabilities(wave);
                if (actual.some((p, i) => Math.abs(p-item.expected[i]) > 1e-10)) throw Error('Qiskit parity mismatch');
              }
              return {qiskitParityCases: fixtures.length};
            })""")
            print(json.dumps(parity), flush=True)
            phase_parity=browser.evaluate("""fetch('/_phase-fixtures').then(r=>r.json()).then(cases=>{for(const c of cases){let wave=[Math.sqrt(c.p),{re:Math.sqrt(1-c.p)*Math.cos(c.phase),im:Math.sqrt(1-c.p)*Math.sin(c.phase)}];for(const gate of c.moves)wave=Quantum.transform(wave,gate);const actual=Quantum.probabilities(wave);if(actual.some((p,i)=>Math.abs(p-c.expected[i])>1e-9))throw Error('Complex preparation parity');}return {complexPreparationParityCases:cases.length};})""")
            print(json.dumps(phase_parity),flush=True)
            density = browser.evaluate("""fetch('/_quantum-density-fixtures').then(r => r.json()).then(fixtures => {
              for (const item of fixtures) {
                const state = item.preparation === 'bell' ? Quantum.Density.bell() : Quantum.Density.pure([Math.SQRT1_2,Math.SQRT1_2]);
                for (const event of item.events) {
                  if (event.gate) state.gate(event.gate,event.qubit||0);
                  else if ('outcome' in event) state.condition(event.basis,event.outcome,event.qubit||0);
                  else state.dephase(event.basis,event.qubit||0);
                }
                if (state.data.some((v,i) => Math.abs(v.re-item.expected[i][0]) > 1e-9 || Math.abs(v.im-item.expected[i][1]) > 1e-9)) throw Error('Complex density matrix parity mismatch');
              }
              return {complexDensityParityCases: fixtures.length};
            })""")
            print(json.dumps(density), flush=True)
            # This CPU-heavy soak is longer than UI interactions on slower hosts.
            browser.socket.settimeout(180)
            try:
                smoke=browser.evaluate("""fetch('smoke_game.js').then(r=>r.text()).then(source=>{(0,eval)(source);return smokeTestResults;})""")
            finally:
                browser.socket.settimeout(60)
            (artifacts/'smoke-results.json').write_text(json.dumps(smoke,indent=2),encoding='utf-8')
            print(json.dumps({'multiPolicySmoke':smoke}),flush=True)
            desktop = browser.screenshot(artifacts / "desktop.png", 1440, 1080)
            assert desktop["document"] <= desktop["viewport"], f"Desktop overflow: {desktop}"
            interaction = browser.evaluate("""(async () => {
              const g = quantumGame;
              document.getElementById('interfereButton').click();
              if (g.moves.you !== 1) throw Error('Interference button failed');
              if(!document.getElementById('stateDesk').querySelector('.state-transition')||!document.getElementById('stateDesk').textContent.includes('Mix amplitudes'))throw Error('No visible H state change');
              document.querySelector('[data-lock="1"]').click();
              if (g.moves.you !== 0 || !g.cards.you[1].locked) throw Error('Linked lock failed');
              if (!document.getElementById('interfereButton').disabled) throw Error('Budget not enforced in UI');
              if (!document.getElementById('linkHint').textContent.includes('You earned')) throw Error('Link inference not displayed');
              const linked = g.cards.you[1];
              const expectedBit=1-linked.readout.outcome;
              const expectedFace=QuantumHoldem.candidateLabel(g.cards.you[1],expectedBit);
              if (document.querySelector('#linkDiagram .link-node:last-child strong').textContent !== expectedFace+' · inferred') throw Error('Linked panel shows wrong earned face');
              if (document.getElementById('novaCards').querySelectorAll('.card-back').length !== 2) throw Error('Measurement reveals Nova card face');
              document.getElementById('rulesButton').click();
              if (!document.getElementById('rulesDialog').open) throw Error('Rules dialog failed');
              document.getElementById('rulesDialog').close();
              let steps=0;
              while (!g.over && steps++ < 24) {
                if (g.turn === 'you') document.getElementById('checkCallButton').click();
                await new Promise(resolve => setTimeout(resolve, 650));
              }
              if (!g.over || document.getElementById('handResult').hidden) throw Error('Hand failed to finish');
              if (g.stacks.you + g.stacks.nova !== 2000) throw Error('Chips not conserved');
              if (!g.showdown || document.getElementById('novaCards').querySelectorAll('.card-rank').length !== 2 || document.getElementById('novaCards').querySelector('.card-back')) throw Error('Showdown did not reveal Nova cards');
              return {uiInteraction: 'passed', bettingSteps: steps};
            })()""")
            print(json.dumps(interaction), flush=True)
            browser.screenshot(artifacts / "showdown.png", 1440, 1080)
            never=browser.evaluate("""(() => {
              const visibility=document.getElementById('novaVisibility');visibility.value='never';visibility.dispatchEvent(new Event('change'));
              if(document.getElementById('novaCards').querySelectorAll('.card-back').length!==2||!document.getElementById('exportHandButton').hidden)throw Error('Never mode revealed showdown cards');
              visibility.value='showdown';visibility.dispatchEvent(new Event('change'));
              if(document.getElementById('novaCards').querySelectorAll('.card-rank').length!==2)throw Error('Showdown setting');
              return {neverAtShowdown:'passed'};
            })()""")
            print(json.dumps(never),flush=True)
            replay=browser.evaluate("""fetch('/_replay-hand?data='+encodeURIComponent(JSON.stringify({initialQuantum:quantumGame.initialQuantum,quantumEvents:quantumGame.quantumEvents}))).then(r=>r.json()).then(result=>({actualHandQiskitReplay:result.steps}))""")
            print(json.dumps(replay),flush=True)
            browser.evaluate("""(() => {
              const g = quantumGame, firstHand = g.hand;
              document.getElementById('nextButton').click();
              if (g.hand !== firstHand+1 || g.moves.you !== 2) throw Error('Next hand failed');
              document.querySelector('[data-lock="0"]').click();
              if (!g.cards.you[0].locked || !document.getElementById('interfereButton').disabled) throw Error('Lock/tuning UI failed');
            })()""")
            mobile = browser.screenshot(artifacts / "mobile.png", 390, 844)
            assert mobile["document"] <= mobile["viewport"], f"Mobile overflow: {mobile}"
            tiny = browser.screenshot(artifacts / "small-mobile.png", 320, 740)
            assert tiny["document"] <= tiny["viewport"], f"Small mobile overflow: {tiny}"
            betting = browser.evaluate("""(async () => {
              const g = quantumGame;
              const slider = document.getElementById('betSize');
              slider.value = Math.min(g.maxBet, 40);
              slider.dispatchEvent(new Event('input'));
              const target = Number(slider.value);
              if (!document.getElementById('betButton').textContent.includes(String(target))) throw Error('Bet label did not update');
              document.getElementById('betButton').click();
              if (g.bets.you !== target || g.turn !== 'nova') throw Error('Bet control failed');
              let steps = 0;
              while (!g.over && steps++ < 24) {
                await new Promise(resolve => setTimeout(resolve, 650));
                if (g.turn === 'you') document.getElementById('checkCallButton').click();
              }
              if (!g.over) throw Error('Bet hand failed to finish');
              if (g.stacks.you+g.stacks.nova !== 2000) throw Error('Bet hand chip conservation');
              document.getElementById('nextButton').click();
              const quick = document.querySelector('[data-interfere]');
              if (getComputedStyle(quick).display === 'none') throw Error('Mobile interference missing');
              quick.click();
              if (g.moves.you !== 1) throw Error('Mobile interference failed');
              document.getElementById('foldButton').click();
              if (!g.over || !g.result.folded || g.result.winner !== 'nova') throw Error('Fold control failed');
              if (document.getElementById('novaCards').querySelectorAll('.card-back').length !== 2) throw Error('Fold reveals Nova cards');
              document.getElementById('nextButton').click();
              const wave = g.cards.you[0].wave.slice();
              const expected = document.getElementById('phasePreview').textContent.replace('Then interfere:', 'After:');
              document.getElementById('phaseButton').click();
              if (g.moves.you !== 1 || Math.abs(Quantum.probabilities(g.cards.you[0].wave)[0]-Quantum.probabilities(wave)[0]) > 1e-10) throw Error('Phase changed current face odds');
              if (document.getElementById('interferePreview').textContent !== expected) throw Error('Phase preview did not match next interference');
              document.getElementById('interfereButton').click();
              if (g.moves.you !== 0) throw Error('Phase + interference budget');
              return {bettingButtons: 'passed', mobileInterference: 'passed', foldPrivacy: 'passed', phasePreview: 'passed'};
            })()""")
            print(json.dumps(betting), flush=True)
            measurements = browser.evaluate("""(() => {
              const g=quantumGame;
              document.getElementById('foldButton').click(); document.getElementById('nextButton').click();
              const before=g.cardOdds('you',0)[0];
              document.getElementById('quarterPhaseButton').click();
              if(Math.abs(g.cardOdds('you',0)[0]-before)>1e-9)throw Error('S changed Z probabilities');
              if(!document.getElementById('stateDesk').textContent.includes('90°')&&!document.getElementById('stateDesk').textContent.includes('90'))throw Error('No quarter-phase explanation');
              const basis=document.getElementById('measurementBasis');basis.value='Y';basis.dispatchEvent(new Event('change'));
              document.querySelector('[data-lock="0"]').click();
              if(g.cards.you[0].locked||g.cards.you[0].readout.basis!=='Y'||g.cards.you[0].suit!==null)throw Error('Y readout mislabeled as exact suit');
              if(Math.abs(g.cardOdds('you',0)[0]-0.5)>1e-9)throw Error('Y post-measurement state');
              window.yReadoutTrace={initialQuantum:g.initialQuantum,quantumEvents:JSON.parse(JSON.stringify(g.quantumEvents))};
              document.getElementById('foldButton').click();document.getElementById('nextButton').click();
              basis.value='X';basis.dispatchEvent(new Event('change'));document.querySelector('[data-lock="1"]').click();
              if(g.cards.you[1].locked||g.cards.you[1].readout.basis!=='X')throw Error('Linked X readout');
              document.getElementById('linkInterfereButton').click();
              if(Math.max(...g.cardOdds('you',1))<1-1e-9)throw Error('Linked X then H');
              if(document.getElementById('novaCards').querySelectorAll('.card-back').length!==2)throw Error('Quantum control leaked Nova');
              return {basisControls:'passed',quarterPhase:'passed',linkedInterference:'passed'};
            })()""")
            print(json.dumps(measurements), flush=True)
            extra_replays=browser.evaluate("""Promise.all([yReadoutTrace,{initialQuantum:quantumGame.initialQuantum,quantumEvents:quantumGame.quantumEvents}].map(trace=>fetch('/_replay-hand?data='+encodeURIComponent(JSON.stringify(trace))).then(r=>r.json()))).then(results=>({complexReadoutHandReplays:results.map(r=>r.steps)}))""")
            print(json.dumps(extra_replays),flush=True)
            control_smoke=browser.evaluate("""(()=>{
              let count=0;const fresh=()=>{if(!quantumGame.over)document.getElementById('foldButton').click();document.getElementById('nextButton').click();if(quantumGame.matchOver){quantumGame.reset();const v=document.getElementById('novaVisibility');v.dispatchEvent(new Event('change'));}};
              for(const [id,gate,index] of [['interfereButton','H',0],['phaseButton','Z',0],['quarterPhaseButton','S',0],['linkInterfereButton','H',1],['linkPhaseButton','Z',1],['linkQuarterPhaseButton','S',1]]){
                fresh();document.getElementById(id).click();const e=quantumGame.quantumEvents[0];
                if(!e||e.action!==gate||e.index!==index||quantumGame.moves.you!==1)throw Error('Control smoke: '+id);
                if(!document.querySelector('#stateDesk .state-transition'))throw Error('Control smoke: missing state change');count++;
              }
              for(const basis of ['Z','X','Y'])for(const index of [0,1]){
                fresh();const select=document.getElementById('measurementBasis');select.value=basis;select.dispatchEvent(new Event('change'));
                document.querySelector('[data-lock="'+index+'"]').click();const c=quantumGame.cards.you[index];
                if(!c.readout||c.readout.basis!==basis||c.locked!==(basis==='Z')||(basis!=='Z'&&c.rank!==null))throw Error('Measurement control smoke: '+basis+index);count++;
              }
              return {gateAndMeasurementControls:count};
            })()""")
            print(json.dumps(control_smoke),flush=True)
            layout_reports=[]
            for width,height in [(1440,900),(1366,768),(1024,768),(390,844),(320,740)]:
                browser.command('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
                layout=browser.evaluate("""(async()=>{
                  const g=quantumGame;
                  if(!g.over)document.getElementById('foldButton').click();
                  document.getElementById('nextButton').click();window.scrollTo(0,0);
                  document.getElementById('linkInterfereButton').click();
                  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                  const panel=document.getElementById('statePanel'),views=[...document.querySelectorAll('#stateDesk .state-card-view')];
                  if(views.length!==2)throw Error('Layout: no before/after');
                  if(innerWidth<1180&&!panel.classList.contains('state-peek'))throw Error('Layout: small-screen state did not open');
                  const cells=[...document.querySelectorAll('#stateDesk .amplitude-cell')].map(c=>c.getBoundingClientRect());
                  if(cells.length!==8||cells.some(r=>r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth))throw Error('Layout: before/after linked branches require scrolling '+JSON.stringify(cells.map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}))));
                  if(document.documentElement.scrollWidth>innerWidth)throw Error('Layout: horizontal overflow');
                  if(innerWidth<1180){
                    const close=document.getElementById('closeStateDesk'),r=close.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                    if(!close.contains(hit))throw Error('Layout: close control blocked');
                    close.click();if(panel.classList.contains('state-peek'))throw Error('Layout: close failed');
                    document.getElementById('openStateDesk').click();if(!panel.classList.contains('state-peek'))throw Error('Layout: reopen failed');
                    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));if(panel.classList.contains('state-peek'))throw Error('Layout: Escape failed');
                  }
                  return {width:innerWidth,height:innerHeight,beforeAfterVisible:true,scrollY};
                })()""")
                layout_reports.append(layout)
                if width<1180:
                    browser.evaluate("document.getElementById('openStateDesk').click()")
                browser.screenshot(artifacts/f'state-{width}x{height}.png',width,height,full_page=False)
            print(json.dumps({'stateViewportSmoke':layout_reports}),flush=True)
            browser.screenshot(artifacts / "hand-result.png", 1440, 1080)
            browser.evaluate("localStorage.setItem('quantum-holdem-learning-v2',JSON.stringify({legacy:'keep'}))")
            browser.command("Page.navigate", {"url":base+"/learn.html"})
            deadline=time.monotonic()+10
            while not browser.evaluate("!!window.quantumLearning") and time.monotonic()<deadline:
                time.sleep(0.1)
            learning_rules=browser.evaluate("""fetch('test_learning.js').then(r=>r.text()).then(source=>{(0,eval)(source);return learningTestResults;})""")
            print(json.dumps({'fullFaceLearningRules':learning_rules}),flush=True)
            learning=browser.evaluate("""(() => {
              if(document.getElementById('guideView').hidden)throw Error('Effects guide is not the default learning entry');
              for(const gate of ['H','Z','S','MZ','MX','MY','LH','LZ','LS']){
                document.querySelector('[data-guide="'+gate+'"]').click();document.getElementById('guideApply').click();
                if(document.getElementById('guideVisual').querySelectorAll('.state-card-view').length!==2)throw Error('Guide has no before/after state');
                if(gate==='S'&&!document.getElementById('guideVisual').innerHTML.includes('phase 90 degrees'))throw Error('Quarter phase arrows');
                if(gate==='LH'&&document.getElementById('guideVisual').querySelectorAll('.four-amplitudes').length!==2)throw Error('Linked-state amplitudes missing');
                if(gate==='MZ'&&!document.getElementById('guideFollow').hidden)throw Error('Guide allowed tuning a committed face');
                if(!document.getElementById('guideVisual').textContent.includes('A♥')||!document.getElementById('guideVisual').textContent.includes('K♠'))throw Error('Guide uses old suit-only labels');
              }
              document.getElementById('challengeTab').click();
              document.getElementById('resetLearning').click();
              const answers=[1,0,0], reflections=[1,0,1];
              for(let i=0;i<3;i++){
                document.querySelector('[data-lesson="'+i+'"]').click();
                document.querySelector('[data-predict="'+answers[i]+'"]').click();
                document.querySelector('[data-play="'+['H','Y','X'][i]+'"]').click();
                const before=quantumLearning.stepCount;
                if(before!==1)throw Error('Challenge skipped directly to the outcome');
                let guard=0;
                while(!document.getElementById('lessonStepNext').hidden&&guard++<8){
                  const old=quantumLearning.stepCount;document.getElementById('lessonStepNext').click();
                  if(quantumLearning.stepCount!==old+1)throw Error('Not one operation per step');
                  if(!document.getElementById('lessonVisual').querySelector('.state-transition'))throw Error('Missing intermediate state view');
                }
                if(!document.getElementById('lessonObservation').textContent)throw Error('No experiment feedback');
                document.querySelector('[data-reflect="'+reflections[i]+'"]').click();
              }
              const session=quantumLearning.session;
              if(session.attempts.length!==3||session.attempts[0].beforeCorrect!==false||!session.attempts.every(a=>a.afterCorrect))throw Error('Learning assessment records');
              if(!document.getElementById('courseProgress').textContent.includes('3 / 3'))throw Error('Learning progress');
              if(Math.abs(session.attempts[1].result.chance-0.5)>1e-9)throw Error('Y inspection did not disturb lesson');
              if(Math.max(...session.attempts[2].result.rival)<1-1e-9)throw Error('X did not infer mixed rival');
              document.getElementById('labTab').click();
              document.getElementById('labTab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
              if(document.getElementById('challengeTab').getAttribute('aria-selected')!=='true')throw Error('Tab keyboard navigation');
              document.getElementById('labTab').click();
              for(const name of ['interference','phase','disturbance','link','quarter']){
                document.querySelector('[data-experiment="'+name+'"]').click();
                if(!document.getElementById('experimentExplanation').textContent)throw Error('No lab explanation');
                if(document.getElementById('labSteps').children.length!==1)throw Error('Experiment skipped preparation');
                const expected=LearningHands.experimentFrames(name);let steps=0;
                const bars=id=>[...document.querySelectorAll('#'+id+' .lab-bar-fill')].map(b=>parseFloat(b.style.width)/100);
                const check=()=>{const ref=expected[steps];for(const [id,state] of [['coherentPlot',ref.coherent],['mixturePlot',ref.mixture]]){const values=name==='quarter'?state.distribution('Y'):state.jointZ();if(bars(id).some((p,i)=>Math.abs(p-values[i])>1e-9))throw Error('Wrong stepped lab distribution '+name+steps);if(!document.querySelector('#'+id+' .amplitude-grid'))throw Error('Lab has no visible current state');}};
                check();
                while(!document.getElementById('labNext').hidden&&steps<5){document.getElementById('labNext').click();steps++;check();}
                if(steps!==expected.length-1)throw Error('Incorrect experiment operation count');
                document.querySelector('[data-lab-step="0"]').click();if(!document.getElementById('labStage').textContent.includes('Step 0'))throw Error('Lab history cannot be revisited');
                document.querySelector('[data-lab-step="'+steps+'"]').click();
              }
              return {effectsGuide:'passed',stepwiseChallenges:'passed',localAssessment:'passed',coherenceLab:'passed'};
            })()""")
            print(json.dumps(learning),flush=True)
            routes=browser.evaluate("""(()=>{
              document.getElementById('challengeTab').click();let count=0;
              for(const [lesson,route] of [[0,'H'],[0,'Z'],[1,'X'],[1,'Y'],[2,'Z'],[2,'H'],[2,'NZ'],[2,'X']]){
                document.querySelector('[data-lesson="'+lesson+'"]').click();
                if(!document.getElementById('lessonCards').textContent.includes('A♥')||!document.getElementById('lessonCards').textContent.includes('K♠'))throw Error('Challenge still has old candidates');
                document.querySelector('[data-play="'+route+'"]').click();let guard=0;
                while(!document.getElementById('lessonStepNext').hidden&&guard++<8){
                  document.getElementById('lessonStepNext').click();
                  if(lesson===2&&!document.getElementById('lessonStepNext').hidden&&document.querySelectorAll('#lessonCards .back').length!==1)throw Error('Linked face revealed before verification');
                }
                const attempt=quantumLearning.session.attempts.at(-1);
                if(!attempt||attempt.action!==route||attempt.encoding!=='two-complete-faces')throw Error('Route not recorded');
                if(attempt.steps.some(s=>s.moves.you<0||s.moves.nova<0))throw Error('Teaching route exceeds budget');
                const costs=attempt.steps.filter(s=>s.actor==='You').reduce((sum,s)=>sum+s.cost,0);if(costs>2)throw Error('Too many player moves');
                if(lesson===0&&route==='H'&&Math.abs(attempt.result.chance-1)>1e-9)throw Error('Rank-pair H challenge scoring');
                if(lesson===2&&route==='H'&&Math.abs(attempt.result.chance-0.75)>1e-9)throw Error('Correlation-driven poker payoff');
                if(lesson===2&&route==='Z'&&Math.max(...attempt.result.rival)<1-1e-9)throw Error('Intact link should infer the opposite face');
                if(lesson===2&&route==='NZ'&&Math.abs(attempt.result.rival[0]-0.5)>1e-9)throw Error('Broken link should not infer a rival face from Z');
                if(lesson===2&&route==='X'&&attempt.result.finalWinChance<1-1e-9)throw Error('Linked phase tuning payoff incorrect');
                count++;
              }
              if(quantumLearning.session.version!==3||JSON.parse(localStorage.getItem('quantum-holdem-learning-v2')).legacy!=='keep')throw Error('Old learning logs were lost or mixed into v3');
              return {fullFaceRoutes:count,moveBudgets:'passed',linkedRevealPrivacy:'passed',legacyLogsPreserved:'passed'};
            })()""")
            print(json.dumps(routes),flush=True)
            browser.command('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
            learning_mobile_flow=browser.evaluate("""(()=>{
              document.querySelector('[data-lesson="2"]').click();document.querySelector('[data-play="X"]').click();
              const panel=document.querySelector('.lesson-visual-panel'),button=document.getElementById('lessonStepNext');
              if(!panel.contains(button)||Math.abs(panel.getBoundingClientRect().top)>2)throw Error('Mobile lesson controls are detached from the state');
              const before=quantumLearning.stepCount;button.click();
              if(quantumLearning.stepCount!==before+1||!document.querySelector('#lessonVisual .state-transition'))throw Error('Mobile step application failed');
              const rect=button.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
              if(!button.contains(hit))throw Error('Mobile next operation is blocked');
              return {mobileOperationBesideState:'passed'};
            })()""")
            print(json.dumps(learning_mobile_flow),flush=True)
            browser.screenshot(artifacts/'learning-mobile-step.png',390,844,full_page=False)
            browser.evaluate("while(!document.getElementById('lessonStepNext').hidden)document.getElementById('lessonStepNext').click()")
            browser.command('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1080,'deviceScaleFactor':1,'mobile':False})
            browser.evaluate("document.getElementById('labTab').click()")
            browser.screenshot(artifacts/"lab-desktop.png",1440,1080)
            browser.evaluate("document.getElementById('guideTab').click();document.querySelector('[data-guide=\"LS\"]').click();document.getElementById('guideApply').click()")
            browser.screenshot(artifacts/"guide-linked-phase.png",1440,1080)
            guide_mobile=browser.screenshot(artifacts/"guide-mobile.png",390,844)
            assert guide_mobile["document"]<=guide_mobile["viewport"],guide_mobile
            browser.evaluate("document.getElementById('challengeTab').click()")
            browser.evaluate("document.querySelector('[data-state-step=\"3\"]').click()")
            browser.screenshot(artifacts/"challenge-linked-tuning.png",1440,1080)
            learn_mobile=browser.screenshot(artifacts/"learn-mobile.png",390,844)
            assert learn_mobile["document"]<=learn_mobile["viewport"],learn_mobile
            learn_tiny=browser.screenshot(artifacts/"learn-small-mobile.png",320,740)
            assert learn_tiny["document"]<=learn_tiny["viewport"],learn_tiny
            browser.command('Page.navigate',{'url':base+'/transfer.html'})
            deadline=time.monotonic()+12
            while not browser.evaluate('!!window.quantumTransfer') and time.monotonic()<deadline:time.sleep(.1)
            transfer_ui=browser.evaluate("""(()=>{
              if(document.getElementById('transferFeedback').textContent||!document.getElementById('transferNext').disabled)throw Error('Transfer answer exposed before response');
              const correct=quantumTransfer.exercise.correct;document.querySelector('[data-answer="'+correct+'"]').click();
              if(!document.getElementById('transferFeedback').textContent.startsWith('Correct.')||!document.querySelector('#transferVisual .state-transition'))throw Error('Transfer feedback missing');
              if(PlaytestStore.data.transfer.length)throw Error('Transfer recorded without consent');
              document.getElementById('transferNext').click();if(document.getElementById('transferFeedback').textContent)throw Error('New question kept old answer');
              return {transferUI:'passed',consentPrivacy:'passed'};
            })()""")
            print(json.dumps(transfer_ui),flush=True)
            transfer_mobile=browser.screenshot(artifacts/'transfer-mobile.png',320,740)
            assert transfer_mobile['document']<=transfer_mobile['viewport'],transfer_mobile
            browser.command('Page.navigate',{'url':base+'/playtest.html'})
            deadline=time.monotonic()+12
            while not browser.evaluate("!!document.getElementById('feedbackForm')&&!!window.PlaytestStore") and time.monotonic()<deadline:time.sleep(.1)
            survey_ui=browser.evaluate("""(()=>{
              const form=document.getElementById('feedbackForm');document.getElementById('clarity').value='4';document.getElementById('fun').value='3';document.getElementById('replay').value='Maybe';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              if(PlaytestStore.data.surveys.length)throw Error('Survey saved without consent');
              const consent=document.getElementById('consent');consent.checked=true;consent.dispatchEvent(new Event('change'));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
              if(PlaytestStore.data.surveys.length!==1||!document.getElementById('feedbackStatus').textContent.includes('Nothing was uploaded'))throw Error('Local survey failed');
              if(!document.getElementById('localCounts').textContent.includes('No verified participant count'))throw Error('Survey claims validated participants');if(!PlaytestStore.data.surveys[0].source.includes('automated'))throw Error('Test response mistaken for participant');PlaytestStore.reset();
              return {localSurveyUI:'passed',noParticipantClaim:'passed'};
            })()""")
            print(json.dumps(survey_ui),flush=True)
            survey_mobile=browser.screenshot(artifacts/'playtest-mobile.png',320,740)
            assert survey_mobile['document']<=survey_mobile['viewport'],survey_mobile
            assert not browser.errors, browser.errors
            print("Browser checks passed; desktop/mobile screenshots saved to .artifacts", flush=True)
        finally:
            if browser:
                browser.socket.close()
            # Close the browser gracefully so its temporary profile can be reclaimed.
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version") as response:
                    browser_info = json.load(response)
                control = websocket.create_connection(browser_info["webSocketDebuggerUrl"], suppress_origin=True, timeout=5)
                control.send(json.dumps({"id": 1, "method": "Browser.close"}))
                control.close()
            except Exception:
                process.terminate()
            process.wait(timeout=15)
            server.shutdown()


if __name__ == "__main__":
    main()
