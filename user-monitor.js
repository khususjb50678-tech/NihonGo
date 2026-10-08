import { supabase, sbReady } from './supabase.js';

let timer = null;
let started = false;
let deviceCache = '';
let lastActivityKey = '';
let lastActivityAt = 0;
const onVisible=()=>{if(!document.hidden)heartbeat();};

export function deviceLabel(){
  if(deviceCache) return deviceCache;
  const ua=navigator.userAgent||'';
  const os=/Android/i.test(ua)?'Android':/iPhone|iPad|iPod/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Mac OS X/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'Perangkat';
  const browser=/Edg\//i.test(ua)?'Edge':/OPR\//i.test(ua)?'Opera':/SamsungBrowser/i.test(ua)?'Samsung Internet':/Chrome\//i.test(ua)?'Chrome':/Firefox\//i.test(ua)?'Firefox':/Safari\//i.test(ua)&&!/Chrome\//i.test(ua)?'Safari':'Browser';
  deviceCache=`${os} · ${browser}`;
  return deviceCache;
}

const pageName=()=>location.hash.slice(1)||'home';

export async function recordActivity(action, detail={}){
  if(!sbReady||!started)return;
  const key=`${action}|${pageName()}|${JSON.stringify(detail)}`;
  const now=Date.now();
  if(key===lastActivityKey && now-lastActivityAt<2500)return;
  lastActivityKey=key; lastActivityAt=now;
  try{ await supabase.rpc('record_user_activity',{p_action:action,p_detail:detail,p_page:pageName(),p_device:deviceLabel()}); }catch{}
}

async function heartbeat(){
  if(!sbReady||!started)return;
  try{await supabase.rpc('record_user_presence',{p_page:pageName(),p_device:deviceLabel()});}catch{}
}

export async function startUserMonitor({login=false}={}){
  if(!sbReady)return;
  if(timer)clearInterval(timer);
  started=true;
  if(login){
    try{await supabase.rpc('record_user_login',{p_device:deviceLabel(),p_page:pageName()});}catch{}
  }else await heartbeat();
  if(login)recordActivity('login',{device:deviceLabel()});
  timer=setInterval(heartbeat,15000);
  document.removeEventListener('visibilitychange',onVisible);
  document.addEventListener('visibilitychange',onVisible);
}

export async function stopUserMonitor({logout=false}={}){
  if(timer)clearInterval(timer);
  timer=null;
  document.removeEventListener('visibilitychange',onVisible);
  if(logout&&sbReady&&started){try{await supabase.rpc('record_user_logout');}catch{}}
  started=false;
}
