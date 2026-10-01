"""Approved audio is immutable during ordinary re-authoring."""
import hashlib,json

def approved_files(root):
    file=root/'feedback.json'
    if not file.exists():return {}
    state=json.loads(file.read_text(encoding='utf-8'))
    locks={}
    for decision in state['decisions'].values():
        if not decision.get('locked'):continue
        for name,expected in decision['files'].items():
            path=(root/name).resolve()
            if path.parent!=(root/'audio').resolve():raise RuntimeError('Invalid approval file path')
            if hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
                raise RuntimeError('Approved audio has changed on disk: '+name)
            locks[name]=expected
    return locks

def check_candidate(locks,name,data):
    if name in locks and hashlib.sha256(data).hexdigest()!=locks[name]:
        raise RuntimeError('Approved audio is locked: '+name+'. Preserve it; a user-requested revision needs an explicit new approval round.')
