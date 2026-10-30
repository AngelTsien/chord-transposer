const KEYS=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const IDX={C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,F:5,'E#':5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
const LET='CDEFGAB',NAT=[0,2,4,5,7,9,11];
// 严格和弦语法
const CH='[A-G][#b]?(?:maj7|maj9|maj|min|m|dim|aug|sus2|sus4|sus|add9|add2|M7|\\+)?(?:7|9|11|13|6|5|2|4)?(?:b5|#5|b9|#9|add9|sus4)?(?:\\/[A-G][#b]?)?';
const CHORD=new RegExp('^'+CH+'$'),CHORDP=new RegExp('^('+CH+')\\((.*)\\)$');
let img=null,boxes=[],rows=[],mode='edit',out=null,undo=[];
const $=id=>document.getElementById(id),cv=$('cv'),ctx=cv.getContext('2d'),st=$('st'),src=$('src'),dst=$('dst');
KEYS.forEach(k=>{src.add(new Option(k));dst.add(new Option(k))});dst.value='A';
function tnote(n,s,t){const ls=(LET.indexOf(t[0])-LET.indexOf(s[0])+7)%7,ss=(IDX[t]-IDX[s]+12)%12;
 const L=(LET.indexOf(n[0])+ls)%7,p=(IDX[n]+ss)%12;let d=((p-NAT[L])%12+18)%12-6;
 if(Math.abs(d)>1){const fl=['F','Bb','Eb','Ab','Db','Gb'].includes(t);return(fl?['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'])[p]}
 return LET[L]+(d>0?'#':d<0?'b':'')}
function tc(c,s,t){if(s==t)return c;return c.replace(/[A-G](#|b)?/g,m=>tnote(m,s,t))}
// 常见 OCR 错误修正
function fix(t){t=t.replace(/^[^A-G0-9]+/,'').replace(/[^A-Za-z0-9#)]+$/,'');
 t=t.replace(/^6(?=[m7s\/]|$)/,'G').replace(/^8(?=[m7s\/]|$)/,'B').replace(/^0(?=[m7\/]|$)/,'D');
 t=t.replace(/\/8$/,'/B').replace(/\/6$/,'/G').replace(/\/0$/,'/D').replace(/H$/,'#').replace(/\/([A-G])H/,'/$1#')
  .replace(/sus[dA]$/,'sus4').replace(/susa$/,'sus4').replace(/sus[S]$/,'sus5').replace(/m1$/,'m7').replace(/([A-G][#b]?m?)T$/,'$17');
 return t}
function load(f){const r=new FileReader();r.onload=e=>{const i=new Image();i.onload=()=>{img=i;boxes=[];undo=[];mode='edit';ocr()};i.src=e.target.result};r.readAsDataURL(f)}
$('file').onchange=e=>e.target.files[0]&&load(e.target.files[0]);
const drop=$('drop');drop.ondragover=e=>e.preventDefault();
drop.ondrop=e=>{e.preventDefault();e.dataTransfer.files[0]&&load(e.dataTransfer.files[0])};
document.onpaste=e=>{for(const it of e.clipboardData.items)if(it.type.startsWith('image'))load(it.getAsFile())};
function gray(){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
 const d=x.getImageData(0,0,c.width,c.height).data,g=new Uint8Array(c.width*c.height);for(let i=0;i<g.length;i++)g[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11);return g}
function bandCanvas(g,y0,y1,th,sc){const W=img.width,H=y1-y0,c=document.createElement('canvas');c.width=W*sc+40;c.height=H*sc+40;
 const x=c.getContext('2d'),s=document.createElement('canvas');s.width=W;s.height=H;const sx=s.getContext('2d'),id=sx.createImageData(W,H);
 for(let y=0;y<H;y++)for(let i=0;i<W;i++){const q=g[(y+y0)*W+i],v=th?(q<th?0:255):q,k=(y*W+i)*4;id.data[k]=id.data[k+1]=id.data[k+2]=v;id.data[k+3]=255}
 sx.putImageData(id,0,0);x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.imageSmoothingEnabled=true;x.drawImage(s,20,20,W*sc,H*sc);return c}
const isCJK=s=>/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(s);
async function ocr(){draw();st.textContent='正在识别（第一次要下载识别数据）…';
 const W=img.width,H=img.height,g=gray();
 // 1) 全图中英识别：找文本行并分类
 const wk=await Tesseract.createWorker(['eng','chi_sim']);
 const r=await wk.recognize(img);await wk.terminate();
 const words=r.data.words;let key=null;
 words.forEach((w,i)=>{const t=w.text.replace(/\s/g,'');let m=t.match(/^1=([A-G][#b]?)/);
  if(!m&&/^1=?$/.test(t)&&words[i+1]){const n=words[i+1].text.replace(/^=/,'');if(/^[A-G][#b]?$/.test(n)){m=[0,n];w={...w,bbox:{...w.bbox,x1:words[i+1].bbox.x1}}}}
  if(m&&!key&&w.bbox.y0<H*.25){key={x:w.bbox.x0,y:w.bbox.y0,w:w.bbox.x1-w.bbox.x0,h:w.bbox.y1-w.bbox.y0,text:'1='+m[1],key:1,conf:1}}});
 const cjk=words.filter(w=>isCJK(w.text)&&w.confidence>30).map(w=>w.bbox);
 rows=[];r.data.lines.forEach(l=>{const ts=l.words.map(w=>w.text);const ch=ts.filter(t=>CHORD.test(fix(t))||CHORDP.test(fix(t))).length;
  const cj=ts.filter(isCJK).join('').length,dg=ts.join('').replace(/[^0-9]/g,'').length,lt=ts.join('').length||1;
  if(ch>=1&&ch>=ts.length*0.4&&dg/lt<0.4&&cj<ts.join('').length*0.5)rows.push({y0:l.bbox.y0,y1:l.bbox.y1})});
 // 合并重叠的和弦行
 rows.sort((a,b)=>a.y0-b.y0);rows=rows.reduce((a,r)=>{const p=a[a.length-1];if(p&&r.y0<p.y1-3){p.y1=Math.max(p.y1,r.y1);p.y0=Math.min(p.y0,r.y0)}else a.push({...r});return a},[]);
 // 2) 每个和弦行单独识别，多种参数投票
 const wl=await Tesseract.createWorker('eng');
 const WL='ABCDEFGabcdgijmnsuM0123456789#/()+-';
function addC(b,raw,cf){    let t=fix(raw);const pm=t.match(CHORDP);
    if(pm){const a=pm[1],inner=pm[2].match(/([A-G][#b]?[a-z0-9]*)$/),n=t.length;
     cands.push({...b,w:b.w*a.length/n,text:a,c:cf});
     if(inner&&CHORD.test(fix(inner[1]))){const k=t.length-1-inner[1].length;cands.push({x:b.x+b.w*k/n,y:b.y+b.h*.15,w:b.w*inner[1].length/n,h:b.h*.8,text:fix(inner[1]),c:cf*.8})}
     return}
if(CHORD.test(t))cands.push({...b,text:t,c:cf})}
 const V=[[0,3,'11',1],[0,2,'6',0],[160,3,'11',1]],cands=[];let ri=0;
 for(const R of rows){ri++;const y0=Math.max(0,R.y0-6),y1=Math.min(H,R.y1+6);
  for(const [th,sc,psm,wlist] of V){st.textContent=`识别和弦行 ${ri}/${rows.length}…`;await wl.setParameters({tessedit_pageseg_mode:psm,tessedit_char_whitelist:wlist?WL:''});
   const c=bandCanvas(g,y0,y1,th,sc),o=await wl.recognize(c);
   o.data.words.forEach(w=>{const b={x:(w.bbox.x0-20)/sc,y:(w.bbox.y0-20)/sc+y0,w:(w.bbox.x1-w.bbox.x0)/sc,h:(w.bbox.y1-w.bbox.y0)/sc};
    addC(b,w.text,w.confidence)})}}
 {const sc=2,c=document.createElement('canvas');c.width=W*sc;c.height=H*sc;const x=c.getContext('2d');x.filter='grayscale(1) contrast(1.5)';x.drawImage(img,0,0,c.width,c.height);
  await wl.setParameters({tessedit_pageseg_mode:'3',tessedit_char_whitelist:''});const o=await wl.recognize(c);
  o.data.words.forEach(w=>{const b={x:w.bbox.x0/sc,y:w.bbox.y0/sc,w:(w.bbox.x1-w.bbox.x0)/sc,h:(w.bbox.y1-w.bbox.y0)/sc};if(!rows.some(r=>b.y+b.h/2>r.y0-4&&b.y+b.h/2<r.y1+4))return;addC(b,w.text,w.confidence)})}
 await wl.terminate();window.dbg={rej:0,rows,cands:cands.map(c=>c.text+"@"+(c.x|0)+","+(c.y|0)+" "+(c.c|0)),lines:r.data.lines.map(l=>(l.bbox.y0)+":"+l.text.trim().slice(0,60))};
 // 3) 按位置合并投票
 cands.sort((a,b)=>a.x-b.x);const cl=[];
 cands.forEach(c=>{if(c.h<6||c.w>c.h*6)return;if(cjk.some(k=>c.x<k.x1-2&&c.x+c.w>k.x0+2&&c.y<k.y1-2&&c.y+c.h>k.y0+2)){(window.rej=window.rej||[]).push(c.text+"@"+(c.x|0)+","+(c.y|0));return}
  const ov=(q)=>{const a=q.v[0],ox=Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x),oy=Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);return oy>0&&ox>0.4*Math.min(a.w,c.w)};
  const m=cl.find(ov);if(m)m.v.push(c);else cl.push({x:c.x,y:c.y,v:[c]})});
 boxes=cl.map(q=>{const tally={};q.v.forEach(c=>tally[c.text]=(tally[c.text]||0)+1+c.c/100);for(const a in tally)for(const b in tally)if(a!=b&&a.startsWith(b))tally[a]+=tally[b]*0.6;
  const best=Object.keys(tally).sort((a,b)=>tally[b]-tally[a])[0],vs=q.v.filter(c=>c.text==best),n=new Set(q.v.map(c=>c.text)).size;
  const avg=k=>vs.reduce((s,c)=>s+c[k],0)/vs.length,conf=Math.min(1,vs.length/3)*Math.max(.3,avg('c')/100)/(n>1?1.3:1);
  return{x:avg('x'),y:avg('y'),w:avg('w'),h:avg('h'),text:best,conf,votes:vs.length}}).filter(b=>b.votes>=2||b.conf>0.06);
 {const M=med();boxes=boxes.filter(b=>{const r=rows.find(r=>b.y+b.h/2>=r.y0-6&&b.y+b.h/2<=r.y1+6);if(!r)return false;
  const cs=boxes.filter(o=>o.votes>=2&&o.y+o.h/2>=r.y0-6&&o.y+o.h/2<=r.y1+6).map(o=>o.y+o.h/2).sort((a,b)=>a-b);const mc=cs[cs.length>>1];
  return mc==null||Math.abs(b.y+b.h/2-mc)<M*1.4})}
 if(key)boxes.unshift(key);
 if(key&&IDX[key.text.slice(2)]!=null)src.value=KEYS[IDX[key.text.slice(2)]];
 st.textContent=`识别到 ${boxes.filter(b=>!b.key).length} 个和弦${key?'，原调 '+key.text.slice(2):'（没找到 1=，请手动选原调）'}。黄色框把握不大，请重点检查。`;window.ocrDone=1;draw()}
const LOW=0.6;
function draw(){if(!img)return;cv.width=img.width;cv.height=img.height;
 if(mode=='out'){ctx.drawImage(out,0,0);return}
 ctx.drawImage(img,0,0);ctx.lineWidth=2;ctx.font='bold 12px sans-serif';
 rows.forEach(r=>{ctx.fillStyle='rgba(0,120,255,.05)';ctx.fillRect(0,r.y0,img.width,r.y1-r.y0)});
 boxes.forEach(b=>{const col=b.key?'#06f':b.conf<LOW?'#e6a800':'red';ctx.strokeStyle=col;if(b.conf<LOW){ctx.fillStyle='rgba(255,220,0,.3)';ctx.fillRect(b.x,b.y,b.w,b.h)}
  ctx.strokeRect(b.x-1,b.y-1,b.w+2,b.h+2);ctx.fillStyle=col;ctx.fillText(b.text,b.x,b.y-3)})}
function pt(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height}}
function save(){undo.push(JSON.stringify(boxes));if(undo.length>100)undo.shift()}
$('undo').onclick=()=>{if(undo.length){boxes=JSON.parse(undo.pop());mode='edit';draw()}};
function med(){const hs=boxes.filter(b=>!b.key).map(b=>b.h).sort((a,b)=>a-b);return hs[hs.length>>1]||14}
let p0=null;cv.onpointerdown=e=>{if(mode=='edit'&&img)p0=pt(e)};
cv.onpointerup=e=>{if(!p0)return;const p=pt(e),a=p0;p0=null;const pad=Math.max(4,cv.width/150);
 const hit=boxes.find(b=>a.x>=b.x-pad&&a.x<=b.x+b.w+pad&&a.y>=b.y-pad&&a.y<=b.y+b.h+pad);
 if(hit&&Math.hypot(p.x-a.x,p.y-a.y)<8){pad_open(hit.text,t=>{save();if(t==null)boxes.splice(boxes.indexOf(hit),1);else{hit.text=t;hit.conf=1}draw()},true);return}
 const h=med();let bx;
 if(Math.hypot(p.x-a.x,p.y-a.y)<8){const r=rows.find(r=>a.y>=r.y0-h&&a.y<=r.y1+h);const y=r?(r.y0+r.y1)/2:a.y;bx={x:a.x,y:y-h/2,w:h*1.5,h}}
 else bx={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(p.x-a.x),h:Math.abs(p.y-a.y)};
 pad_open('',t=>{if(!t)return;save();bx.w=Math.max(bx.w,h*0.6*t.length);boxes.push({...bx,text:t,conf:1,key:/^1\s*=/.test(t)?1:0});draw()},false)};
// 和弦小键盘
let padCb=null;const pd=$('pad'),pi=$('pin');
function pad_open(t,cb,canDel){padCb=cb;pi.value=t;$('pdel').style.display=canDel?'':'none';pd.style.display='flex';pi.focus()}
function pad_close(v){pd.style.display='none';const cb=padCb;padCb=null;cb&&cb(v)}
function mk(id,list,f){const el=$(id);list.forEach(s=>{const b=document.createElement('button');b.textContent=s||'大三';b.onclick=()=>f(s);el.appendChild(b)})}
mk('proot',['C','D','E','F','G','A','B','#','b'],s=>{if(/[#b]/.test(s))pi.value=pi.value.replace(/^([A-G])[#b]?/,'$1'+s);else pi.value=s+pi.value.replace(/^[A-G][#b]?/,'')});
mk('pqual',['','m','7','m7','maj7','sus4','sus2','dim','aug','add9','6','9','m7b5'],s=>{const m=pi.value.match(/^([A-G][#b]?)[^/]*(\/.*)?$/);if(m)pi.value=m[1]+s+(m[2]||'')});
mk('pbass',['无','C','D','E','F','G','A','B','C#','F#','G#','Bb','Eb'],s=>{pi.value=pi.value.replace(/\/.*$/,'')+(s=='无'?'':'/'+s)});
$('pok').onclick=()=>pad_close(pi.value.trim()||null);$('pdel').onclick=()=>pad_close(null);$('pcancel').onclick=()=>{pd.style.display='none';padCb=null};
pi.onkeydown=e=>{if(e.key=='Enter')$('pok').click()};
function bg(x,b){const p=3,X=Math.max(0,b.x-p|0),Y=Math.max(0,b.y-p|0),w=Math.min(img.width-X,b.w+2*p|0),h=Math.min(img.height-Y,b.h+2*p|0);
 const d=x.getImageData(X,Y,w,h).data,v=[];for(let i=0;i<d.length;i+=4)v.push((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
 const lum=c=>((c>>16)&255)+((c>>8)&255)+(c&255);v.sort((a,b)=>lum(b)-lum(a));const c=v[v.length*0.15|0]||0xffffff;return`rgb(${c>>16&255},${c>>8&255},${c&255})`}
function render(){const s=src.value,t=dst.value,c=document.createElement('canvas');c.width=img.width;c.height=img.height;
 const x=c.getContext('2d');x.drawImage(img,0,0);x.textBaseline='alphabetic';const M=med(),ord=boxes.slice().sort((a,b)=>a.x-b.x);
 boxes.forEach(b=>{x.fillStyle=bg(x,b);x.fillRect(b.x-2,b.y-2,b.w+4,b.h+4)});
 boxes.forEach(b=>{const nt=b.key?'1= '+t:tc(b.text,s,t);let fs=b.key?Math.max(M,b.h)*1.05:Math.min(b.h*1.15,M*1.05);
  const nxt=ord.find(o=>o!==b&&o.x>b.x+2&&Math.abs((o.y+o.h/2)-(b.y+b.h/2))<M);const room=nxt?nxt.x-b.x-3:img.width-b.x-2;
  x.font=`bold ${fs}px Arial,sans-serif`;const mw=x.measureText(nt).width;if(mw>room&&room>fs)fs*=Math.max(0.7,room/mw);
  x.font=`bold ${fs}px Arial,sans-serif`;x.fillStyle='#000';x.fillText(nt,b.x,b.y+b.h*0.5+fs*0.36)});return c}
$('go').onclick=()=>{if(!img)return;out=render();mode='out';draw();$('dl').disabled=false;st.textContent=`已生成 ${src.value} → ${dst.value} 调`};
$('back').onclick=()=>{mode='edit';draw()};
$('dl').onclick=()=>{const a=document.createElement('a');a.download='换调_'+dst.value+'.png';a.href=out.toDataURL('image/png');a.click()};
