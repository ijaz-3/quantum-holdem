"""Preflight/local evidence by default. IonQ submission requires an explicit flag."""
import argparse
import importlib.util
import json
import os
from qiskit_engine import run_verification
from pathlib import Path

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ionq-simulator',action='store_true',help='Explicitly submit one job; may consume account credits')
    parser.add_argument('--preflight',action='store_true')
    parser.add_argument('--shots',type=int,default=1024)
    parser.add_argument('--output',type=Path,help='Save an evidence report inside this project')
    args=parser.parse_args()
    if args.preflight:
        print(json.dumps({'qiskit_ionq_installed':importlib.util.find_spec('qiskit_ionq') is not None,'ionq_key_configured':bool(os.environ.get('IONQ_API_KEY')),'remote_job_submitted':False},indent=2));return
    if args.ionq_simulator:
        if not os.environ.get('IONQ_API_KEY'):
            raise SystemExit('Set IONQ_API_KEY in your own environment; do not paste it into chat or commit it.')
        from qiskit_ionq import IonQProvider
        backend=IonQProvider(token=os.environ['IONQ_API_KEY']).get_backend('ionq_simulator',gateset='qis')
        result=run_verification(backend,shots=args.shots);result.update(execution='IonQ simulator',remote_job_submitted=True)
    else:
        result=run_verification(shots=args.shots);result.update(execution='local Qiskit Statevector',remote_job_submitted=False)
    encoded=json.dumps(result,indent=2)
    if args.output:
        root=Path(__file__).resolve().parent;target=args.output.resolve()
        if root not in target.parents:raise SystemExit('Evidence output must be a project subdirectory')
        target.parent.mkdir(parents=True,exist_ok=True);target.write_text(encoded,encoding='utf-8')
    print(encoded)

if __name__=='__main__':main()
