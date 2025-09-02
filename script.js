
// Minimal BlazeWolf script with Firebase integration.
// Replace FIREBASE_CONFIG in index.html with your Firebase project config (already embedded).

let app, auth, db, storage;
function fbInit(){
  if(window._fbInited) return;
  if(!window.FIREBASE_CONFIG) { console.warn("FIREBASE_CONFIG missing"); return; }
  app = firebase.initializeApp(window.FIREBASE_CONFIG);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  window._fbInited = true;
}

// i18n simple
const LANGS = {en:"English (UK)", id:"Indonesia", zh:"中文", ru:"Русский", jtm:"Jawa Timur", ar:"العربية"};
const I18N = { login:{en:"Login",id:"Masuk"}, register:{en:"Register",id:"Daftar"}, language:{en:"Language",id:"Bahasa"}, theme_toggle:{en:"Toggle Theme",id:"Ganti Tema"}, create_room:{en:"Create Room",id:"Buat Ruang"}, join_room:{en:"Join Room",id:"Masuk Ruang"}, upload:{en:"Upload",id:"Unggah"}, logout:{en:"Logout",id:"Keluar"} };
function getLang(){return localStorage.getItem("lang")||"en"} function setLang(l){localStorage.setItem("lang",l)} function t(k){return (I18N[k]&&I18N[k][getLang()])||k} function applyI18n(){document.querySelectorAll("[data-i18n]").forEach(n=>n.textContent=t(n.getAttribute("data-i18n")))} function fillLanguageSelect(sel){if(!sel) return; sel.innerHTML=''; Object.entries(LANGS).forEach(([v,n])=>{let o=document.createElement("option");o.value=v;o.textContent=n;sel.appendChild(o)}); sel.value=getLang(); sel.onchange=e=>{setLang(e.target.value); applyI18n();}}

// Theme
function getTheme(){return localStorage.getItem("theme")||"dark"} function setTheme(v){localStorage.setItem("theme",v); document.body.classList.toggle("light",v==="light");} function toggleTheme(){setTheme(getTheme()==="dark"?"light":"dark")}

// Utils
function randCode(){return Math.random().toString(36).slice(2,8).toUpperCase()} async function sha256(text){const enc=new TextEncoder().encode(text);const buf=await crypto.subtle.digest("SHA-256",enc);return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("")} function qs(p){return new URLSearchParams(location.search).get(p)}

// Kebab
function bindKebab(){const btn=document.getElementById("kebabBtn"); const dd=document.getElementById("menuDropdown"); if(!btn||!dd) return; btn.addEventListener("click", ()=> dd.classList.toggle("show")); document.addEventListener("click", e=>{ if(!dd.contains(e.target) && e.target!==btn) dd.classList.remove("show"); });}

// Auth page
function bootAuthPage(){
  fbInit(); setTheme(getTheme()); applyI18n(); bindKebab(); fillLanguageSelect(document.getElementById("langSelect")); document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  const tabLogin=document.getElementById("tabLogin"), tabRegister=document.getElementById("tabRegister"), submitBtn=document.getElementById("submitAuth"), googleBtn=document.getElementById("googleBtn");
  let mode="login";
  function setMode(m){mode=m; tabLogin.classList.toggle("active",m==="login"); tabRegister.classList.toggle("active",m==="register"); submitBtn.dataset.i18n=m; applyI18n();}
  tabLogin.onclick=()=>setMode("login"); tabRegister.onclick=()=>setMode("register");
  submitBtn.onclick=async()=>{ const u=document.getElementById("username").value.trim(); const p=document.getElementById("password").value; if(!u||!p){alert("Please fill fields"); return;} try{ const email = `${u}@blazewolf.local`; if(mode==="register"){ await auth.createUserWithEmailAndPassword(email,p); await auth.currentUser.updateProfile({displayName:u}); location.href="home.html"; } else { await auth.signInWithEmailAndPassword(email,p); location.href="home.html"; } }catch(e){ alert(e.message); } };
  googleBtn.onclick=async()=>{ try{ await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); location.href="home.html"; }catch(e){ alert(e.message); } };
  auth && auth.onAuthStateChanged && auth.onAuthStateChanged(u=>{ if(u) location.href="home.html"; });
  setMode("login");
}

// Home
function bootHomePage(){ fbInit(); setTheme(getTheme()); applyI18n(); bindKebab(); fillLanguageSelect(document.getElementById("langSelect")); document.getElementById("themeToggle")?.addEventListener("click", toggleTheme); auth && auth.onAuthStateChanged && auth.onAuthStateChanged(u=>{ if(!u) location.href="index.html"; }); }

// Create/Join
async function createRoom(){ const name=document.getElementById("roomName").value.trim(); const pass=document.getElementById("roomPass").value; if(!name){alert("Room name required");return;} const code=randCode(); const passHash = pass? await sha256(pass): null; const u = auth.currentUser; await db.collection("rooms").doc(code).set({name, passHash, ownerUid:u?u.uid:null, createdAt: firebase.firestore.FieldValue.serverTimestamp()}); closeCreateModal(); alert("Room created: "+code); location.href = "room.html?code="+code; }
function openCreateModal(){document.getElementById("createModal").showModal()} function closeCreateModal(){document.getElementById("createModal").close()}
function openJoinModal(){document.getElementById("joinModal").showModal(); document.getElementById("passWrapper").style.display='none'} function closeJoinModal(){document.getElementById("joinModal").close()}
async function joinRoom(){ const code=document.getElementById("joinCode").value.trim().toUpperCase(); if(!code){alert("Enter code"); return;} const doc = await db.collection("rooms").doc(code).get(); if(!doc.exists){alert("Room not found"); return;} const data = doc.data(); if(data.passHash){ const entered = document.getElementById("joinPass").value; if(!entered){ alert("Password required"); return;} const h = await sha256(entered); if(h !== data.passHash){ alert("Wrong password"); return;} } closeJoinModal(); location.href = "room.html?code="+code; }

// Room
async function bootRoomPage(){ fbInit(); setTheme(getTheme()); applyI18n(); bindKebab(); fillLanguageSelect(document.getElementById("langSelect")); document.getElementById("themeToggle")?.addEventListener("click", toggleTheme);
  const code = (qs("code")||"").toUpperCase(); if(!code){alert("Missing code"); location.href='home.html'; return;} document.getElementById("roomCodeView").textContent = code;
  auth.onAuthStateChanged(async u=>{ if(!u){ location.href='index.html'; return;} const snap = await db.collection("rooms").doc(code).get(); if(!snap.exists){ alert('Room not found'); location.href='home.html'; return;} const room = snap.data(); document.getElementById("roomHeader").textContent = room.name;
    db.collection("rooms").doc(code).collection("files").orderBy("createdAt","desc").onSnapshot(snap=>{ const container=document.getElementById("fileList"); container.innerHTML=''; snap.forEach(doc=>{ const f=doc.data(); const isOwner = u && u.uid===f.uploader.uid; const div=document.createElement('div'); div.className='file-row'; div.innerHTML = `<div><strong>${f.filename}</strong><br/><small>${f.folder} • ${(f.size/1024).toFixed(1)} KB • Uploaded by ${f.uploader.name}</small></div>`; const controls=document.createElement('div'); controls.className='row gap'; const openA=document.createElement('a'); openA.className='ghost'; openA.href=f.url; openA.target='_blank'; openA.textContent='Open'; controls.appendChild(openA); if(isOwner){ const moveBtn=document.createElement('button'); moveBtn.className='ghost'; moveBtn.textContent='Move'; moveBtn.onclick=()=>moveFile(doc.id,f); controls.appendChild(moveBtn); const delBtn=document.createElement('button'); delBtn.className='danger'; delBtn.textContent='Delete'; delBtn.onclick=()=>deleteFile(doc.id,f); controls.appendChild(delBtn); } div.appendChild(controls); container.appendChild(div); }); });
    const notesDoc = await db.collection("rooms").doc(code).collection("meta").doc("notes").get(); if(notesDoc.exists) document.getElementById("notes").value = notesDoc.data().text || '';
  });
}

async function uploadFiles(){ const code=(qs("code")||"").toUpperCase(); const u = auth.currentUser; if(!u){ alert('Not authenticated'); return;} const input = document.getElementById("fileInput"); if(!input.files.length){ alert('Choose files'); return;} const folder = (u.displayName||u.email||'user').replace(/[^a-z0-9_\-\.]/gi,'_'); for(const file of input.files){ const path = `rooms/${code}/${folder}/${Date.now()}_${file.name}`; const ref = storage.ref().child(path); await ref.put(file); const url = await ref.getDownloadURL(); await db.collection("rooms").doc(code).collection("files").add({ filename:file.name, url, size:file.size, contentType:file.type||'application/octet-stream', uploader:{uid:u.uid, name:u.displayName||u.email||'user'}, folder, path, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } input.value=''; }

async function moveFile(docId,f){ const code=(qs("code")||"").toUpperCase(); const newFolder = prompt("Move to folder:", f.folder); if(!newFolder||newFolder===f.folder) return; const oldRef = storage.ref().child(f.path); const blob = await oldRef.getDownloadURL().then(u=>fetch(u)).then(r=>r.blob()); const newPath = `rooms/${code}/${newFolder}/${Date.now()}_${f.filename}`; const newRef = storage.ref().child(newPath); await newRef.put(blob, {contentType:f.contentType}); const newUrl = await newRef.getDownloadURL(); await db.collection("rooms").doc(code).collection("files").doc(docId).update({path:newPath,url:newUrl,folder:newFolder}); await oldRef.delete().catch(()=>{}); }

async function deleteFile(docId,f){ if(!confirm("Delete this file?")) return; await storage.ref().child(f.path).delete().catch(()=>{}); await db.collection("rooms").doc((qs("code")||"").toUpperCase()).collection("files").doc(docId).delete(); }

async function saveNotes(){ const code=(qs("code")||"").toUpperCase(); const text=document.getElementById("notes").value; await db.collection("rooms").doc(code).collection("meta").doc("notes").set({text}); const info=document.getElementById("saveInfo"); info.textContent='Saved ✓'; setTimeout(()=>info.textContent='',1200); }

function logout(){ auth.signOut(); location.href='index.html'; }
document.addEventListener("DOMContentLoaded", ()=>{ setTheme(getTheme()); applyI18n(); });
