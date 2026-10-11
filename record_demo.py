"""Record a captioned, scripted walkthrough of the actual local interface (150s)."""
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
from http.server import ThreadingHTTPServer
import cv2
import numpy as np
import websocket
from test_browser import Browser, Handler, ROOT

def main():
    output=ROOT/'.artifacts'/'quantum-holdem-walkthrough.mp4'
    if output.exists():raise SystemExit('Walkthrough already exists; retain it or choose a new output name before rerecording.')
    output.parent.mkdir(exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
    edge=Path(os.environ.get('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe'
    writer=cv2.VideoWriter(str(output),cv2.VideoWriter_fourcc(*'mp4v'),2,(1440,900))
    if not writer.isOpened():raise RuntimeError('MP4 encoder unavailable; no video completion is claimed')
    browser=None
    with tempfile.TemporaryDirectory(prefix='quantum-demo-edge-') as profile:
        startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=subprocess.SW_HIDE
        process=subprocess.Popen([str(edge),'--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            port_file=Path(profile)/'DevToolsActivePort';deadline=time.monotonic()+25
            while not port_file.exists() and time.monotonic()<deadline:time.sleep(.1)
            if not port_file.exists():raise RuntimeError('Edge did not start')
            port=port_file.read_text().splitlines()[0]
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list') as response:page=next(p for p in json.load(response) if p['type']=='page')
            browser=Browser(page['webSocketDebuggerUrl']);browser.command('Runtime.enable');browser.command('Page.enable');browser.command('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
            def navigate(path,ready):
                browser.command('Page.navigate',{'url':base+'/'+path});deadline=time.monotonic()+12
                while not browser.evaluate(ready) and time.monotonic()<deadline:time.sleep(.05)
                if not browser.evaluate(ready):raise RuntimeError('Demo page failed: '+path)
            def caption(text):
                browser.evaluate("(()=>{let p=document.getElementById('demoCaption');if(!p){p=document.createElement('div');p.id='demoCaption';p.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#07131bf2;color:#e8f6df;padding:14px 30px;font:16px Segoe UI,sans-serif;border-top:1px solid #83b57b;text-align:center';document.body.appendChild(p);}p.textContent="+json.dumps(text)+";})()")
            scenes=[
                ('index.html','!!window.quantumGame',15,'A playable two-player, two-deck game. Two quantum moves per hand. Nova’s actual cards stay hidden.',{},None),
                ('learn.html','!!window.quantumLearning',18,'Independent faces include rank and suit. H acts on amplitudes—not a predetermined coin flip.',{10:"document.getElementById('guideApply').click()"},"document.querySelector('.state-desk').scrollIntoView({block:'start'})"),
                ('learn.html','!!window.quantumLearning',22,'Prepared teaching hand: A♥ makes a pair; K♠ loses to shown queens. Z commits the entire face.',{8:"document.getElementById('lessonStepNext').click()",24:"document.getElementById('lessonStepNext').click()"},"document.getElementById('challengeTab').click();document.querySelector('[data-lesson=\"0\"]').click();document.querySelector('[data-play=\"H\"]').click();document.querySelector('.learning-grid').scrollIntoView({block:'start'})"),
                ('transfer.html','!!window.quantumTransfer',18,'Unfamiliar preparations: predict before seeing feedback. H can help, hurt, or leave a forecast unchanged.',{18:"document.querySelector('[data-answer=\"'+quantumTransfer.exercise.correct+'\"]').click()"},"document.querySelector('.lesson-table').scrollIntoView({block:'start'})"),
                ('learn.html','!!window.quantumLearning',32,'Linked faces: local 50/50 odds do not tell the whole story. An earned inference is different from Nova’s public reveal.',{8:"document.getElementById('lessonStepNext').click()",20:"document.getElementById('lessonStepNext').click()",32:"document.getElementById('lessonStepNext').click()",44:"document.getElementById('lessonStepNext').click()",54:"document.getElementById('lessonStepNext').click()"},"document.getElementById('challengeTab').click();document.querySelector('[data-lesson=\"2\"]').click();document.querySelector('[data-play=\"X\"]').click();document.querySelector('.learning-grid').scrollIntoView({block:'start'})"),
                ('learn.html','!!window.quantumLearning',25,'Same initial odds and same gates: coherent and dephased pairs give different final correlations. No quantum advantage is claimed.',{10:"document.getElementById('labNext').click()",28:"document.getElementById('labNext').click()"},"document.getElementById('labTab').click();document.querySelector('[data-experiment=\"link\"]').click();document.querySelector('.lab-grid').scrollIntoView({block:'start'})"),
                ('playtest.html',"!!document.getElementById('consent')",10,'Local playtest recording is opt-in. No fabricated participants, automated uploads, or measured learning gains.',{},None),
                ('index.html','!!window.quantumGame',10,'Play live, learn the effects, and inspect the Qiskit evidence. This effort is supported by Qollab & IonQ.',{},None)
            ]
            total=0
            for path,ready,duration,text,events,setup in scenes:
                navigate(path,ready)
                if setup:browser.evaluate(setup)
                caption(text)
                for frame in range(duration*2):
                    if frame in events:browser.evaluate(events[frame])
                    encoded=browser.command('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})['data']
                    image=cv2.imdecode(np.frombuffer(base64.b64decode(encoded),dtype=np.uint8),cv2.IMREAD_COLOR)
                    if image.shape[:2]!=(900,1440):raise RuntimeError('Unexpected video viewport')
                    writer.write(image);total+=1
                print(f'Captured {path}: {duration}s',flush=True)
            if browser.errors:raise RuntimeError('Browser errors during video capture')
            print(json.dumps({'video':str(output),'duration_seconds':total/2,'captioned':True,'scripted_walkthrough':True,'publicly_uploaded':False}),flush=True)
        finally:
            writer.release()
            if browser:
                try:browser.command('Browser.close')
                except Exception:pass
                browser.socket.close()
            if process.poll() is None:process.terminate()
            process.wait(timeout=15);server.shutdown()

if __name__=='__main__':main()
