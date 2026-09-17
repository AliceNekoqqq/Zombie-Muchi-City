import { initCore, autoRefresh } from './core.js';
import { installUi, mountInline, refreshInlineSoon } from './ui.js';

(async()=>{
  try{
    await initCore();
    installUi();

    try{
      if(typeof eventOn==='function' && typeof tavern_events!=='undefined'){
        if(tavern_events.MESSAGE_RECEIVED) eventOn(tavern_events.MESSAGE_RECEIVED,()=>{refreshInlineSoon();setTimeout(()=>autoRefresh(),850)});
        if(tavern_events.MESSAGE_EDITED) eventOn(tavern_events.MESSAGE_EDITED,()=>refreshInlineSoon());
        if(tavern_events.MESSAGE_DELETED) eventOn(tavern_events.MESSAGE_DELETED,()=>refreshInlineSoon());
        if(tavern_events.CHAT_CHANGED) eventOn(tavern_events.CHAT_CHANGED,()=>setTimeout(mountInline,220));
      }
    }catch(e){console.warn('[MR-87] event binding',e)}

    const observer=new MutationObserver(()=>{
      clearTimeout(window.__mr87MountTimer);
      window.__mr87MountTimer=setTimeout(mountInline,140);
    });
    const chat=document.querySelector('#chat');
    if(chat) observer.observe(chat,{childList:true,subtree:true});

    window.MuchiRadio={openSettings:()=>document.querySelector('[data-r-action="settings"]')?.click(),mount:mountInline};
  }catch(err){
    console.error('[MR-87] init failed',err);
    try{toastr?.error?.(`MR-87 初始化失败：${err?.message||err}`)}catch{}
  }
})();
