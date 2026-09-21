const $=s=>document.querySelector(s), input=$("#file"), drop=$("#drop"), app=$("#app");
let original=null,cleanBlob=null;
const fmt=n=>n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
input.onchange=()=>input.files[0]&&load(input.files[0]);
["dragenter","dragover"].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(e=>drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove("drag")}));
drop.ondrop=e=>{let f=e.dataTransfer.files[0];if(f&&/^image\/(jpeg|png|webp)$/.test(f.type))load(f)};
async function load(f){original=f;app.classList.remove("hidden");$("#thumb").src=URL.createObjectURL(f);$("#fname").textContent=f.name;$("#finfo").textContent=`${f.type} • ${fmt(f.size)}`;$("#result").classList.add("hidden");$("#meter").style.width="15%";$("#scanState").textContent="Scanning…";let m=await scan(f);$("#meter").style.width="100%";$("#scanState").textContent="Scan complete";render($("#before"),m);$("#count").textContent=m.length}
function add(m,label,value){m.push({label,value})}
async function scan(file){
 const m=[],buf=new Uint8Array(await file.slice(0,256*1024).arrayBuffer()),text=new TextDecoder("latin1").decode(buf);
 if(file.type==="image/jpeg"){let p=2;while(p+4<buf.length&&buf[p]===255){let marker=buf[p+1],len=(buf[p+2]<<8)|buf[p+3];if(len<2||p+2+len>buf.length)break;let seg=text.slice(p+4,p+2+len);if(marker===225&&seg.startsWith("Exif"))add(m,"EXIF","Embedded EXIF block");else if(marker===225&&/xmp/i.test(seg))add(m,"XMP","Embedded XMP block");else if(marker===237)add(m,"IPTC / APP13","JPEG application segment");else if(marker>=224&&marker<=239)add(m,`JPEG APP${marker-224}`,"Application segment");p+=2+len}}
 if(file.type==="image/png"){let dv=new DataView(buf.buffer),p=8;while(p+12<=buf.length){let len=dv.getUint32(p);if(p+12+len>buf.length)break;let typ=text.slice(p+4,p+8);if(["tEXt","zTXt","iTXt"].includes(typ))add(m,`PNG ${typ}`,"Embedded text metadata");p+=12+len;if(typ==="IEND")break}}
 [["GPS","GPSLatitude|GPSLongitude|GPSPosition"],["Camera","Make|Model|LensModel|LensMake"],["Date","DateTimeOriginal|CreateDate|DateTimeDigitized"],["Software","Software|CreatorTool|ProcessingSoftware"],["Author","Artist|Author|Creator"],["Copyright","Copyright"],["C2PA / provenance","c2pa|content.credentials|jumbf"]].forEach(([l,p])=>{if(new RegExp(p,"i").test(text))add(m,l,"Metadata marker detected")});
 return [...new Map(m.map(x=>[x.label+"|"+x.value,x])).values()]
}
function render(el,m){el.innerHTML=m.length?m.map(x=>`<div class="row"><span>${esc(x.label)}</span><span>${esc(x.value)}</span></div>`).join(""):`<div class="empty">No common metadata detected.</div>`}
$("#clean").onclick=async()=>{
 if(!original)return;let b=$("#clean");b.disabled=true;b.textContent="Rebuilding…";
 try{let img=new Image();img.src=URL.createObjectURL(original);await img.decode();let c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);let type=original.type==="image/png"?"image/png":"image/jpeg";cleanBlob=await new Promise(r=>c.toBlob(r,type,type==="image/jpeg"?.95:undefined));let after=await scan(new File([cleanBlob],"clean."+ (type==="image/png"?"png":"jpg"),{type}));render($("#after"),after);$("#removed").textContent=$("#count").textContent;$("#remaining").textContent=after.length;$("#resultBadge").textContent=after.length?"Review remaining fields":"Clean";$("#resultBadge").style.color=after.length?"#f2b84b":"#49d39b";$("#result").classList.remove("hidden");$("#result").scrollIntoView({behavior:"smooth",block:"start"})}catch(e){alert("Could not process this image. Try JPEG or PNG.")}finally{b.disabled=false;b.textContent="Clean image"}};
$("#download").onclick=()=>{if(!cleanBlob)return;let base=original.name.replace(/\.[^.]+$/,"");let ext=original.type==="image/png"?"png":"jpg";let a=document.createElement("a");a.href=URL.createObjectURL(cleanBlob);a.download=base+"-clean."+ext;a.click()};
$("#reset").onclick=$("#again").onclick=()=>{app.classList.add("hidden");input.value="";original=null;cleanBlob=null;window.scrollTo({top:0,behavior:"smooth"})};

// ============================================================================
// Cyber Arcade Hub Launcher (Turbo Drive, Cyber Circuit, Neon Breaker, Cyber Strike)
// ============================================================================
const arcadeModal = $("#arcadeModal");
const arcadeIframe = $("#arcadeIframe");
const arcadeTabLink = $("#arcadeTabLink");
const tabTurbo = $("#tabArcadeTurbo");
const tabPuzzle = $("#tabArcadePuzzle");
const tabBreaker = $("#tabArcadeBreaker");
const tabStrike = $("#tabArcadeStrike");

function switchGame(url) {
  const cleanUrl = url.split("?")[0];
  const cacheBusted = cleanUrl + "?t=" + Date.now();
  if (arcadeIframe) arcadeIframe.src = cacheBusted;
  if (arcadeTabLink) arcadeTabLink.href = cleanUrl;
  if (tabTurbo) tabTurbo.classList.toggle("active", cleanUrl.includes("game"));
  if (tabPuzzle) tabPuzzle.classList.toggle("active", cleanUrl.includes("puzzle"));
  if (tabBreaker) tabBreaker.classList.toggle("active", cleanUrl.includes("breaker"));
  if (tabStrike) tabStrike.classList.toggle("active", cleanUrl.includes("strike"));
}

function openArcade(gameUrl = "game/index.html") {
  if (!arcadeModal) return;
  arcadeModal.classList.remove("hidden");
  switchGame(gameUrl);
  document.body.style.overflow = "hidden";
}

function closeArcade() {
  if (!arcadeModal) return;
  arcadeModal.classList.add("hidden");
  if (arcadeIframe) {
    arcadeIframe.src = "about:blank";
  }
  document.body.style.overflow = "";
}

if (tabTurbo) tabTurbo.onclick = () => switchGame("game/index.html");
if (tabPuzzle) tabPuzzle.onclick = () => switchGame("puzzle/index.html");
if (tabBreaker) tabBreaker.onclick = () => switchGame("breaker/index.html");
if (tabStrike) tabStrike.onclick = () => switchGame("strike/index.html");

const openBtn = $("#openArcadeBtn");
if (openBtn) openBtn.onclick = () => openArcade("game/index.html");

const bannerBtn = $("#arcadeBannerBtn");
if (bannerBtn) bannerBtn.onclick = () => openArcade("game/index.html");

const puzzleBannerBtn = $("#arcadePuzzleBtn");
if (puzzleBannerBtn) puzzleBannerBtn.onclick = () => openArcade("puzzle/index.html");

const breakerBannerBtn = $("#arcadeBreakerBtn");
if (breakerBannerBtn) breakerBannerBtn.onclick = () => openArcade("breaker/index.html");

const strikeBannerBtn = $("#arcadeStrikeBtn");
if (strikeBannerBtn) strikeBannerBtn.onclick = () => openArcade("strike/index.html");

const closeBtn = $("#closeArcadeBtn");
if (closeBtn) closeBtn.onclick = closeArcade;

const backdrop = $("#arcadeBackdrop");
if (backdrop) backdrop.onclick = closeArcade;

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && arcadeModal && !arcadeModal.classList.contains("hidden")) {
    closeArcade();
  }
});


