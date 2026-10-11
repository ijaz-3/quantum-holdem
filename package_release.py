"""Build allowlisted public-site and source archives; never include local participant data."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parent
SITE=('index.html','learn.html','transfer.html','playtest.html','styles.css','learn.css','state-view.css','match-layout.css','quantum.js','game.js','state-view.js','app.js','learning-hands.js','learn.js','transfer-model.js','transfer.js','playtest-store.js','playtest.js','qiskit_engine.py','LICENSE','.nojekyll')
SOURCE=SITE+('README.md','SUBMISSION.md','PLAYTEST.md','SMOKE_TESTS.md','DEMO_SCRIPT.md','BACKEND.md','PUBLISH.md','CHANGELOG.md','PROVENANCE.md','requirements.txt','requirements-dev.txt','requirements-ionq.txt','requirements-video.txt','test_game.js','test_learning.js','test_product.js','test_qiskit_engine.py','test_browser.py','smoke_game.js','package_release.py','backend_check.py','record_demo.py','.github/workflows/pages.yml','.gitignore','main.py','qollab/requirements.txt','test_qollab_entry.py','test_acceptance.py','ACCEPTANCE_REVIEW.md')

def package(output:Path,files):
    if output.exists():
        raise FileExistsError(f'{output} already exists; choose a fresh versioned output directory')
    entries={}
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            file=ROOT/name
            if not file.is_file():raise FileNotFoundError(file)
            if file.is_symlink() or ROOT not in file.resolve().parents:raise ValueError('Source must be a regular project file: '+name)
            archive.write(file,name);entries[name]=hashlib.sha256(file.read_bytes()).hexdigest()
    return entries

def package_qollab(output:Path):
    """Keep the hosted Python verifier separate from the external static game."""
    if output.exists():
        raise FileExistsError(f'{output} already exists; choose a fresh versioned output directory')
    entries={}
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for source,name in (('main.py','main.py'),('qiskit_engine.py','qiskit_engine.py'),
                            ('qollab/requirements.txt','requirements.txt'),('LICENSE','LICENSE')):
            file=ROOT/source
            if not file.is_file() or file.is_symlink() or ROOT not in file.resolve().parents:
                raise ValueError('Source must be a regular project file: '+source)
            archive.write(file,name)
            entries[name]=hashlib.sha256(file.read_bytes()).hexdigest()
    return entries

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'.artifacts'/'release-v4');parser.add_argument('--site-dir',type=Path);args=parser.parse_args()
    if args.site_dir:
        target=args.site_dir.resolve()
        if ROOT not in target.parents:raise SystemExit('Site build directory must be a project subdirectory')
        target.mkdir(parents=True,exist_ok=True)
        for name in SITE:(target/name).write_bytes((ROOT/name).read_bytes())
        print(f'Static site prepared at {target}');return
    target=args.output.resolve()
    if ROOT not in target.parents:raise SystemExit('Archives must stay inside the project')
    target.mkdir(parents=True,exist_ok=True)
    site=package(target/'quantum-holdem-site.zip',SITE);source=package(target/'quantum-holdem-source.zip',SOURCE)
    qollab=package_qollab(target/'quantum-holdem-qollab.zip')
    (target/'manifest.json').write_text(json.dumps({'site':site,'source':source,'qollab':qollab,'publicly_published':False,'participant_data_included':False},indent=2),encoding='utf-8')
    print(json.dumps({'site_files':len(site),'source_files':len(source),'qollab_files':len(qollab),'output':str(target),'publicly_published':False}))

if __name__=='__main__':main()
