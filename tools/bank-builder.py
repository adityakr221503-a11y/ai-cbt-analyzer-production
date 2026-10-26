#!/usr/bin/env python3
"""ExamHall bank builder: PDF -> question bank JSON. No AI. Needs: poppler, tesseract, python, pillow.
Usage: python3 tools/bank-builder.py FILE.pdf bank-id "Bank name" [--jobs 4] [--pages 1-50] [--subject Biology]"""
import sys,os,re,json,subprocess
from multiprocessing import Pool
from PIL import Image,ImageChops
def sh(*a):return subprocess.run(a,capture_output=True,text=True).stdout
def clean(png):
    im=Image.open(png).convert('RGB');r,g,b=im.split()
    red=ImageChops.multiply(r.point(lambda v:255 if v>140 else 0),ImageChops.multiply(g.point(lambda v:255 if v<110 else 0),b.point(lambda v:255 if v<110 else 0)))
    gr=im.convert('L').point(lambda v:255 if v>175 else v);gr.paste(255,mask=red);return gr,red
def gutter(gr):
    W,H=gr.size;x0=int(W*.42);band=gr.crop((x0,int(H*.05),int(W*.58),int(H*.93))).point(lambda v:255 if v<140 else 0).resize((int(W*.58)-x0,1),Image.BOX)
    d=list(band.tobytes());m=min(d);return x0+d.index(m) if m<4 else None
def ocr_page(a):
    pdf,p,cache=a;out=f'{cache}/{p}.json'
    if os.path.exists(out):return p
    png=f'{cache}/p{p}';sh('pdftoppm','-f',str(p),'-l',str(p),'-r','200','-png','-singlefile',pdf,png)
    gr,red=clean(png+'.png');W,H=gr.size;gx=gutter(gr);ink=sum(gr.histogram()[:140])/(W*H);psm='6' if ink<.025 else '4';cols=[(0,W)] if ink<.025 or not gx else [(0,gx),(gx,W)];top=int(H*.04);lines=[]
    for a0,b0 in cols:
        gr.crop((a0,top,b0,int(H*.95))).save(png+'_c.png');rows={}
        for ln in sh('tesseract',png+'_c.png','-','--psm',psm,'tsv').split('\n')[1:]:
            f=ln.split('\t')
            if len(f)<12 or not f[11].strip():continue
            k=tuple(f[2:5]);x,y,w,h=map(int,f[6:10]);r=rows.setdefault(k,[x,y,x+w,y+h,[]]);r[0]=min(r[0],x);r[1]=min(r[1],y);r[2]=max(r[2],x+w);r[3]=max(r[3],y+h);r[4].append(f[11])
        for x,y,x2,y2,ws in rows.values():
            rs=red.crop((a0+max(0,x-30),top+max(0,y-6),a0+x+90,top+y2+6)).histogram()[255]
            lines.append({'t':' '.join(ws),'r':rs,'p':p})
    json.dump(lines,open(out,'w'));os.remove(png+'.png');return p
def mk(k):return r'(?:\(\s*%d\s*\)?|(?<![.\d])\d?%d\s*\))'%(k,k)
def opts(t,k):
    m=re.match(r'^.{0,6}?'+mk(k)+r'\s*(.*)$',t)
    if not m:return None
    rest,res,j=m.group(1),[],k
    while j<4:
        n=re.search(r'\s'+mk(j+1)+r'\s',' '+rest+' ')
        if not n:break
        res.append(rest[:max(0,n.start()-1)].strip());rest=(' '+rest+' ')[n.end():].strip();j+=1
    return res+[rest.strip()]
JUNK=re.compile(r'ncert hot ?spot$|all rights reserved|baibhav|neet biolog|^\W*(?:de|b|bh|the)\W*$',re.I)
def clean_lines(ls):
    c={};nm=lambda t:re.sub(r'\d+','#',t.lower());pg={}
    for l in ls:
        if not l.get('keys'):pg.setdefault(l['p'],set()).add(nm(l['t']))
    for sset in pg.values():
        for k in sset:c[k]=c.get(k,0)+1
    lim=max(3,len(pg)*.3);keep=lambda l:l.get('keys') or (not JUNK.search(l['t']) and not (c[nm(l['t'])]>=lim and not re.match(r'^\W{0,6}\(?\s*[1-4]\s*\)',l['t']) and not re.match(r'^(?:Q\.?\s*)?\d{1,3}\s*[.)]',l['t'])))
    return [l for l in ls if keep(l)]
def parse(lines):
    qs=[];cur=[];q=None;o=-1;exp=0;seg='';sub=''
    def new(n,txt,L):
        nonlocal q,o,exp,cur
        if n==1 and exp>5:cur=[]
        q={'n':n,'q':txt,'o':[],'rs':[],'a':None,'p':L['p'],'seg':seg,'sub':sub};qs.append(q);cur.append(q);o=-1;exp=n
    for L in clean_lines(lines):
        if L.get('keys'):
            for z in cur:
                k=L['keys'].get(z['n'])
                if k and k<=len(z['o']):z['a']=k-1
            cur=[];q=None;exp=0;continue
        t=L['t'].strip()
        if not t:continue
        mm=re.match(r'^\W*(zoology|botany)\W*$',t,re.I)
        if mm:sub=mm.group(1).title();continue
        m=re.search(r'\b(Chap\s*ter|Test|NCERT\s*HOT\s*SPOTS?)\s*[-–]?\s*(\d{1,2})\b',t,re.I) if len(t)<50 else None
        if m:
            lab=('Test' if m.group(1).lower()=='test' else 'Chapter')+'-'+m.group(2)
            if lab!=seg:
                if seg=='':
                    for z in qs:z['seg']=z['seg'] or lab
                else:exp=0;q=None;cur=[]
                seg=lab
            continue
        if q and o<3:
            r=opts(t,o+2)
            if r is not None:
                for x in r:o+=1;q['o'].append(x);q['rs'].append(L['r'])
                continue
        m=re.match(r'^(?:Q\.?\s*)?(\d{1,3})\s*[.)]\s*(.*)$',t)
        if m:
            k=int(m.group(1));solo=not m.group(2).strip()
            if (solo and 0<k<=300 and (k>exp or k==1)) or (not q and k<6) or (not q and len(m.group(2))>=10) or (q and o==3 and k>exp) or k==exp+1 or (q and len(q['o'])>=2 and exp<k<=exp+3) or (k==1 and exp>5):
                new(k,m.group(2),L);continue
        if q and o==3 and re.match(r'^[A-Z"\'‘“(]',t) and len(t)>=12 and not re.match(r'^\(\s*\d',t):new(exp+1,t,L);continue
        if not q and len(t)>=12 and re.match(r'^[A-Z"\'‘“]',t):new(exp+1,t,L);continue
        if q:
            if o>=0:q['o'][o]+=' '+t
            else:q['q']+=' '+t
    return [x for x in qs if len(x['o'])>=2]
KR=re.compile(r'(?<![\d.])(\d{1,3})\s*[.)-]?\s*\(\s*([1-4])\s*\)?')
def keypage(ls):
    qr=[re.findall(r'\d+',l['t']) for l in ls if re.match(r'^\W*Que\.?\s+\d',l['t'],re.I)];ar=[re.findall(r'\d+',l['t']) for l in ls if re.match(r'^\W*Ans\.?\s+\d',l['t'],re.I)];d={}
    for x,y in zip(qr,ar):
        if len(x)==len(y):d.update({int(i):int(j) for i,j in zip(x,y) if 1<=int(j)<=4})
    if len(d)>=5:return d
    tx=' '.join(l['t'] for l in ls);ks=KR.findall(tx)
    return {int(i):int(j) for i,j in ks} if len(ks)>=10 and len(tx)/len(ks)<16 else None
def tag_of(ls):
    top=' '.join(l['t'] for l in ls[:14])
    m=re.search(r'NCERT\s*HOT\s*SPOTS?\s*[-–]?\s*(\d{1,2})',top,re.I) or re.search(r'Chap\s*ter\s*[-–]?\s*(\d{1,2})',top,re.I);kind='Chapter'
    if not m:
        m=re.search(r'\bTest\s*[-–]?\s*(\d{1,2})',top,re.I);kind='Test'
        if not m:return None
    sb='Botany' if re.search('botany',top,re.I) else 'Zoology' if re.search('zoology',top,re.I) else ''
    return kind,int(m.group(1)),sb
def level(q):
    t=q['q'];s=0;s+=len(t)>140;s+=len(t)>260;s+=2*bool(re.search(r'statement|assertion|reason|column|match|list-?i',t,re.I));s+=bool(re.search(r'\b(except|not|incorrect|false|wrong)\b',t,re.I));s+=sum(map(len,q['o']))/max(1,len(q['o']))>45;s+=bool(re.search(r'how many|number of|total',t,re.I))
    return 'Easy' if s<=1 else 'Medium' if s==2 else 'Hard' if s==3 else 'Elite'
BOT=r'plant|flower|photosynth|respiration in|botany|living world|classification|ecosystem|biodiversity|organisms|microbes|biotechnology|cell|root|stem|leaf|seed|kingdom'
BW=re.compile(r'plant|xylem|phloem|stem|root|leaf|flower|seed|pollen|photosynth|chloroplast|stomata|cambium|meristem|angiosperm|gymnosperm|monocot|dicot|fruit|ovule|algae|fungi|bryophyte|auxin|gibberellin|ethylene|transpiration',re.I);ZW=re.compile(r'human|animal|blood|heart|kidney|neuron|nerve|muscle|bone|lung|artery|uterus|ovary|testis|sperm|insect|cockroach|frog|earthworm|vertebrate|chordate|mammal|hormone',re.I)
def assign(qs,keys):
    runs=[]
    for q in qs:
        if runs and runs[-1][-1]['seg']==q['seg'] and q['n']>runs[-1][-1]['n']:runs[-1].append(q)
        else:runs.append([q])
    for r in runs:
        tx=' '.join(x['q']+' '.join(x['o']) for x in r);sc=len(BW.findall(tx))-len(ZW.findall(tx))
        sb='Botany' if sc>=3 else 'Zoology' if sc<=-3 else r[0]['sub']
        kd,_,nn=r[0]['seg'].partition('-')
        ks=(keys.get((kd,int(nn),sb)) or keys.get((kd,int(nn),'')) or ({} if sb else next((v for (k2,n2,s2),v in keys.items() if k2==kd and n2==int(nn)),{}))) if nn.isdigit() else {}
        for q in r:
            if sb:q['sub']=sb
            if q['n'] in ks and ks[q['n']]<=len(q['o']):q['a']=ks[q['n']]-1
    return qs
def main():
    pdf,bid,name=sys.argv[1:4];ar=sys.argv[4:];jobs=int(ar[ar.index('--jobs')+1]) if '--jobs' in ar else 2;sub0=ar[ar.index('--subject')+1] if '--subject' in ar else 'Biology'
    n=int(re.search(r'Pages:\s+(\d+)',sh('pdfinfo',pdf)).group(1));a,b=1,n
    if '--pages' in ar:a,b=map(int,ar[ar.index('--pages')+1].split('-'))
    cache=os.path.expanduser(f'~/.cache/bankbuild/{bid}');os.makedirs(cache,exist_ok=True)
    toc=[(int(m[1]),m[2].strip(),int(m[3]),int(m[4])) for m in re.findall(r'^\s*(\d+)\s+(.+?)\s{2,}(\d+)\s*[–-]\s*(\d+)\s*$',sh('pdftotext','-f','1','-l','1','-layout',pdf),re.M)]
    with Pool(jobs) as pl:
        for i,p in enumerate(pl.imap_unordered(ocr_page,[(pdf,p,cache) for p in range(a,b+1)])):print(f'\rpage {i+1}/{b-a+1}',end='',flush=True)
    print()
    def chap(p):
        for k,nm,s,e in toc:
            if s<=p<=e:return nm
    pages={p:json.load(open(f'{cache}/{p}.json')) for p in range(a,b+1)};lines=[];keys={};lastsub=''
    for p in range(a,b+1):
        kp=keypage(pages[p]);tg=tag_of(pages[p]) if kp else None
        if kp and tg:
            sb=tg[2] or lastsub;lastsub=sb;keys.setdefault((tg[0],tg[1],sb),{}).update(kp)
        elif kp:lines.append({'t':'@@KEY','keys':kp,'p':p,'r':0})
        else:lines+=[dict(l,c=chap(p) or '') for l in pages[p]]
    out=[];qid=0
    for q in assign(parse(lines),keys):
        ch=chap(q['p']) or q['seg'] or 'General'
        if q['a'] is None and q['rs'] and max(q['rs'])>=50 and sorted(q['rs'])[-1]>=1.3*max(1,sorted(q['rs'])[-2] if len(q['rs'])>1 else 0):q['a']=q['rs'].index(max(q['rs']));q['src']='tick'
        qid+=1;sub=q['sub'] or (sub0 if sub0!='Biology' else ('Botany' if re.search(BOT,ch,re.I) else 'Zoology'))
        out.append({'id':f'{bid}-{qid}','n':q['n'],'q':q['q'].strip(),'o':[x.strip() for x in q['o'][:4]],'a':q['a'],'s':sub,'ch':ch,'t':ch,'lvl':level(q),'pg':q['p'],'chk':int(len(q['q'])<20 or len(q['o'])<4 or q['a'] is None)})
    if '--keyed-only' in ar:out=[x for x in out if x['a'] is not None]
    os.makedirs('banks',exist_ok=True);json.dump({'id':bid,'name':name,'questions':out},open(f'banks/{bid}.json','w'),ensure_ascii=False)
    ix=json.load(open('banks/index.json')) if os.path.exists('banks/index.json') else []
    ix=[x for x in ix if x['id']!=bid]+[{'id':bid,'name':name,'count':len(out),'keyed':sum(x['a'] is not None for x in out)}];json.dump(ix,open('banks/index.json','w'))
    print(len(out),'questions;',sum(x['a'] is not None for x in out),'with answers;',sum(x['chk'] for x in out),'to check')
if __name__=="__main__":main()
