const KEYS=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const IDX={C:0,'B#':0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,F:5,'E#':5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11};
const LET='CDEFGAB',NAT=[0,2,4,5,7,9,11];
const CHORD=/^[A-G](#|b)?(m|maj|min|dim|aug|sus|add|M)?[0-9]*(?:(?:maj|add|sus|b|#|\+|-)?[0-9]+)*(\([^)]*\))?(\/[A-G](#|b)?)?$/;
let img=null,boxes=[],mode='edit',out=null;const cv=document.getElementById('cv'),ctx=cv.getContext('2d'),st=document.getElementById('st');
const src=document.getElementById('src'),dst=document.getElementById('dst');
KEYS.forEach(k=>{src.add(new Option(k));dst.add(new Option(k))});
// 按调的字母关系换音名，拼写自然（如 C→A：E/G# → C#/E#）
function tnote(n,s,t){const ls=(LET.indexOf(t[0])-LET.indexOf(s[0])+7)%7,ss=(IDX[t]-IDX[s]+12)%12;
 const L=(LET.indexOf(n[0])+ls)%7,p=(IDX[n]+ss)%12;let d=((p-NAT[L])%12+18)%12-6;
 if(Math.abs(d)>1){const fl=['Db','Eb','Gb','Ab','Bb'].includes(t)||t=='F';return(fl?['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']:['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'])[p]}
 return LET[L]+(d>0?'#':d<0?'b':'')}
function tc(c,s,t){if(s==t)return c;return c.replace(/[A-G](#|b)?/g,m=>tnote(m,s,t))}
function clean(t){return t.replace(/susd$/,'sus4').replace(/^([A-G]#?b?m?7?)\/([A-G])H$/,'$1/$2#').replace(/^Cc$/,'C').replace(/[,.;:'"`|，。]+$/,'').replace(/^[|'"`]+/,'')}
function isChord(t){t=t.replace(/\(.*$/,m=>/\)$/.test(m)?m:'');return CHORD.test(t)}
function load(f){const r=new FileReader();r.onload=e=>{const i=new Image();i.onload=()=>{img=i;boxes=[];mode='edit';ocr()};i.src=e.target.result};r.readAsDataURL(f)}
document.getElementById('file').onchange=e=>e.target.files[0]&&load(e.target.files[0]);
const drop=document.getElementById('drop');drop.ondragover=e=>e.preventDefault();
drop.ondrop=e=>{e.preventDefault();e.dataTransfer.files[0]&&load(e.dataTransfer.files[0])};
document.onpaste=e=>{for(const it of e.clipboardData.items)if(it.type.startsWith('image'))load(it.getAsFile())};
async function ocr(){draw();st.textContent='正在识别和弦…（第一次要下载识别数据）';
 const sc=img.width<1500?2:1,c=document.createElement('canvas');c.width=img.width*sc;c.height=img.height*sc;
 const x=c.getContext('2d');x.filter='grayscale(1) contrast(1.5)';x.drawImage(img,0,0,c.width,c.height);
 const r=await Tesseract.recognize(c,'eng',{logger:m=>{if(m.progress)st.textContent='识别中 '+Math.round(m.progress*100)+'%'}});
 const W=r.data.words;boxes=[];let key=null;
 let skip=-1;W.forEach((w,i)=>{if(i==skip)return;const b=w.bbox,bx={x:b.x0/sc,y:b.y0/sc,w:(b.x1-b.x0)/sc,h:(b.y1-b.y0)/sc};let t=clean(w.text);
  let m=t.match(/^1=([A-G][#b]?)$/);if(!m&&/^1=$/.test(t)&&W[i+1]&&/^[A-G][#b]?$/.test(W[i+1].text)){m=[0,W[i+1].text];const n=W[i+1].bbox;bx.w=n.x1/sc-bx.x;skip=i+1}
  if(m&&!key){key=m[1];boxes.push({...bx,text:'1='+m[1],key:1});return}
  if(t.length<=12&&isChord(t)&&!(/^[A-G]$/.test(t)&&w.confidence<40))boxes.push({...bx,text:t})});
 window.ocrRaw=W.map(w=>w.text);
 if(key&&IDX[key]!=null)src.value=KEYS[IDX[key]];
 st.textContent=`识别到 ${boxes.filter(b=>!b.key).length} 个和弦${key?'，原调 '+key:'（没找到 1=，请手动选原调）'}。请检查并修正。`;window.ocrDone=1;draw()}
function draw(){if(!img)return;cv.width=img.width;cv.height=img.height;
 if(mode=='out'){ctx.drawImage(out,0,0);return}
 ctx.drawImage(img,0,0);ctx.lineWidth=2;ctx.font='bold 12px sans-serif';
 boxes.forEach(b=>{ctx.strokeStyle=b.key?'#06f':'red';ctx.strokeRect(b.x-1,b.y-1,b.w+2,b.h+2);ctx.fillStyle=b.key?'#06f':'red';ctx.fillText(b.text,b.x,b.y-3)})}
function pt(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height}}
let p0=null;cv.onpointerdown=e=>{if(mode=='edit'&&img)p0=pt(e)};
cv.onpointerup=e=>{if(!p0)return;const p=pt(e),a=p0;p0=null;
 const hit=boxes.find(b=>a.x>=b.x-3&&a.x<=b.x+b.w+3&&a.y>=b.y-3&&a.y<=b.y+b.h+3);
 if(hit&&Math.hypot(p.x-a.x,p.y-a.y)<5){const t=prompt('修改和弦（清空=删除）',hit.text);if(t===null)return;
  if(!t.trim())boxes.splice(boxes.indexOf(hit),1);else hit.text=t.trim();draw();return}
 const t=prompt('补一个和弦：');if(!t||!t.trim())return;
 const hs=boxes.map(b=>b.h).sort((x,y)=>x-y),h=hs[hs.length>>1]||14;
 let bx=Math.hypot(p.x-a.x,p.y-a.y)<5?{x:a.x,y:a.y-h/2,w:h*0.7*t.length,h}:{x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),w:Math.abs(p.x-a.x),h:Math.abs(p.y-a.y)};
 boxes.push({...bx,text:t.trim(),key:/^1\s*=/.test(t)?1:0});draw()};
function bg(c,b){const d=c.getImageData(Math.max(0,b.x-3),Math.max(0,b.y-3),b.w+6,1).data;let r=0,g=0,bl=0,n=d.length/4;
 for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];bl+=d[i+2]}return`rgb(${r/n|0},${g/n|0},${bl/n|0})`}
function render(){const s=src.value,t=dst.value,c=document.createElement('canvas');c.width=img.width;c.height=img.height;
 const x=c.getContext('2d');x.drawImage(img,0,0);x.textBaseline='bottom';const hs=boxes.map(b=>b.h).sort((a,b)=>a-b),med=hs[hs.length>>1]||14;
 boxes.forEach(b=>{const nt=b.key?'1= '+t:tc(b.text,s,t);x.fillStyle=bg(x,b);x.fillRect(b.x-2,b.y-2,b.w+4,b.h+4);
  let fs=Math.max(9,Math.min(b.h,med)*1.05);x.font=`bold ${fs}px Arial,sans-serif`;const lim=Math.max(b.w,fs*0.6*b.text.length)*1.6,mw=x.measureText(nt).width;if(mw>lim){fs*=lim/mw;x.font=`bold ${fs}px Arial,sans-serif`}
  x.fillStyle='#000';x.fillText(nt,b.x,b.y+b.h+1)});return c}
document.getElementById('go').onclick=()=>{if(!img)return;out=render();mode='out';draw();document.getElementById('dl').disabled=false;st.textContent=`已生成 ${src.value} → ${dst.value} 调`};
document.getElementById('back').onclick=()=>{mode='edit';draw()};
document.getElementById('dl').onclick=()=>{const a=document.createElement('a');a.download='换调_'+dst.value+'.png';a.href=out.toDataURL('image/png');a.click()};
