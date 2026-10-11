"""Agent reviewer acceptance pass: native mouse/touch/keyboard, packaged project subpath.

This is not a human participant or an enjoyment/learning study.
"""
import functools
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.request
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import websocket
from test_browser import Browser, ROOT

class PackagedHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if not self.path.startswith('/quantum-holdem/'):
            self.send_error(404);return
        self.path=self.path[len('/quantum-holdem'):]
        super().do_GET()

def main():
    results=[];browser=None
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive',type=Path,default=ROOT/'.artifacts/release-submission-v2/quantum-holdem-site.zip')
    parser.add_argument('--inspect-qollab',action='store_true',help='Also read public platform documentation; never logs in or submits')
    args=parser.parse_args();archive=args.archive.resolve()
    with tempfile.TemporaryDirectory(prefix='quantum-acceptance-') as temporary:
        site=Path(temporary)/'site';site.mkdir()
        with zipfile.ZipFile(archive) as zipped:
            for name in zipped.namelist():
                if name.startswith('/') or '..' in Path(name).parts:raise RuntimeError('Unsafe packaged path')
            zipped.extractall(site)
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(PackagedHandler,directory=str(site)))
        threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/quantum-holdem/'
        profile=Path(temporary)/'profile'
        edge=Path(os.environ.get('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe'
        startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=subprocess.SW_HIDE
        process=subprocess.Popen([str(edge),'--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            port_file=profile/'DevToolsActivePort';deadline=time.monotonic()+25
            while not port_file.exists() and time.monotonic()<deadline:time.sleep(.1)
            if not port_file.exists():raise RuntimeError('Edge did not start')
            port=port_file.read_text().splitlines()[0]
            # Edge can briefly expose a closing sync-confirmation dialog first.
            # Attach only to the about:blank tab requested by this test process.
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list') as response:page=next(p for p in json.load(response) if p['type']=='page' and p['url']=='about:blank')
            browser=Browser(page['webSocketDebuggerUrl']);browser.command('Runtime.enable');browser.command('Page.enable');browser.command('Page.addScriptToEvaluateOnNewDocument',{'source':'window.__quantumTestRun=true;'})
            def viewport(width,height,mobile=False):browser.command('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':mobile})
            def check(expression,message):
                if not browser.evaluate(expression):raise AssertionError(message)
            def wait(expression):
                deadline=time.monotonic()+20
                while not browser.evaluate(expression) and time.monotonic()<deadline:time.sleep(.1)
                check(expression,'Timed out: '+expression)
            def navigate(path,ready):browser.command('Page.navigate',{'url':base+path});wait(ready)
            def press(key,code):
                for kind in ['keyDown','keyUp']:
                    params={'type':kind,'key':key,'windowsVirtualKeyCode':code,'nativeVirtualKeyCode':code}
                    if key=='Enter' and kind=='keyDown':params.update(text='\r',unmodifiedText='\r',code='Enter')
                    browser.command('Input.dispatchKeyEvent',params)
            def click(selector,touch=False):
                target=browser.evaluate("(()=>{const e=document.querySelector("+json.dumps(selector)+");if(!e||e.disabled||getComputedStyle(e).display==='none')throw Error('Inaccessible control '+"+json.dumps(selector)+");e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);if(!e.contains(hit))throw Error('Control is covered '+"+json.dumps(selector)+");return{x,y};})()")
                if touch:
                    browser.command('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[target]});browser.command('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                else:
                    browser.command('Input.dispatchMouseEvent',{'type':'mouseMoved',**target});browser.command('Input.dispatchMouseEvent',{'type':'mousePressed','button':'left','clickCount':1,**target});browser.command('Input.dispatchMouseEvent',{'type':'mouseReleased','button':'left','clickCount':1,**target})
            viewport(1366,768);navigate('index.html','!!window.quantumGame')
            check("document.querySelectorAll('#novaCards .card-back').length===2",'Fresh packaged match leaks Nova')
            click('#rulesButton');check("document.getElementById('rulesDialog').open&&!!document.querySelector('.poker-primer')",'Poker primer inaccessible');press('Escape',27)
            click('#advancedToggle');click('#measurementBasis');press('Home',36);press('ArrowDown',40);press('Enter',13)
            check("document.getElementById('measurementBasis').value==='X'",'Native measurement selection failed')
            click('#advancedToggle');check("document.getElementById('measurementBasis').value==='Z'",'Simple view does not restore Z')
            click('#interfereButton');check("quantumGame.moves.you===1&&!!document.querySelector('#stateDesk .state-transition')",'Native H does not update state')
            click('[data-lock="1"]');check("quantumGame.moves.you===0&&quantumGame.cards.you[1].locked",'Native linked Z failed')
            check("document.querySelectorAll('#novaCards .card-back').length===2",'Linked inference reveals actual Nova cards')
            results.append({'scenario':'Newcomer: primer, native control selection, H, linked Z and budget','passed':True})
            turns=0
            while not browser.evaluate('quantumGame.over') and turns<24:
                wait("quantumGame.over||quantumGame.turn==='you'")
                if browser.evaluate('quantumGame.over'):break
                # Keyboard activation, not a programmatic click or hidden game-state policy.
                browser.evaluate("document.getElementById('checkCallButton').focus()")
                press('Enter',13);turns+=1
            check("quantumGame.over&&quantumGame.showdown&&quantumGame.stacks.you+quantumGame.stacks.nova===2000",'Keyboard check/call hand did not complete: '+str(browser.evaluate("({turn:quantumGame.turn,street:quantumGame.street,focus:document.activeElement.id,history:quantumGame.history.slice(-3)})")))
            click('#handReview summary');check("document.getElementById('handReview').open&&document.getElementById('handReview').textContent.includes('Forecasts explain')",'Decision review unavailable')
            check("document.querySelectorAll('#novaCards .card-back').length===0",'Default showdown did not reveal cards')
            results.append({'scenario':'Keyboard betting, real AI turns, showdown and decision review','turns':turns,'passed':True})
            click('#nextButton');viewport(390,844,True);click('[data-interfere="0"]',True)
            check("document.getElementById('statePanel').classList.contains('state-peek')",'Mobile state view did not open')
            check("[...document.querySelectorAll('#stateDesk .amplitude-cell')].every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})",'Mobile state requires scrolling')
            click('#closeStateDesk',True);check("!document.getElementById('statePanel').classList.contains('state-peek')",'Touch close failed')
            click('#allInButton',True);click('#betButton',True);wait("quantumGame.over||quantumGame.turn==='you'")
            if not browser.evaluate('quantumGame.over'):click('#checkCallButton',True);wait('quantumGame.over')
            check("quantumGame.stacks.you+quantumGame.stacks.nova===2000",'Native all-in lost chips')
            results.append({'scenario':'Phone touch: quantum action, visible state, close and all-in resolution','passed':True})
            navigate('learn.html','!!window.quantumLearning');click('#challengeTab',True);click('[data-lesson="2"]',True);click('[data-play="X"]',True)
            for step in range(5):
                click('#lessonStepNext',True)
                if step<4:check("document.querySelectorAll('#lessonCards .back').length===1",'Lesson revealed Nova before verification')
            check("!document.getElementById('reflection').hidden",'Native tutorial route did not complete')
            results.append({'scenario':'Phone guided link: five native steps and delayed rival verification','passed':True})
            navigate('transfer.html','!!window.quantumTransfer');check("document.getElementById('transferFeedback').textContent===''",'Unfamiliar answer is already exposed');click('[data-answer="0"]',True)
            check("!!document.querySelector('#transferVisual .state-transition')&&!document.getElementById('transferNext').disabled",'Native unfamiliar answer feedback failed')
            check("PlaytestStore.data.transfer.length===0",'Recorded prediction without consent')
            navigate('playtest.html',"!!window.PlaytestStore&&!!document.getElementById('feedbackForm')");check("!document.getElementById('consent').checked&&PlaytestStore.data.surveys.length===0",'Feedback does not start private/empty')
            check("document.documentElement.scrollWidth<=innerWidth",'Packaged phone page overflows')
            results.append({'scenario':'Unfamiliar response, privacy and packaged local feedback','passed':True})
            public=None
            if args.inspect_qollab:
                viewport(1366,768);browser.command('Page.navigate',{'url':'https://qollab.xyz/programs/hackathon/terms'})
                time.sleep(2)
                public=browser.evaluate("({url:location.href,title:document.title,text:document.body?document.body.innerText.slice(0,24000):''})")
                (ROOT/'.artifacts/qollab-public-inspection.json').write_text(json.dumps(public,indent=2),encoding='utf-8')
                pages=[]
                for url in ['https://qollab.xyz/learn/building-your-first-qollab-project/create-project','https://qollab.xyz/learn/building-your-first-qollab-project/bring-your-own-code','https://qollab.xyz/learn/docs/python-qiskit-projects','https://qollab.xyz/learn/docs/publish','https://qollab.xyz/learn/docs/runtime-environment']:
                    browser.command('Page.navigate',{'url':url});time.sleep(1.5)
                    pages.append(browser.evaluate("({url:location.href,title:document.title,text:document.body?document.body.innerText.split('\\n').filter(s=>!s.trim()||((s.match(/[a-zA-Z]/g)||[]).length>Math.min(5,s.length*.3)&&s.length<900)).join('\\n').slice(0,55000):'',links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim().slice(0,90),href:a.href})).filter(a=>a.text)})"))
                (ROOT/'.artifacts/qollab-workflow-inspection.json').write_text(json.dumps(pages,indent=2),encoding='utf-8')
            report={'date':'2026-10-11','reviewer':'AI agent using native browser input','human_participant':False,'publicly_published':False,'archive':str(archive),'packaged_project_subpath':True,'scenarios':results,'browser_exceptions':browser.errors,'qollab_public_page_observed':public['title'] if public else None}
            (ROOT/'.artifacts/acceptance-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2),flush=True)
            if browser.errors:raise AssertionError('Uncaught browser errors')
        finally:
            if browser:
                try:browser.command('Browser.close')
                except Exception:pass
                browser.socket.close()
            if process.poll() is None:process.terminate()
            process.wait(timeout=15);server.shutdown()

if __name__=='__main__':main()
