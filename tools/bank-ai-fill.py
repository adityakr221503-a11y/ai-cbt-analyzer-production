#!/usr/bin/env python3
"""Fill missing answers of a bank with AI. The answers are FLAGGED (ai=1) and are never mixed with PDF answers.
Usage: export GEMINI_API_KEY=...  then  python3 tools/bank-ai-fill.py BANK_ID [--model gemini-3.6-flash]"""
import sys,os,json,re,time,urllib.request,urllib.error
def ask(key,model,qs):
    prompt=('You are an NEET Biology expert. Choose the single correct option for each question below, using NCERT facts. The text comes from OCR and may have small errors. Return ONLY a JSON array with one integer per question, in order: 1 to 4 for the correct option, or 0 if the question is incomplete or cannot be answered from the text.\n\n'+'\n\n'.join(f"{i+1}. {q['q']}\n"+'\n'.join(f"({j+1}) {o}" for j,o in enumerate(q['o'])) for i,q in enumerate(qs)))
    body=json.dumps({'contents':[{'parts':[{'text':prompt}]}],'generationConfig':{'responseMimeType':'application/json'}}).encode()
    url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
    for n in range(6):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,body,{'Content-Type':'application/json'}),timeout=120)
            t=json.load(r)['candidates'][0]['content']['parts'][0]['text'];a=json.loads(re.search(r'\[.*\]',t,re.S).group(0))
            if len(a)==len(qs):return a
        except urllib.error.HTTPError as e:
            if e.code in (429,500,503):time.sleep(20*(n+1));continue
            sys.exit(f'AI error {e.code}: '+e.read().decode()[:200].replace(key,'***'))
        except Exception:time.sleep(5)
    return None
def main():
    bid=sys.argv[1];ar=sys.argv[2:];model=ar[ar.index('--model')+1] if '--model' in ar else 'gemini-3.6-flash';key=os.environ.get('GEMINI_API_KEY')
    if not key:sys.exit('Set your key first: export GEMINI_API_KEY=...')
    d=json.load(open(f'banks/{bid}.json'));qs=d['questions'];cache=os.path.expanduser(f'~/.cache/bankbuild/{bid}.ai.json');done=json.load(open(cache)) if os.path.exists(cache) else {}
    todo=[q for q in qs if q['a'] is None and len(q['o'])>=4 and len(q['q'])>=20 and q['id'] not in done];B=12
    print(len(todo),'questions to answer with AI')
    for i in range(0,len(todo),B):
        b=todo[i:i+B];a=ask(key,model,b)
        if a is None:print('\nA batch failed. Run the same command again to continue.');break
        for q,v in zip(b,a):done[q['id']]=v if isinstance(v,int) and 0<=v<=4 else 0
        os.makedirs(os.path.dirname(cache),exist_ok=True);json.dump(done,open(cache,'w'));print(f'\r{min(i+B,len(todo))}/{len(todo)}',end='',flush=True);time.sleep(3)
    n=0
    for q in qs:
        v=done.get(q['id'])
        if q['a'] is None and v:
            q['a']=v-1;q['ai']=1;n+=1
            if len(q['q'])>=20 and len(q['o'])>=4:q['chk']=0
    json.dump(d,open(f'banks/{bid}.json','w'),ensure_ascii=False)
    ix=json.load(open('banks/index.json'))
    for x in ix:
        if x['id']==bid:x['count']=len(qs);x['keyed']=sum(1 for q in qs if q['a'] is not None and not q.get('ai'));x['ai']=sum(1 for q in qs if q.get('ai'))
    json.dump(ix,open('banks/index.json','w'))
    print(f'\n{n} answers filled by AI (flagged); {sum(1 for q in qs if q["a"] is None)} still without an answer')
if __name__=="__main__":main()
