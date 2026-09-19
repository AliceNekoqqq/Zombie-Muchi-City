import { store, channels, latest, byId, displayForMessage, switchChannel, cycle, generate, rerollTodayIntel, canRerollToday, getIntelUiState, clearHistory, clickSound, noise, save, setApiKey, getApiKey, setRenderer, isBusy, canCancelGeneration, cancelActiveGeneration, getActiveRequest, getProxyPresets, fetchModelList, generationCapabilities } from './core.js';

const ROOT='swz-inline-radio';
const SETTINGS='swz-radio-settings';
const SETTINGS_FRAME='swz-radio-settings-frame-v190';
const STYLE='swz-radio-style-v190';
const INLINE_CLASS='swz-mr87-inline';

function resolveTavernDocument(){
  /* Tavern Helper 脚本在后台 iframe 中运行；官方约定 window.$ 指向酒馆主页面。
   * 用 jQuery 返回节点的 ownerDocument 定位酒馆页面，不再向 top 逐层猜宿主。 */
  try{
    const body=globalThis.$?.('body')?.[0];
    if(body?.ownerDocument)return body.ownerDocument;
  }catch(_){}
  try{if(window.parent?.document?.body)return window.parent.document}catch(_){}
  return document;
}
const RDOC=resolveTavernDocument();
const RH=RDOC.defaultView||window.parent||window;
let forceShow=false,forceBroadcastId='';
let modelCache=[],modelCacheUrl='';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function styleUrl(){return new URL('./style.css',import.meta.url).href;}
function radioBackdropUrl(){return new URL('../Assets/MR87_backdrop.png',import.meta.url).href;}
function ensureStyle(){if(RDOC.getElementById(STYLE))return;const link=RDOC.createElement('link');link.id=STYLE;link.rel='stylesheet';link.href=styleUrl();RDOC.head.appendChild(link)}
function settingsCss(){return `
#${SETTINGS}.mrs-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none;align-items:center!important;justify-content:center!important;padding:18px!important;overflow:hidden!important;background:rgba(3,4,6,.48)!important;color:#f0ece6!important;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif!important;line-height:normal!important;text-align:left!important;pointer-events:auto!important;backdrop-filter:blur(5px)!important}
#${SETTINGS}.mrs-overlay.mrs-open{display:flex!important}
#${SETTINGS},#${SETTINGS} *{box-sizing:border-box!important}
#${SETTINGS} button,#${SETTINGS} input,#${SETTINGS} select,#${SETTINGS} textarea{font:inherit!important}
#${SETTINGS} .mrs-panel{position:relative!important;isolation:isolate!important;width:min(860px,calc(100vw - 36px))!important;height:min(720px,calc(100vh - 36px))!important;max-height:calc(100vh - 36px)!important;display:grid!important;grid-template-rows:72px minmax(0,1fr) 58px!important;overflow:hidden!important;border:1px solid rgba(233,217,196,.18)!important;border-radius:26px!important;background:rgba(11,13,16,.26)!important;color:#f0ece6!important;box-shadow:0 34px 100px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)!important}
#${SETTINGS} .mrs-scene-image{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center 56%!important;z-index:-3!important;opacity:.74!important;filter:saturate(.82) contrast(1.03) brightness(.78)!important;pointer-events:none!important}
#${SETTINGS} .mrs-scene-shade{position:absolute!important;inset:0!important;z-index:-2!important;background:linear-gradient(90deg,rgba(8,10,13,.83) 0 23%,rgba(7,9,12,.46) 46%,rgba(8,10,13,.72) 100%),linear-gradient(180deg,rgba(7,9,11,.25),rgba(7,9,11,.62))!important;pointer-events:none!important}
#${SETTINGS} .mrs-title{position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:0 18px 0 22px!important;border-bottom:1px solid rgba(235,218,197,.14)!important;background:rgba(10,12,15,.54)!important;cursor:grab!important;user-select:none!important;-webkit-user-select:none!important;touch-action:none!important;backdrop-filter:blur(14px)!important}
#${SETTINGS}.mrs-dragging .mrs-title{cursor:grabbing!important}
#${SETTINGS} .mrs-title-copy{min-width:0!important}
#${SETTINGS} .mrs-title-kicker{display:block!important;margin-bottom:5px!important;color:#a8947d!important;font-size:7px!important;letter-spacing:.22em!important;text-transform:uppercase!important}
#${SETTINGS} .mrs-title b{display:block!important;font-family:"Noto Serif SC","Songti SC",serif!important;font-size:18px!important;font-weight:520!important;letter-spacing:.08em!important;color:#f4eee7!important}
#${SETTINGS} .mrs-title span:not(.mrs-title-kicker){display:block!important;margin-top:4px!important;color:#9a9a96!important;font-size:8px!important;letter-spacing:.04em!important}
#${SETTINGS} .mrs-close{appearance:none!important;width:38px!important;height:38px!important;padding:0!important;border:1px solid rgba(235,218,197,.15)!important;border-radius:12px!important;background:rgba(14,17,20,.50)!important;color:#c9c1b7!important;font-size:19px!important;line-height:36px!important;text-align:center!important;cursor:pointer!important;backdrop-filter:blur(8px)!important}
#${SETTINGS} .mrs-close:hover{border-color:rgba(190,142,151,.33)!important;background:rgba(91,54,63,.28)!important;color:#f0dfe3!important}
#${SETTINGS} .mrs-workspace{min-height:0!important;display:grid!important;grid-template-columns:176px minmax(0,1fr)!important}
#${SETTINGS} .mrs-side{min-height:0!important;display:flex!important;flex-direction:column!important;padding:16px 12px!important;border-right:1px solid rgba(235,218,197,.12)!important;background:rgba(8,10,13,.44)!important;backdrop-filter:blur(12px)!important}
#${SETTINGS} .mrs-side-brand{padding:3px 8px 14px!important;border-bottom:1px solid rgba(235,218,197,.10)!important}
#${SETTINGS} .mrs-side-brand strong{display:block!important;font-family:"Noto Serif SC","Songti SC",serif!important;color:#e8dfd4!important;font-size:12px!important;font-weight:520!important;letter-spacing:.08em!important}
#${SETTINGS} .mrs-side-brand small{display:block!important;margin-top:5px!important;color:#747b7c!important;font-size:7px!important;line-height:1.6!important;letter-spacing:.10em!important}
#${SETTINGS} .mrs-tabs{display:grid!important;grid-template-columns:1fr!important;gap:6px!important;margin-top:14px!important;padding:0!important;overflow:visible!important;background:none!important;border:0!important}
#${SETTINGS} .mrs-tabs button{appearance:none!important;width:100%!important;min-height:42px!important;padding:0 12px!important;border:1px solid transparent!important;border-radius:11px!important;background:transparent!important;color:#92918d!important;text-align:left!important;font-size:9px!important;letter-spacing:.04em!important;cursor:pointer!important;transition:.16s ease!important}
#${SETTINGS} .mrs-tabs button:hover{color:#e1dad1!important;background:rgba(255,255,255,.035)!important}
#${SETTINGS} .mrs-tabs button.active{border-color:rgba(170,204,199,.18)!important;background:linear-gradient(90deg,rgba(77,107,105,.27),rgba(77,107,105,.08))!important;color:#edf2ee!important;box-shadow:inset 2px 0 0 #94bbb8!important}
#${SETTINGS} .mrs-side-note{margin-top:auto!important;padding:12px 10px 4px!important;color:#7d7f7d!important;font-family:"Noto Serif SC","Songti SC",serif!important;font-size:8px!important;line-height:1.8!important;letter-spacing:.04em!important}
#${SETTINGS} .mrs-side-note::before{content:""!important;display:block!important;width:26px!important;height:1px!important;margin-bottom:10px!important;background:#a97d58!important;opacity:.55!important}
#${SETTINGS} .mrs-content{min-height:0!important;overflow:auto!important;padding:16px!important;overscroll-behavior:contain!important;scrollbar-width:thin!important;background:rgba(10,12,15,.18)!important}
#${SETTINGS} .mrs-page{display:none!important;grid-template-columns:1fr 1fr!important;gap:12px!important}
#${SETTINGS} .mrs-page.active{display:grid!important}
#${SETTINGS} .mrs-card{padding:16px!important;border:1px solid rgba(235,218,197,.12)!important;border-radius:16px!important;background:linear-gradient(180deg,rgba(17,20,24,.66),rgba(10,13,16,.62))!important;color:#eee8df!important;backdrop-filter:blur(14px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}
#${SETTINGS} .mrs-card.mrs-full{grid-column:1/-1!important}
#${SETTINGS} .mrs-card h3{display:flex!important;align-items:center!important;gap:7px!important;margin:0 0 13px!important;font-family:"Noto Serif SC","Songti SC",serif!important;font-size:12px!important;font-weight:560!important;letter-spacing:.06em!important;color:#f0e7dc!important}
#${SETTINGS} .mrs-card h3::before{content:""!important;width:2px!important;height:13px!important;border-radius:2px!important;background:linear-gradient(180deg,#c79a70,#9b6d75)!important}
#${SETTINGS} .mrs-card p{margin:8px 0 0!important;color:#878d8d!important;font-size:8px!important;line-height:1.75!important}
#${SETTINGS} .mrs-card label{display:block!important;margin-top:11px!important;color:#a09d98!important;font-size:8px!important;line-height:1.45!important}
#${SETTINGS} .mrs-card input:not([type=checkbox]):not([type=range]),#${SETTINGS} .mrs-card select,#${SETTINGS} .mrs-card textarea{appearance:auto!important;width:100%!important;margin-top:6px!important;padding:10px 11px!important;border:1px solid rgba(235,218,197,.13)!important;border-radius:10px!important;background:rgba(5,7,9,.63)!important;color:#e2dcd4!important;outline:none!important;font-size:9px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.015)!important}
#${SETTINGS} .mrs-card input:focus,#${SETTINGS} .mrs-card select:focus,#${SETTINGS} .mrs-card textarea:focus{border-color:rgba(148,187,184,.34)!important;box-shadow:0 0 0 2px rgba(148,187,184,.07)!important}
#${SETTINGS} .mrs-card textarea{min-height:78px!important;resize:vertical!important;line-height:1.7!important}
#${SETTINGS} .mrs-card input[type=range]{width:100%!important;margin-top:8px!important;accent-color:#94bbb8!important}
#${SETTINGS} .mrs-check{display:flex!important;align-items:center!important;gap:8px!important;line-height:1.5!important}
#${SETTINGS} .mrs-check input{margin:0!important;accent-color:#94bbb8!important}
#${SETTINGS} .mrs-card em{font-style:normal!important;color:#d3b18d!important}
#${SETTINGS} .mrs-actions{margin-top:11px!important}
#${SETTINGS} .mrs-actions button,#${SETTINGS} .mrs-footer button,#${SETTINGS} .mrs-mini-btn{appearance:none!important;padding:9px 12px!important;border:1px solid rgba(235,218,197,.14)!important;border-radius:10px!important;background:rgba(18,21,24,.60)!important;color:#c8c0b6!important;font-size:8px!important;cursor:pointer!important}
#${SETTINGS} .mrs-actions button:hover,#${SETTINGS} .mrs-footer button:hover,#${SETTINGS} .mrs-mini-btn:hover{border-color:rgba(199,154,112,.30)!important;background:rgba(34,31,30,.72)!important;color:#f1e7db!important}
#${SETTINGS} .mrs-footer{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:9px 14px!important;border-top:1px solid rgba(235,218,197,.11)!important;background:rgba(8,10,13,.55)!important;backdrop-filter:blur(14px)!important}
#${SETTINGS} .mrs-footer-note{color:#777e7f!important;font-size:7px!important;letter-spacing:.08em!important}
#${SETTINGS} .mrs-footer-actions{display:flex!important;gap:8px!important}
#${SETTINGS} .mrs-footer .mrs-primary{border-color:rgba(148,187,184,.26)!important;background:linear-gradient(180deg,rgba(62,94,91,.46),rgba(25,40,40,.60))!important;color:#ecf2ee!important}
#${SETTINGS} .mrs-mode-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:9px!important;margin-top:8px!important}
#${SETTINGS} .mrs-mode-option{position:relative!important;display:block!important;margin:0!important;cursor:pointer!important}
#${SETTINGS} .mrs-mode-option input{position:absolute!important;opacity:0!important;pointer-events:none!important}
#${SETTINGS} .mrs-mode-option span{display:block!important;min-height:86px!important;padding:12px!important;border:1px solid rgba(235,218,197,.11)!important;border-radius:13px!important;background:rgba(7,9,11,.48)!important;transition:.16s ease!important}
#${SETTINGS} .mrs-mode-option b{display:block!important;color:#d4ccc2!important;font-size:10px!important;font-weight:600!important}
#${SETTINGS} .mrs-mode-option small{display:block!important;margin-top:6px!important;color:#7f8686!important;font-size:7px!important;line-height:1.6!important}
#${SETTINGS} .mrs-mode-option.active span{border-color:rgba(148,187,184,.29)!important;background:linear-gradient(180deg,rgba(52,78,78,.34),rgba(16,24,26,.44))!important;box-shadow:inset 0 0 0 1px rgba(148,187,184,.04)!important}
#${SETTINGS} .mrs-engine-shell{margin-top:12px!important}
#${SETTINGS} .mrs-engine{display:none!important;grid-template-columns:1fr 1fr!important;gap:10px!important;padding:12px!important;border:1px solid rgba(235,218,197,.09)!important;border-radius:13px!important;background:rgba(6,8,10,.38)!important}
#${SETTINGS} .mrs-engine.active{display:grid!important}
#${SETTINGS} .mrs-engine .mrs-wide{grid-column:1/-1!important}
#${SETTINGS} .mrs-source-note{display:grid!important;grid-template-columns:auto 1fr!important;gap:11px!important;align-items:start!important;padding:11px!important;border:1px dashed rgba(148,187,184,.17)!important;border-radius:10px!important;background:rgba(148,187,184,.045)!important}
#${SETTINGS} .mrs-source-note strong{color:#d9e6e1!important;font-size:9px!important}.mrs-source-note span{color:#888f8e!important;font-size:8px!important;line-height:1.6!important}
#${SETTINGS} .mrs-field-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:end!important}
#${SETTINGS} .mrs-status{padding:8px 10px!important;border-radius:9px!important;background:rgba(255,255,255,.025)!important;color:#858b8a!important;font-size:8px!important;line-height:1.5!important}
#${SETTINGS} .mrs-status.ok{color:#9fc5bd!important;background:rgba(72,111,104,.10)!important}#${SETTINGS} .mrs-status.warn{color:#d4a788!important;background:rgba(121,78,49,.10)!important}
#${SETTINGS} .mrs-sampling-fields{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;margin-top:8px!important}
#${SETTINGS} .mrs-hidden{display:none!important}
#${SETTINGS} .mrs-help{position:relative!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:17px!important;height:17px!important;padding:0!important;border:1px solid rgba(235,218,197,.18)!important;border-radius:50%!important;background:rgba(8,10,13,.65)!important;color:#aaa39b!important;font-style:normal!important;font-size:8px!important;cursor:help!important}
#${SETTINGS} .mrs-help::after{content:attr(data-tip)!important;position:absolute!important;z-index:50!important;right:-4px!important;bottom:calc(100% + 8px)!important;width:245px!important;max-width:70vw!important;padding:10px 11px!important;border:1px solid rgba(235,218,197,.15)!important;border-radius:10px!important;background:rgba(12,14,17,.97)!important;color:#c9c3bb!important;font-size:8px!important;line-height:1.65!important;text-align:left!important;white-space:normal!important;box-shadow:0 18px 42px rgba(0,0,0,.42)!important;opacity:0!important;pointer-events:none!important;transform:translateY(4px)!important;transition:.14s ease!important}
#${SETTINGS} .mrs-help:hover::after,#${SETTINGS} .mrs-help:focus::after{opacity:1!important;transform:none!important}

/* v1.9.0 physical receiver rebuild */
#${SETTINGS}.mrs-overlay{background:rgba(3,4,6,.34)!important;backdrop-filter:blur(3px)!important}
#${SETTINGS} .mrs-panel{width:min(760px,calc(100vw - 34px))!important;height:min(650px,calc(100vh - 34px))!important;grid-template-rows:62px minmax(0,1fr) 52px!important;background:rgba(12,15,18,.34)!important;border-color:rgba(235,218,197,.22)!important}
#${SETTINGS} .mrs-scene-image{opacity:.96!important;filter:saturate(.98) contrast(1.07) brightness(.95)!important;object-position:center 60%!important}
#${SETTINGS} .mrs-scene-shade{background:radial-gradient(ellipse at 62% 35%,rgba(4,6,8,.08),rgba(4,6,8,.24) 60%,rgba(4,6,8,.42))!important}
#${SETTINGS} .mrs-title{background:linear-gradient(90deg,rgba(10,12,14,.88),rgba(10,12,14,.62))!important;padding:0 14px 0 18px!important}
#${SETTINGS} .mrs-close,#${SETTINGS} .mrs-tabs button,#${SETTINGS} .mrs-actions button,#${SETTINGS} .mrs-footer button,#${SETTINGS} .mrs-mini-btn{background:linear-gradient(180deg,#30363a,#1d2225)!important;border-color:#4d5457!important;color:#e0d9d0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 2px 0 #101214!important}
#${SETTINGS} .mrs-tabs button.active{background:linear-gradient(180deg,#344341,#263130)!important;border-color:#6f8e8a!important;color:#f1eee9!important;box-shadow:inset 2px 0 0 #9cc6c0,0 2px 0 #101214!important}
#${SETTINGS} .mrs-content{padding:12px!important;background:rgba(10,12,15,.10)!important}
#${SETTINGS} .mrs-card{padding:13px!important;background:linear-gradient(180deg,rgba(25,29,33,.92),rgba(15,18,21,.94))!important;border-color:rgba(235,218,197,.15)!important;backdrop-filter:none!important}
#${SETTINGS} .mrs-card input:not([type=checkbox]):not([type=range]),#${SETTINGS} .mrs-card select,#${SETTINGS} .mrs-card textarea{background:#111519!important;border-color:#3f4649!important;color:#eee8e0!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.25)!important}
#${SETTINGS} .mrs-mode-option span{min-height:72px!important;background:linear-gradient(180deg,#24292d,#191e21)!important;border-color:#41484b!important}
#${SETTINGS} .mrs-mode-option.active span{background:linear-gradient(180deg,#344341,#25302f)!important;border-color:#6c8986!important}
#${SETTINGS} .mrs-footer .mrs-primary{background:linear-gradient(180deg,#ddd7ce,#bdb6ad)!important;border-color:#b5aea5!important;color:#17191b!important;font-weight:700!important;box-shadow:inset 0 1px 0 #fff,0 2px 0 #77716b!important}
#${SETTINGS} .mrs-page{gap:10px!important}
#${SETTINGS} .mrs-card label{margin-top:9px!important}
@media(max-width:760px){
  #${SETTINGS}.mrs-overlay{padding:0!important;background:rgba(3,4,6,.78)!important}
  #${SETTINGS} .mrs-panel{width:100vw!important;height:100vh!important;max-height:100vh!important;border:0!important;border-radius:0!important;grid-template-rows:56px minmax(0,1fr) 50px!important}
  #${SETTINGS} .mrs-title{padding:0 12px 0 14px!important;cursor:default!important}
  #${SETTINGS} .mrs-title b{font-size:15px!important}
  #${SETTINGS} .mrs-workspace{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:auto minmax(0,1fr)!important}
  #${SETTINGS} .mrs-side{display:block!important;padding:8px!important;border-right:0!important;border-bottom:1px solid rgba(235,218,197,.11)!important;background:rgba(8,10,13,.62)!important}
  #${SETTINGS} .mrs-side-brand,#${SETTINGS} .mrs-side-note{display:none!important}
  #${SETTINGS} .mrs-tabs{display:flex!important;gap:5px!important;margin:0!important;overflow-x:auto!important}
  #${SETTINGS} .mrs-tabs button{flex:1 0 68px!important;min-height:32px!important;padding:0 7px!important;text-align:center!important}
  #${SETTINGS} .mrs-tabs button.active{box-shadow:inset 0 -2px 0 #94bbb8!important}
  #${SETTINGS} .mrs-content{padding:7px!important}
  #${SETTINGS} .mrs-page,#${SETTINGS} .mrs-page.active{grid-template-columns:1fr!important}
  #${SETTINGS} .mrs-card.mrs-full{grid-column:auto!important}
  #${SETTINGS} .mrs-mode-grid{grid-template-columns:1fr!important}
  #${SETTINGS} .mrs-engine.active{grid-template-columns:1fr!important}
  #${SETTINGS} .mrs-engine .mrs-wide{grid-column:auto!important}
  #${SETTINGS} .mrs-footer-note{display:none!important}
  #${SETTINGS} .mrs-footer{justify-content:flex-end!important}
}
`; }
function getSettingsFrame(){return RDOC.getElementById(SETTINGS_FRAME)}
function getSettingsDoc(){try{return getSettingsFrame()?.contentDocument||null}catch{return null}}
function getSettingsOverlay(){return getSettingsDoc()?.getElementById(SETTINGS)||null}
function cleanupLegacySettings(){
  try{RDOC.getElementById(SETTINGS_FRAME)?.remove()}catch{}
  try{RDOC.querySelectorAll('[id^="swz-radio-settings-host-v"],[id^="swz-radio-settings-frame-v"]').forEach(el=>el.remove())}catch{}
  try{RDOC.getElementById('swz-radio-settings')?.remove()}catch{}
}
function ensureSettingsMount(){
  const existing=getSettingsOverlay();if(existing)return existing;
  cleanupLegacySettings();
  const frame=RDOC.createElement('iframe');
  frame.id=SETTINGS_FRAME;
  frame.setAttribute('frameborder','0');
  frame.setAttribute('title','MR-87 收音机设置');
  frame.style.cssText='position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;margin:0!important;padding:0!important;z-index:2147483647!important;background:transparent!important;display:block!important;';
  (RDOC.body||RDOC.documentElement).appendChild(frame);
  const doc=frame.contentDocument;
  if(!doc)throw Error('设置 iframe 无法访问');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:transparent!important}</style><style>${settingsCss()}</style></head><body>${settingsHtml()}</body></html>`);
  doc.close();
  const r=doc.getElementById(SETTINGS);
  if(!r)throw Error('设置界面创建失败');
  bindSettings();
  doc.addEventListener('keydown',e=>{if(e.key==='Escape')closeSettings()});
  return r;
}


function getLatestAssistantMessage(){
  const selectors=['#chat .mes[is_user="false"]','#chat .mes:not([is_user="true"])','#chat .mes'];
  for(const sel of selectors){
    const nodes=[...RDOC.querySelectorAll(sel)].filter(el=>el.getAttribute('is_user')!=='true'&&el.getAttribute('data-message-role')!=='user');
    if(nodes.length)return nodes[nodes.length-1];
  }
  return null;
}
function getMessageId(mes){return String(mes?.getAttribute('mesid')??mes?.dataset?.messageId??mes?.dataset?.mesid??'')}
function getMessageContentHost(mes){return mes?.querySelector('.mes_text')||mes?.querySelector('.mes_block')||mes||null}

function inlineHtml(){return `<section id="${ROOT}" class="${INLINE_CLASS}" aria-label="MR-87便携收音机">
  <div class="mr87-brief" data-r-action="toggle" role="button" tabindex="0">
    <img class="mr87-brief-bg" src="${radioBackdropUrl()}" alt="" aria-hidden="true">
    <div class="mr87-brief-shade"></div>
    <div class="mr87-brief-mark"><i class="mr87-power-led"></i><b>MR-87</b></div>
    <div class="mr87-brief-station"><span class="mr87-brief-channel">暮迟市</span><small class="mr87-brief-freq">FM 88.7</small></div>
    <div class="mr87-brief-copy"><strong class="mr87-brief-headline">等待接收</strong><span class="mr87-brief-summary">当前没有新的广播。</span></div>
    <div class="mr87-brief-side"><span class="mr87-brief-signal">▮▮▮▯</span><time class="mr87-brief-time">--:--</time><button data-r-action="toggle" class="mr87-expand">展开</button></div>
  </div>

  <div class="mr87-drawer">
    <img class="mr87-scene-bg" src="${radioBackdropUrl()}" alt="" aria-hidden="true">
    <div class="mr87-scene-vignette"></div>

    <header class="mr87-topline">
      <div class="mr87-brand"><small>MR-87 / FIELD RECEIVER</small><b>废墟电波</b><span>暮迟市幸存者接收终端</span></div>
      <div class="mr87-status"><i class="mr87-power-led"></i><span>仍在监听</span><button class="mr87-gear" data-r-action="settings" title="收音机设置">⚙</button><button class="mr87-collapse-top" data-r-action="collapse" title="收起">⌄</button></div>
    </header>

    <div class="mr87-workspace">
      <section class="mr87-radio-shell">
        <div class="mr87-tuner-deck">
          <div class="mr87-tuner-brand"><b>MR-87</b><small>EMERGENCY RECEIVER</small></div>
          <div class="mr87-tuner-window">
            <div class="mr87-scale-labels"><span>SW</span><span>MW</span><span>FM</span><span>87</span><span>92</span><span>98</span><span>104</span><span>108</span></div>
            <div class="mr87-scale-track"><i></i></div>
            <div class="mr87-readout"><span class="mr87-freq">88.7</span><span class="mr87-band">FM</span><small class="mr87-station">暮迟市 · MU CHI</small></div>
          </div>
          <div class="mr87-tuner-signal"><div class="mr87-bars"></div><small class="mr87-signal-text">一般</small></div>
        </div>

        <div class="mr87-main-deck">
          <aside class="mr87-speaker-side">
            <div class="mr87-speaker-grille" aria-hidden="true">
              <div class="mr87-speaker-badge"><span>MR-87</span><small>KEEP LISTENING</small></div>
            </div>
            <section class="mr87-channel-panel">
              <div class="mr87-section-label"><span>频道预设</span><small>PRESET</small></div>
              <div class="mr87-presets">
                <button data-r-channel="global"><em>SW</em><b>全球</b><small>WORLD</small><i></i></button>
                <button data-r-channel="china"><em>SW</em><b>中国</b><small>CHINA</small><i></i></button>
                <button data-r-channel="muchi"><em>FM</em><b>暮迟</b><small>MUCHI</small><i></i></button>
              </div>
            </section>
          </aside>

          <main class="mr87-screen-side">
            <section class="mr87-broadcast-card">
              <div class="mr87-screen-caption"><span>CURRENT BROADCAST</span><i>ON AIR</i></div>
              <div class="mr87-meta"><span class="mr87-time">--</span><span class="mr87-source">暂无广播</span></div>
              <div class="mr87-headline">等待接收</div>
              <div class="mr87-transcript">当前频道还没有广播记录。</div>
              <div class="mr87-impact"></div>
              <div class="mr87-broadcast-signature"><span>MR-87 / STILL LISTENING</span><i></i></div>
            </section>

            <section class="mr87-request-panel">
              <div class="mr87-request-copy"><span>本次拉取</span><button class="mr87-help" type="button" data-help data-tip="这里只决定下一次手动接收要生成哪些频道；可同时选择多个频道，所选频道仍合并成一次 API 请求，不改变当前正在收听的频段。" aria-label="手动拉取频道说明">?</button></div>
              <div class="mr87-request-channels"><button type="button" data-r-request-channel="global" aria-pressed="false"><i></i>全球</button><button type="button" data-r-request-channel="china" aria-pressed="false"><i></i>中国</button><button type="button" data-r-request-channel="muchi" aria-pressed="true"><i></i>暮迟</button></div>
              <button class="mr87-receive" data-r-action="receive">接收新播报</button>
            </section>

            <section class="mr87-intel-card">
              <div class="mr87-intel-copy"><small>MAP INTEL</small><b>地图情报</b><span data-r-intel-status>今日未结算</span></div>
              <button class="mr87-reroll" data-r-action="reroll">重Roll今日情报</button>
              <button class="mr87-help" type="button" data-help data-tip="恢复到今日结算前的地图情报基线，重新生成暮迟市广播与地图情报，并覆盖上一版；不会叠加数值，也不受每日一次结算限制。已生成的旧正文不会自动改写。" aria-label="重Roll说明">?</button>
            </section>
          </main>
        </div>

        <div class="mr87-control-deck">
          <section class="mr87-device-panel">
            <div class="mr87-funcs">
              <button class="mr87-cosmetic" data-r-action="power"><span>◈</span><em>电源</em></button>
              <button class="mr87-cosmetic" data-r-action="mute"><span>◌</span><em>静音</em></button>
              <button class="mr87-cosmetic" data-r-action="light"><span>✦</span><em>背光</em></button>
              <button class="mr87-cosmetic" data-r-action="hold"><span>⟐</span><em>锁定</em></button>
              <button class="mr87-utility" data-r-action="log"><span>☰</span><em>记录</em></button>
            </div>
          </section>

          <section class="mr87-nav-panel">
            <div class="mr87-knob-wrap"><button class="mr87-knob mr87-tune" data-r-action="tune"></button><small>调谐</small></div>
            <div class="mr87-keys"><button data-r-action="prev">←</button><button data-r-action="scan">扫频</button><button data-r-action="next">→</button></div>
            <div class="mr87-knob-wrap"><button class="mr87-knob mr87-volume" data-r-action="volume"></button><small>音量 <span class="mr87-volume-num">48</span></small></div>
          </section>

          <section class="mr87-shortcuts">
            <button data-r-action="log"><span>广播记录</span><i>›</i></button>
            <button data-r-action="settings"><span>设置</span><i>›</i></button>
          </section>
        </div>
      </section>
    </div>

    <div class="mr87-log-drawer"><div class="mr87-log-head"><b>广播记录</b><span>最近接收</span></div><div class="mr87-log-list"></div></div>
    <footer class="mr87-foot"><span>MR-87 RADIO · 87.4 MHz</span><span class="mr87-version">有些声音，依然穿过废墟抵达你。</span></footer>
  </div>
</section>`;}
function settingsHtml(){return `<div id="${SETTINGS}" class="mrs-overlay" aria-hidden="true" style="display:none"><div class="mrs-panel">
  <img class="mrs-scene-image" src="${radioBackdropUrl()}" alt="" aria-hidden="true"><div class="mrs-scene-shade"></div>
  <div class="mrs-title"><div class="mrs-title-copy"><span class="mrs-title-kicker">MR-87 / RECEIVER CONFIGURATION</span><b>收音机设置</b><span>广播生成、自动接收、剧情联动与设备显示</span></div><button class="mrs-close" type="button" data-s-action="close">×</button></div>
  <div class="mrs-workspace">
    <aside class="mrs-side">
      <div class="mrs-side-brand"><strong>废墟电波 · 工作台</strong><small>不是所有声音都需要相信。<br>但每一个回应，都说明还有人活着。</small></div>
      <nav class="mrs-tabs"><button type="button" data-s-tab="general" class="active">内容与随机性</button><button type="button" data-s-tab="engine">生成 API</button><button type="button" data-s-tab="auto">自动接收</button><button type="button" data-s-tab="story">剧情联动</button><button type="button" data-s-tab="display">显示与设备</button></nav>
      <div class="mrs-side-note">让工具服务于氛围，而不是抢走故事本身。</div>
    </aside>
    <main class="mrs-content">
      <div class="mrs-page active" data-s-page="general">
        <section class="mrs-card"><h3>内容导演 <i class="mrs-help" tabindex="0" data-tip="随机性由脚本先抽取事件类型、区域、稀有度、播报形式、可靠度、人味插播和连续事件，再交给模型写成广播；不是单纯提高温度。">?</i></h3><label>广播多样性<select name="diversity"><option value="steady">稳健 · 更多连续性，稀有事件很少</option><option value="natural">自然 · 推荐</option><option value="rich">丰富 · 更积极换事件与形式</option><option value="chaotic">混乱 · 更多传闻与非常规频段</option></select></label><label>人味插播概率 <em data-s-value="civilian">34%</em><input name="civilian" type="range" min="0" max="80"></label><label class="mrs-check"><input name="songRequests" type="checkbox">允许幸存者点歌 / 留言 <i class="mrs-help" tabindex="0" data-tip="点歌会随机出现歌名、歌手、点播对象和留言，也可能使用虚构歌曲；它属于生活内容，不会单独改变地图情报。">?</i></label><label class="mrs-check"><input name="storyArcs" type="checkbox">允许连续事件弧 <i class="mrs-help" tabindex="0" data-tip="部分广播会在未来1—3个游戏日继续发展，例如车队失联、供电恢复、寻宠后续；不会保证每次都续写。">?</i></label><label>整体紧张度<select name="tension"><option value="calm">生活化 / 克制</option><option value="balanced">平衡</option><option value="tense">偏紧张</option></select></label><label class="mrs-check"><input name="repeatGuard" type="checkbox">近期广播重复保护</label><label>附加偏好<textarea name="extra"></textarea></label></section>
        <section class="mrs-card"><h3>记录与同步</h3><label>历史保留条数<input name="historyLimit" type="number" min="10" max="200"></label><label class="mrs-check"><input name="syncMvu" type="checkbox">最新摘要同步回 MVU</label><p>完整历史保存在脚本变量；MVU只保留三个频道的最新摘要与最近世界事件。</p></section>
      </div>
      <div class="mrs-page" data-s-page="engine">
        <section class="mrs-card mrs-full">
          <h3>生成来源 <i class="mrs-help" tabindex="0" data-tip="主预设直接跟随酒馆；代理预设使用酒馆已保存的代理连接；独立 API 只给 MR-87 使用，不改变正文模型。">?</i></h3>
          <div class="mrs-mode-grid"><label class="mrs-mode-option"><input type="radio" name="mode" value="main"><span><b>主预设</b><small>完全跟随当前酒馆连接与模型。最省心。</small></span></label><label class="mrs-mode-option"><input type="radio" name="mode" value="proxy"><span><b>代理预设</b><small>使用酒馆中已保存的代理预设，不暴露 URL / Key。</small></span></label><label class="mrs-mode-option"><input type="radio" name="mode" value="custom"><span><b>独立 API</b><small>只给 MR-87 使用，不改变主剧情 API。</small></span></label></div>
          <div class="mrs-engine-shell">
            <div class="mrs-engine" data-engine="main"><div class="mrs-source-note mrs-wide"><strong>跟随酒馆</strong><span>URL、Key、模型全部使用当前酒馆设置，因此这些字段会自动隐藏。默认也继承主预设采样参数。</span></div></div>
            <div class="mrs-engine" data-engine="proxy"><div class="mrs-field-row mrs-wide"><label>代理预设<select name="proxyPreset"></select></label><button type="button" class="mrs-mini-btn" data-s-action="refresh-proxies">刷新预设</button></div><div class="mrs-status mrs-wide" data-proxy-status></div><label class="mrs-check mrs-wide"><input name="proxyModelOverride" type="checkbox">覆盖代理预设中的模型</label><label class="mrs-wide" data-proxy-model-row>模型<input name="proxyModel" placeholder="仅在确实需要覆盖时填写"></label></div>
            <div class="mrs-engine mrs-engine-custom" data-engine="custom"><label>API 类型<select name="source"><option value="openai">OpenAI / OpenAI兼容</option><option value="openrouter">OpenRouter</option><option value="deepseek">DeepSeek</option><option value="xai">xAI</option><option value="claude">Claude</option><option value="makersuite">Google MakerSuite</option><option value="mistralai">Mistral</option><option value="groq">Groq</option><option value="custom">Custom</option></select></label><label>API URL<input name="apiUrl" placeholder="https://api.example.com/v1"></label><label>API Key<input name="apiKey" type="password" autocomplete="off" placeholder="不会发送给主剧情"></label><label class="mrs-check"><input name="rememberKey" type="checkbox">在本角色脚本变量中保存 Key</label><div class="mrs-field-row mrs-wide"><label>模型<input name="customModel" placeholder="手填模型，或先拉取列表"></label><button type="button" class="mrs-mini-btn" data-s-action="fetch-models">拉取模型</button></div><label class="mrs-wide mrs-model-pick-row mrs-hidden" data-model-pick-row>已拉取模型<select name="modelPick"><option value="">选择模型…</option></select></label><div class="mrs-status mrs-wide" data-model-status>拉取成功后会出现可下拉选择的模型列表；也可以直接手填。</div></div>
          </div>
        </section>
        <section class="mrs-card mrs-full"><h3>采样参数</h3><label class="mrs-check"><input name="inheritSampling" type="checkbox"><span data-sampling-label>沿用来源采样参数</span></label><div class="mrs-sampling-fields" data-sampling-fields><label>温度 <em data-s-value="temperature">0.85</em><input name="temperature" type="range" min="0" max="1.5" step="0.01"></label></div><p data-sampling-help></p></section>
      </div>
      <div class="mrs-page" data-s-page="auto"><section class="mrs-card mrs-full"><h3>自动接收 <i class="mrs-help" tabindex="0" data-tip="满足首次、跨日期、换地点或经过指定时间等条件时自动接收；同一轮需要多个频道会合并为一次 API 请求。">?</i></h3><label class="mrs-check"><input name="auto" type="checkbox">开启自动广播</label><label class="mrs-check"><input name="initialBroadcast" type="checkbox">首次生成前接收本地广播</label><label>世界时间至少经过（小时）<input name="hours" type="number" min="1" max="48"></label><label class="mrs-check"><input name="dateRefresh" type="checkbox">跨日期刷新</label><label class="mrs-check"><input name="locationRefresh" type="checkbox">换地点后优先刷新本地台</label><label>自动频道<select name="autoChannel"><option value="context">按情境选择</option><option value="current">只刷新当前频道</option><option value="rotate">三频道轮换</option></select></label></section></div>
      <div class="mrs-page" data-s-page="story"><section class="mrs-card mrs-full"><h3>剧情联动</h3><label class="mrs-check"><input name="injectStory" type="checkbox">广播先生成并注入本轮正文上下文 <i class="mrs-help" tabindex="0" data-tip="把刚收到的广播摘要一次性注入下一轮正文，使人物能自然听见；不会把整段广播反复塞进上下文。">?</i></label><label class="mrs-check"><input name="applyEvents" type="checkbox">暮迟市广播联动地图情报 <i class="mrs-help" tabindex="0" data-tip="地图显示的是玩家已知情报。每天最多自动结算一次，最多尝试两次；结算后普通广播只生成文本，除非主动重Roll。">?</i></label><label class="mrs-check"><input name="syncClues" type="checkbox">允许广播成为富余支线线索</label><p>广播不会直接确认同伴最终位置，也不会泄露楚泽暗线。地图情报与真实地点机制分层：重Roll只覆盖情报，不逆转正文里已经发生的搜刮、清剿等事实。</p></section></div>
      <div class="mrs-page" data-s-page="display"><section class="mrs-card mrs-full"><h3>设备显示</h3><label class="mrs-check"><input name="sound" type="checkbox">按键与调频音效</label><label>静电强度 <em data-s-value="static">32%</em><input name="static" type="range" min="0" max="100"></label><label>设备缩放 <em data-s-value="scale">100%</em><input name="scale" type="range" min="80" max="120"></label><label class="mrs-check"><input name="inline" type="checkbox">在最新角色回复顶部显示广播</label><label class="mrs-check"><input name="showIdle" type="checkbox">没有新广播时也保留入口</label></section></div>
    </main>
  </div>
  <div class="mrs-footer"><span class="mrs-footer-note">MR-87 · STILL LISTENING</span><div class="mrs-footer-actions"><button data-s-action="clear-history">清空广播历史</button><button class="mrs-primary" data-s-action="save">保存设置</button></div></div>
</div></div>`;}

function activateSettingsTab(name='general'){
  const r=getSettingsOverlay();if(!r)return;
  r.querySelectorAll('[data-s-tab]').forEach(b=>b.classList.toggle('active',b.dataset.sTab===name));
  r.querySelectorAll('[data-s-page]').forEach(p=>p.classList.toggle('active',p.dataset.sPage===name));
}

function bars(signal){const n=signal==='强'?5:signal==='一般'?4:signal==='微弱'?2:1;return [1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}
function glyph(signal){return signal==='强'?'▮▮▮▮':signal==='一般'?'▮▮▮▯':signal==='微弱'?'▮▮▯▯':'▮▯▯▯'}

function itemForRoot(root){
  const pinned=byId(root?.dataset?.broadcastId);
  return pinned?.channel===store.state.channel?pinned:latest(store.state.channel);
}

function requestChannels(){
  const xs=[...new Set((Array.isArray(store.state.manualChannels)?store.state.manualChannels:[]).filter(k=>channels[k]))];
  if(xs.length)return xs;
  const fallback=channels[store.state.channel]?store.state.channel:'muchi';store.state.manualChannels=[fallback];save();return [fallback];
}
function toggleRequestChannel(k){
  if(!channels[k]||isBusy())return requestChannels();
  const xs=requestChannels();
  if(xs.includes(k)){if(xs.length<=1){try{RH.toastr?.info?.('手动拉取至少保留一个频道')}catch{};return xs}store.state.manualChannels=xs.filter(x=>x!==k)}else store.state.manualChannels=[...xs,k].filter(x=>channels[x]);
  save();renderRadio();return requestChannels();
}
function focusGenerated(items,root){
  const rows=(Array.isArray(items)?items:[items]).filter(Boolean);if(!rows.length)return null;
  let x=rows.find(v=>v.channel===store.state.channel)||rows[0];
  if(x&&store.state.channel!==x.channel){store.state.channel=x.channel;save()}
  forceShow=true;forceBroadcastId=x.id;root.dataset.broadcastId=x.id;root.classList.add('expanded');renderRadio(x);return x;
}

function renderRadio(preferred){
  const root=RDOC.getElementById(ROOT);if(!root)return;
  const item=preferred||itemForRoot(root);const c=channels[item?.channel||store.state.channel]||channels.muchi;
  root.dataset.broadcastId=item?.id||'';
  root.classList.toggle('is-off',!store.state.power);root.classList.toggle('is-muted',!!store.state.mute);root.classList.toggle('light-off',!store.state.light);root.classList.toggle('hold-on',!!store.state.hold);root.classList.toggle('is-busy',isBusy());root.style.setProperty('--mr87-scale',String(clamp(store.settings.scale,80,120)/100));
  root.querySelectorAll('.mr87-power-led').forEach(x=>x.classList.toggle('on',!!store.state.power));
  root.querySelector('.mr87-brief-channel').textContent=c.label;root.querySelector('.mr87-brief-freq').textContent=`${c.band} ${c.freq}`;
  root.querySelector('.mr87-freq').textContent=c.freq;root.querySelector('.mr87-band').textContent=c.band;root.querySelector('.mr87-station').textContent=`${c.label} · ${c.short}`;
  root.querySelector('.mr87-volume-num').textContent=Math.round(store.state.volume);root.querySelector('.mr87-volume')?.style.setProperty('--rot',`${-135+(store.state.volume/100)*270}deg`);
  root.querySelectorAll('[data-r-channel]').forEach(b=>b.classList.toggle('active',b.dataset.rChannel===store.state.channel));
  const selected=requestChannels();root.querySelectorAll('[data-r-request-channel]').forEach(b=>{const on=selected.includes(b.dataset.rRequestChannel);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.disabled=isBusy()});
  const receive=root.querySelector('[data-r-action="receive"]');if(receive){const busy=isBusy(),cancelable=canCancelGeneration();receive.disabled=busy&&!cancelable;receive.classList.toggle('is-cancel',cancelable);receive.textContent=cancelable?'■ 取消本次请求':busy?'正在整理…':selected.length>1?`接收 ${selected.length} 个频道`:'接收新播报';const req=getActiveRequest();receive.title=cancelable&&req?`取消正在生成的 ${req.channels.map(k=>channels[k]?.label||k).join(' + ')}`:''}
  const intel=getIntelUiState(),intelText=intel.status==='settled'?`第${intel.day||'?'}日已结算${intel.rerolls?` · 重Roll ${intel.rerolls}`:''}`:intel.status==='no_intel'?`第${intel.day||'?'}日待二次情报`:intel.status==='exhausted'?`第${intel.day||'?'}日无有效情报`:'今日未结算';
  const intelStatus=root.querySelector('[data-r-intel-status]');if(intelStatus)intelStatus.textContent=intelText;
  const reroll=root.querySelector('[data-r-action="reroll"]');if(reroll){reroll.disabled=isBusy()||!canRerollToday();reroll.textContent=isBusy()?'处理中…':'重Roll今日情报'}
  const impact=root.querySelector('.mr87-impact');
  if(!item){
    root.querySelector('.mr87-brief-headline').textContent='等待接收';root.querySelector('.mr87-brief-summary').textContent='当前没有新的广播。';root.querySelector('.mr87-brief-time').textContent='--:--';root.querySelector('.mr87-brief-signal').textContent='▮▯▯▯';
    root.querySelector('.mr87-bars').innerHTML=bars('断续');root.querySelector('.mr87-signal-text').textContent='无信号';root.querySelector('.mr87-time').textContent='--';root.querySelector('.mr87-source').textContent='暂无广播';root.querySelector('.mr87-headline').textContent='等待接收';root.querySelector('.mr87-transcript').textContent='当前频道还没有广播记录。';if(impact)impact.innerHTML='';
  }else{
    root.querySelector('.mr87-brief-headline').textContent=item.headline||item.category||'广播更新';root.querySelector('.mr87-brief-summary').textContent=item.summary||'';root.querySelector('.mr87-brief-time').textContent=(item.eventTime||'').slice(-5);root.querySelector('.mr87-brief-signal').textContent=glyph(item.signal);
    root.querySelector('.mr87-bars').innerHTML=bars(item.signal);root.querySelector('.mr87-signal-text').textContent=item.signal;root.querySelector('.mr87-time').textContent=item.eventTime;root.querySelector('.mr87-source').textContent=item.source;root.querySelector('.mr87-headline').textContent=item.headline;root.querySelector('.mr87-transcript').textContent=item.transcript||item.summary;
    const tags=[];if(item.appliedImpact?.length)tags.push(`<span>态势变化 · ${esc(item.worldEvent?.summary||item.appliedImpact.join('；'))}</span>`);if(item.appliedClue)tags.push(`<span>模糊线索 · ${esc(item.appliedClue)}</span>`);if(impact)impact.innerHTML=tags.join('');
  }
  root.querySelector('.mr87-expand').textContent=root.classList.contains('expanded')?'收起':'展开';renderLog();
}

function renderLog(){const root=RDOC.getElementById(ROOT);if(!root)return;const host=root.querySelector('.mr87-log-list');if(!host)return;host.innerHTML='';if(!store.history.length){host.innerHTML='<div class="mr87-empty">还没有广播记录。</div>';return}store.history.slice(0,12).forEach((x,i)=>{const c=channels[x.channel]||channels.muchi,b=RDOC.createElement('button');b.className='mr87-log-item';b.dataset.logIndex=String(i);b.innerHTML=`<span>${esc(c.band)} ${esc(c.freq)}</span><b>${esc(x.headline||x.category||'广播')}</b><small>${esc(x.eventTime)} · ${esc(x.source)}</small>`;host.appendChild(b)})}

const API_DEFAULTS={
  openai:'https://api.openai.com/v1',
  openrouter:'https://openrouter.ai/api/v1',
  deepseek:'https://api.deepseek.com/v1',
  xai:'https://api.x.ai/v1',
  claude:'https://api.anthropic.com/v1',
  makersuite:'https://generativelanguage.googleapis.com/v1beta',
  mistralai:'https://api.mistral.ai/v1',
  groq:'https://api.groq.com/openai/v1',
  custom:''
};
const samplingKey=mode=>mode==='proxy'?'proxySampling':mode==='custom'?'customSampling':'mainSampling';
const selectedMode=r=>r.querySelector('input[name="mode"]:checked')?.value||r.dataset.activeMode||'main';

function maybeAutofillUrl(r,force=false){
  const source=r.querySelector('[name="source"]')?.value||'openai',input=r.querySelector('[name="apiUrl"]');if(!input)return;
  const current=String(input.value||'').trim(),known=Object.values(API_DEFAULTS).filter(Boolean);
  const canReplace=force||!current||known.includes(current)||input.dataset.autoUrl==='1';
  if(canReplace){input.value=API_DEFAULTS[source]||'';input.dataset.autoUrl='1'}else input.dataset.autoUrl='0';
}

function refreshProxyPresetOptions(r,notify=false){
  const sel=r.querySelector('[name="proxyPreset"]'),status=r.querySelector('[data-proxy-status]');if(!sel)return;
  const current=String(sel.value||store.settings.proxyPreset||'').trim();
  let names=[];try{names=getProxyPresets()}catch{}
  sel.innerHTML='';
  if(!names.length){const o=r.ownerDocument.createElement('option');o.value=current;o.textContent=current?`${current}（已保存）`:'未读取到代理预设';sel.appendChild(o);sel.disabled=!current;if(status){status.textContent=generationCapabilities().proxyPresets?'未读取到代理预设；可点击“刷新预设”重试。':'当前酒馆助手不支持预设列表读取，请更新酒馆助手。';status.className='mrs-status warn'}return}
  sel.disabled=false;for(const name of names){const o=r.ownerDocument.createElement('option');o.value=name;o.textContent=name;sel.appendChild(o)}
  if(current&&!names.includes(current)){const o=r.ownerDocument.createElement('option');o.value=current;o.textContent=`${current}（已保存）`;sel.appendChild(o)}
  if(current)sel.value=current;else if(names.length===1)sel.value=names[0];
  if(status){status.textContent=`已读取 ${names.length} 个酒馆代理预设。`;status.className='mrs-status ok'}
  if(notify)try{RH.toastr?.success?.(`已读取 ${names.length} 个代理预设`)}catch{}
}

function stashSamplingState(r){
  const mode=r.dataset.activeMode||selectedMode(r),box=r.querySelector('[name="inheritSampling"]');if(!box)return;
  r.dataset[`${mode}Sampling`]=box.checked?'inherit':'custom';
}
function loadSamplingState(r,mode){
  const box=r.querySelector('[name="inheritSampling"]');if(!box)return;
  const key=`${mode}Sampling`,saved=r.dataset[key]||store.settings[samplingKey(mode)]||(mode==='custom'?'custom':'inherit');
  box.checked=saved!=='custom';
}
function applySamplingUi(r,mode){
  const inherit=!!r.querySelector('[name="inheritSampling"]')?.checked,fields=r.querySelector('[data-sampling-fields]'),label=r.querySelector('[data-sampling-label]'),help=r.querySelector('[data-sampling-help]');
  fields?.classList.toggle('mrs-hidden',inherit);
  if(label)label.textContent=mode==='proxy'?'沿用代理预设采样参数':mode==='custom'?'沿用酒馆当前采样参数':'沿用酒馆主预设采样参数';
  if(help)help.textContent=inherit?(mode==='custom'?'独立 API 沿用酒馆当前温度；不人为设置输出 Tokens 上限。':'不额外覆盖温度，也不人为设置输出 Tokens 上限。'):'仅 MR-87 使用下方温度；输出 Tokens 上限不再由脚本限制。';
}
function applyModeUi(r,mode,{loadSampling=true}={}){
  if(r.dataset.activeMode&&r.dataset.activeMode!==mode)stashSamplingState(r);
  r.dataset.activeMode=mode;
  r.querySelectorAll('.mrs-engine').forEach(x=>x.classList.toggle('active',x.dataset.engine===mode));
  r.querySelectorAll('.mrs-mode-option').forEach(x=>x.classList.toggle('active',x.querySelector('input')?.value===mode));
  if(loadSampling)loadSamplingState(r,mode);
  applySamplingUi(r,mode);
  const proxyOverride=!!r.querySelector('[name="proxyModelOverride"]')?.checked;
  r.querySelector('[data-proxy-model-row]')?.classList.toggle('mrs-hidden',!proxyOverride);
  if(mode==='proxy')refreshProxyPresetOptions(r);
  if(mode==='custom')maybeAutofillUrl(r);
}

function renderModelPicker(r,models=modelCache){
  const row=r.querySelector('[data-model-pick-row]'),sel=r.querySelector('[name="modelPick"]'),input=r.querySelector('[name="customModel"]');
  if(!row||!sel)return;
  sel.innerHTML='<option value="">选择模型…</option>';
  for(const m of models||[]){const o=r.ownerDocument.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)}
  const current=String(input?.value||'').trim();if(current&&(models||[]).includes(current))sel.value=current;
  row.classList.toggle('mrs-hidden',!(models&&models.length));
}
function clearModelPicker(r){modelCache=[];modelCacheUrl='';renderModelPicker(r,[])}
async function fetchModelsIntoUi(r,button){
  const url=String(r.querySelector('[name="apiUrl"]')?.value||'').trim(),key=String(r.querySelector('[name="apiKey"]')?.value||''),status=r.querySelector('[data-model-status]'),input=r.querySelector('[name="customModel"]');
  if(!url){try{RH.toastr?.warning?.('请先填写 API URL')}catch{};return}
  const old=button.textContent;button.disabled=true;button.textContent='拉取中…';if(status){status.textContent='正在请求模型列表…';status.className='mrs-status'}
  try{
    const models=await fetchModelList(url,key);modelCache=[...models];modelCacheUrl=url;renderModelPicker(r,models);
    if(input&&!input.value&&models.length===1){input.value=models[0];const sel=r.querySelector('[name="modelPick"]');if(sel)sel.value=models[0]}
    if(status){status.textContent=`已载入 ${models.length} 个模型；请从下方列表选择，或继续手填。`;status.className='mrs-status ok'}
    try{RH.toastr?.success?.(`已拉取 ${models.length} 个模型`)}catch{}
  }catch(err){clearModelPicker(r);if(status){status.textContent=`拉取失败：${err?.message||err}。仍可手动填写模型。`;status.className='mrs-status warn'};try{RH.toastr?.error?.(`模型拉取失败：${err?.message||err}`)}catch{}}
  finally{button.disabled=false;button.textContent=old}
}

function renderSettings(){
  const r=getSettingsOverlay()||ensureSettingsMount();if(!r)return;const s=store.settings;
  const set=(name,v)=>{const e=r.querySelector(`[name="${name}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v??''};
  r.querySelectorAll('input[name="mode"]').forEach(e=>e.checked=e.value===(s.mode||'main'));
  ['proxyPreset','proxyModel','apiUrl','source','temperature','hours','autoChannel','historyLimit','civilian','diversity','tension','extra','static','scale'].forEach(n=>set(n,s[n]));
  set('apiKey',getApiKey());set('customModel',s.customModel||s.model||'');set('proxyModelOverride',!!s.proxyModelOverride);
  ['rememberKey','auto','initialBroadcast','dateRefresh','locationRefresh','injectStory','applyEvents','syncClues','syncMvu','repeatGuard','songRequests','storyArcs','sound','inline','showIdle'].forEach(n=>set(n,s[n]));
  r.dataset.mainSampling=s.mainSampling||'inherit';r.dataset.proxySampling=s.proxySampling||'inherit';r.dataset.customSampling=s.customSampling||'custom';
  r.querySelector('[data-s-value="temperature"]').textContent=Number(s.temperature).toFixed(2);r.querySelector('[data-s-value="civilian"]').textContent=`${s.civilian}%`;r.querySelector('[data-s-value="static"]').textContent=`${s.static}%`;r.querySelector('[data-s-value="scale"]').textContent=`${s.scale}%`;
  const url=r.querySelector('[name="apiUrl"]');if(url)url.dataset.autoUrl=Object.values(API_DEFAULTS).includes(String(url.value||''))?'1':'0';
  if(modelCache.length&&modelCacheUrl===String(s.apiUrl||''))renderModelPicker(r,modelCache);else renderModelPicker(r,[]);
  applyModeUi(r,s.mode||'main');
}
function readSettings(){
  const r=getSettingsOverlay()||ensureSettingsMount();if(!r)return;stashSamplingState(r);const v=n=>r.querySelector(`[name="${n}"]`)?.value??'',c=n=>!!r.querySelector(`[name="${n}"]`)?.checked;
  store.settings.mode=selectedMode(r);store.settings.proxyPreset=v('proxyPreset');store.settings.proxyModelOverride=c('proxyModelOverride');store.settings.proxyModel=v('proxyModel').trim();store.settings.apiUrl=v('apiUrl').trim();setApiKey(v('apiKey'));store.settings.rememberKey=c('rememberKey');store.settings.customModel=v('customModel').trim();store.settings.model=store.settings.mode==='custom'?store.settings.customModel:store.settings.proxyModel;store.settings.source=v('source')||'openai';
  store.settings.mainSampling=r.dataset.mainSampling||'inherit';store.settings.proxySampling=r.dataset.proxySampling||'inherit';store.settings.customSampling=r.dataset.customSampling||'custom';store.settings.temperature=clamp(v('temperature'),0,2);store.settings.settingsRevision=190;
  store.settings.auto=c('auto');store.settings.initialBroadcast=c('initialBroadcast');store.settings.hours=clamp(v('hours'),1,48);store.settings.dateRefresh=c('dateRefresh');store.settings.locationRefresh=c('locationRefresh');store.settings.autoChannel=v('autoChannel')||'context';store.settings.historyLimit=clamp(v('historyLimit'),10,200);store.settings.syncMvu=c('syncMvu');store.settings.injectStory=c('injectStory');store.settings.applyEvents=c('applyEvents');store.settings.syncClues=c('syncClues');store.settings.civilian=clamp(v('civilian'),0,80);store.settings.diversity=['steady','natural','rich','chaotic'].includes(v('diversity'))?v('diversity'):'natural';store.settings.songRequests=c('songRequests');store.settings.storyArcs=c('storyArcs');store.settings.tension=v('tension')||'balanced';store.settings.repeatGuard=c('repeatGuard');store.settings.extra=v('extra');store.settings.sound=c('sound');store.settings.static=clamp(v('static'),0,100);store.settings.scale=clamp(v('scale'),80,120);store.settings.inline=c('inline');store.settings.showIdle=c('showIdle');store.settings.apiKey=store.settings.rememberKey?getApiKey():'';
  if(store.settings.mode==='custom'){if(!store.settings.apiUrl)throw Error('独立 API 需要填写 API URL');if(!store.settings.customModel)throw Error('独立 API 需要选择或填写模型')}
  if(store.settings.mode==='proxy'&&!store.settings.proxyPreset)throw Error('代理预设模式需要选择一个代理预设');
  if(store.settings.mode==='proxy'&&store.settings.proxyModelOverride&&!store.settings.proxyModel)throw Error('已开启模型覆盖，请填写模型名');
  save();renderSettings();mountInline();
}

export function openSettings(){
  try{
    /* 每次打开都创建新节点；失败时直接删除，不保留任何全屏透明层。 */
    closeSettings();
    const r=ensureSettingsMount();
    renderSettings();
    activateSettingsTab('general');
    r.classList.add('mrs-open');
    r.setAttribute('aria-hidden','false');
    r.style.setProperty('display','flex','important');
    const c=r.querySelector('.mrs-content');if(c)c.scrollTop=0;
    return r;
  }catch(err){
    console.error('[MR-87 v1.9.0] 设置界面打开失败',err);
    cleanupLegacySettings();
    try{RH.toastr?.error?.(`收音机设置打开失败：${err?.message||err}`)}catch{}
    return null;
  }
}
export function closeSettings(){cleanupLegacySettings()}

export function mountInline(force=false){
  RDOC.querySelectorAll(`.${INLINE_CLASS}`).forEach(el=>el.remove());
  const mes=getLatestAssistantMessage(),host=getMessageContentHost(mes);if(!host)return;
  const messageId=getMessageId(mes),scheduled=displayForMessage(messageId),forced=forceBroadcastId?byId(forceBroadcastId):null;
  const item=forced||scheduled||(force||forceShow||store.settings.showIdle?latest(store.state.channel):null);
  if(!store.settings.inline&&!force&&!forceShow)return;
  if(!item&&!store.settings.showIdle&&!force&&!forceShow)return;
  host.insertAdjacentHTML('afterbegin',inlineHtml());const root=RDOC.getElementById(ROOT);if(!root)return;root.style.setProperty('--mr87-backdrop',`url("${radioBackdropUrl()}")`);bindInline(root);root.dataset.broadcastId=item?.id||'';if(force||forceShow)root.classList.add('expanded');renderRadio(item||undefined);
}

export function openRadio(){forceShow=true;forceBroadcastId=forceBroadcastId||latest(store.state.channel)?.id||'';mountInline(true);setTimeout(()=>RDOC.getElementById(ROOT)?.scrollIntoView({behavior:'smooth',block:'center'}),50)}

function bindInline(root){
  root.addEventListener('click',async e=>{
    const ch=e.target.closest('[data-r-channel]');if(ch){switchChannel(ch.dataset.rChannel);const x=latest(ch.dataset.rChannel);root.dataset.broadcastId=x?.id||'';forceBroadcastId=x?.id||'';renderRadio(x||undefined);return}
    const pick=e.target.closest('[data-r-request-channel]');if(pick){toggleRequestChannel(pick.dataset.rRequestChannel);return}
    const row=e.target.closest('[data-log-index]');if(row){const x=store.history[Number(row.dataset.logIndex)];if(!x)return;store.state.channel=x.channel;save();root.dataset.broadcastId=x.id;forceBroadcastId=x.id;renderRadio(x);root.classList.remove('log-open');return}
    const help=e.target.closest('[data-help]');if(help){e.preventDefault();e.stopPropagation();help.focus();return}
    const b=e.target.closest('[data-r-action]');if(!b)return;const a=b.dataset.rAction;
    if(a==='toggle'){root.classList.toggle('expanded');clickSound();renderRadio();return}if(a==='collapse'){root.classList.remove('expanded');renderRadio();return}if(a==='settings'){openSettings();return}
    if(a==='prev'){cycle(-1);const x=latest(store.state.channel);root.dataset.broadcastId=x?.id||'';forceBroadcastId=x?.id||'';renderRadio(x||undefined);return}if(a==='next'){cycle(1);const x=latest(store.state.channel);root.dataset.broadcastId=x?.id||'';forceBroadcastId=x?.id||'';renderRadio(x||undefined);return}
    if(a==='scan'){noise(.4);root.classList.add('scanning');setTimeout(()=>{cycle(1);const x=latest(store.state.channel);root.dataset.broadcastId=x?.id||'';forceBroadcastId=x?.id||'';root.classList.remove('scanning');renderRadio(x||undefined)},520);return}
    if(a==='receive'){
      if(isBusy()){if(canCancelGeneration())cancelActiveGeneration();return}
      if(store.state.power){const items=await generate(requestChannels(),'manual');focusGenerated(items,root)}return
    }
    if(a==='reroll'){if(store.state.power){const x=await rerollTodayIntel();if(x){forceShow=true;forceBroadcastId=x.id;root.dataset.broadcastId=x.id;root.classList.add('expanded');renderRadio(x)}}return}
    if(a==='power'){store.state.power=!store.state.power;clickSound();save();renderRadio();return}if(a==='mute'){store.state.mute=!store.state.mute;save();renderRadio();return}if(a==='light'){store.state.light=!store.state.light;clickSound();save();renderRadio();return}if(a==='hold'){store.state.hold=!store.state.hold;clickSound();save();renderRadio();return}if(a==='log'){root.classList.toggle('log-open');clickSound();return}if(a==='tune'){noise(.08);b.style.setProperty('--rot',`${Math.round(Math.random()*90-45)}deg`);return}if(a==='volume'){store.state.volume=store.state.volume>=90?20:store.state.volume+10;save();renderRadio();clickSound();return}
  });
  root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('mr87-brief')){e.preventDefault();root.classList.toggle('expanded');renderRadio()}});
  root.querySelector('.mr87-volume')?.addEventListener('wheel',e=>{e.preventDefault();store.state.volume=clamp(store.state.volume+(e.deltaY<0?5:-5),0,100);save();renderRadio()},{passive:false});
}

function bindSettingsDrag(r){
  const panel=r?.querySelector?.('.mrs-panel'),head=r?.querySelector?.('.mrs-title'),doc=r?.ownerDocument,win=doc?.defaultView;if(!panel||!head||!win||head.dataset.dragBound==='1')return;head.dataset.dragBound='1';
  let d=null;
  const stop=e=>{if(!d)return;try{if(e?.pointerId!=null&&head.hasPointerCapture?.(e.pointerId))head.releasePointerCapture(e.pointerId)}catch{};d=null;r.classList.remove('mrs-dragging')};
  head.addEventListener('pointerdown',e=>{
    if(win.innerWidth<=720||e.button!==0)return;
    if(e.target?.closest?.('button,a,input,select,textarea,[data-no-drag]'))return;
    const rect=panel.getBoundingClientRect();
    panel.style.setProperty('position','fixed','important');panel.style.setProperty('left',`${Math.round(rect.left)}px`,'important');panel.style.setProperty('top',`${Math.round(rect.top)}px`,'important');panel.style.setProperty('margin','0','important');
    d={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    try{head.setPointerCapture?.(e.pointerId)}catch{};r.classList.add('mrs-dragging');e.preventDefault();
  });
  head.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;const pad=8,maxLeft=Math.max(pad,win.innerWidth-d.width-pad),maxTop=Math.max(pad,win.innerHeight-d.height-pad);panel.style.setProperty('left',`${Math.round(clamp(d.left+e.clientX-d.x,pad,maxLeft))}px`,'important');panel.style.setProperty('top',`${Math.round(clamp(d.top+e.clientY-d.y,pad,maxTop))}px`,'important')});
  head.addEventListener('pointerup',stop);head.addEventListener('pointercancel',stop);head.addEventListener('lostpointercapture',()=>{d=null;r.classList.remove('mrs-dragging')});
}

function bindSettings(){
  const r=getSettingsOverlay();if(!r||r.dataset.bound==='1')return;r.dataset.bound='1';bindSettingsDrag(r);
  r.addEventListener('click',async e=>{
    if(e.target===r){closeSettings();return}
    const help=e.target.closest('.mrs-help');if(help){help.focus();return}
    const tab=e.target.closest('[data-s-tab]');if(tab){activateSettingsTab(tab.dataset.sTab);return}
    const b=e.target.closest('[data-s-action]');if(!b)return;const a=b.dataset.sAction;
    if(a==='close'){closeSettings();return}
    if(a==='save'){try{readSettings();RH.toastr?.success?.('收音机设置已保存');closeSettings()}catch(err){RH.toastr?.error?.(err?.message||String(err))}return}
    if(a==='refresh-proxies'){refreshProxyPresetOptions(r,true);return}
    if(a==='fetch-models'){await fetchModelsIntoUi(r,b);return}
    if(a==='clear-history'){clearHistory();RH.toastr?.info?.('广播历史已清空');return}
  });
  r.addEventListener('input',e=>{
    const n=e.target.name;
    if(n==='temperature')r.querySelector('[data-s-value="temperature"]').textContent=Number(e.target.value).toFixed(2);
    if(n==='civilian')r.querySelector('[data-s-value="civilian"]').textContent=`${e.target.value}%`;
    if(n==='static')r.querySelector('[data-s-value="static"]').textContent=`${e.target.value}%`;
    if(n==='scale'){r.querySelector('[data-s-value="scale"]').textContent=`${e.target.value}%`;RDOC.getElementById(ROOT)?.style.setProperty('--mr87-scale',String(clamp(e.target.value,80,120)/100))}
    if(n==='apiUrl'){e.target.dataset.autoUrl='0';if(String(e.target.value||'').trim()!==modelCacheUrl)clearModelPicker(r)}
  });
  r.addEventListener('change',e=>{
    const n=e.target.name;
    if(n==='mode'){applyModeUi(r,e.target.value);return}
    if(n==='inheritSampling'){stashSamplingState(r);applySamplingUi(r,selectedMode(r));return}
    if(n==='proxyModelOverride'){r.querySelector('[data-proxy-model-row]')?.classList.toggle('mrs-hidden',!e.target.checked);return}
    if(n==='modelPick'){const input=r.querySelector('[name="customModel"]');if(input&&e.target.value)input.value=e.target.value;return}
    if(n==='source'){maybeAutofillUrl(r);if(String(r.querySelector('[name="apiUrl"]')?.value||'').trim()!==modelCacheUrl)clearModelPicker(r);return}
  });
}

export function installUi(){
  try{RDOC.querySelectorAll('link[id^="swz-radio-style"],style[id^="swz-radio-style"]').forEach(el=>el.remove())}catch{}
  ensureStyle();
  closeSettings();
  setRenderer((type,payload)=>{if(type==='error'){const root=RDOC.getElementById(ROOT);if(root){root.querySelector('.mr87-headline').textContent='接收失败';root.querySelector('.mr87-transcript').textContent=String(payload||'未知错误')}}else renderRadio()});
  const api={open:openRadio,openSettings,closeSettings,mount:mountInline};
  try{RH.MuchiRadio={...(RH.MuchiRadio||{}),...api}}catch{}
  /* 酒馆助手脚本库按钮由 v25.8 角色卡脚本本体绑定；远程模块只保留自定义事件入口。 */
  try{if(typeof globalThis.eventOn==='function')globalThis.eventOn('swz:open-radio-settings',openSettings)}catch(e){console.warn('[MR-87] 设置事件绑定失败',e)}
  try{if(typeof globalThis.eventOn==='function')globalThis.eventOn('swz:open-radio',openRadio)}catch(e){console.warn('[MR-87] 打开事件绑定失败',e)}
  mountInline();
}
export function refreshInlineSoon(){setTimeout(()=>mountInline(),140)}
export function clearForcedView(){forceShow=false;forceBroadcastId=''}
