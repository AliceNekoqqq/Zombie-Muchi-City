import { store, channels, latest, byId, displayForMessage, switchChannel, cycle, generate, rerollTodayIntel, canRerollToday, getIntelUiState, clearHistory, clickSound, noise, save, setApiKey, getApiKey, setRenderer, isBusy, canCancelGeneration, cancelActiveGeneration, getActiveRequest, getProxyPresets, fetchModelList, generationCapabilities } from './core.js';

const ROOT='swz-inline-radio';
const SETTINGS='swz-radio-settings';
const SETTINGS_FRAME='swz-radio-settings-frame-v160';
const STYLE='swz-radio-style-v160';
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
#${SETTINGS}.mrs-overlay{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none;align-items:center!important;justify-content:center!important;padding:18px!important;overflow:auto!important;background:rgba(4,6,8,.68)!important;color:#eee9e2!important;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif!important;line-height:normal!important;text-align:left!important;pointer-events:auto!important;backdrop-filter:blur(8px)!important}
#${SETTINGS}.mrs-overlay.mrs-open{display:flex!important}
#${SETTINGS},#${SETTINGS} *{box-sizing:border-box!important}
#${SETTINGS} .mrs-panel{position:relative!important;isolation:isolate!important;width:min(700px,calc(100vw - 44px))!important;max-height:calc(100vh - 44px)!important;display:grid!important;grid-template-rows:64px 44px minmax(0,1fr) 56px!important;overflow:hidden!important;border:1px solid rgba(235,216,194,.18)!important;border-radius:22px!important;background:linear-gradient(180deg,rgba(12,15,18,.96),rgba(8,11,13,.97))!important;color:#eee9e2!important;box-shadow:0 30px 90px rgba(0,0,0,.54),inset 0 1px 0 rgba(255,255,255,.035)!important}
#${SETTINGS} .mrs-panel::before{content:""!important;position:absolute!important;inset:0!important;z-index:-2!important;background-image:linear-gradient(90deg,rgba(7,9,11,.96) 0%,rgba(7,9,11,.86) 48%,rgba(7,9,11,.72) 100%),url("${radioBackdropUrl()}")!important;background-size:cover!important;background-position:center 60%!important;filter:saturate(.68) brightness(.70)!important;opacity:.58!important}
#${SETTINGS} .mrs-panel::after{content:""!important;position:absolute!important;inset:0!important;z-index:-1!important;background:radial-gradient(440px 220px at 12% 0,rgba(214,160,110,.08),transparent 70%),radial-gradient(380px 220px at 95% 18%,rgba(155,201,198,.06),transparent 72%)!important;pointer-events:none!important}
#${SETTINGS} .mrs-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;padding:0 14px 0 18px!important;border-bottom:1px solid rgba(235,216,194,.12)!important;background:rgba(8,11,13,.72)!important;cursor:grab!important;user-select:none!important;-webkit-user-select:none!important;touch-action:none!important;backdrop-filter:blur(10px)!important}
#${SETTINGS}.mrs-dragging .mrs-title{cursor:grabbing!important}
#${SETTINGS} .mrs-title b{font-family:"Noto Serif SC","Songti SC",serif!important;font-size:17px!important;font-weight:520!important;letter-spacing:.09em!important;color:#f2ebe3!important}
#${SETTINGS} .mrs-title span{display:block!important;margin-top:4px!important;color:#888b8b!important;font-size:8px!important;letter-spacing:.06em!important}
#${SETTINGS} .mrs-close{appearance:none!important;width:36px!important;height:36px!important;padding:0!important;border:1px solid rgba(235,216,194,.14)!important;border-radius:10px!important;background:rgba(18,21,24,.66)!important;color:#bbb5ad!important;font-size:20px!important;line-height:34px!important;text-align:center!important;cursor:pointer!important}
#${SETTINGS} .mrs-close:hover{border-color:rgba(197,141,151,.30)!important;color:#ead4d9!important;background:rgba(70,39,47,.30)!important}
#${SETTINGS} .mrs-tabs{display:flex!important;gap:5px!important;padding:6px 10px!important;border-bottom:1px solid rgba(235,216,194,.09)!important;background:rgba(8,11,13,.58)!important;overflow-x:auto!important;backdrop-filter:blur(8px)!important}
#${SETTINGS} .mrs-tabs button{appearance:none!important;flex:1 0 72px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;color:#828788!important;font-size:9px!important;cursor:pointer!important;transition:.16s ease!important}
#${SETTINGS} .mrs-tabs button:hover{color:#d6cec5!important;background:rgba(255,255,255,.025)!important}
#${SETTINGS} .mrs-tabs button.active{border-color:rgba(155,201,198,.18)!important;background:rgba(155,201,198,.08)!important;color:#e8efeb!important;box-shadow:inset 0 -2px 0 rgba(155,201,198,.42)!important}
#${SETTINGS} .mrs-content{min-height:0!important;overflow:auto!important;padding:12px!important;overscroll-behavior:contain!important;scrollbar-width:thin!important}
#${SETTINGS} .mrs-page{display:none!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
#${SETTINGS} .mrs-page.active{display:grid!important}
#${SETTINGS} .mrs-card{padding:14px!important;border:1px solid rgba(235,216,194,.10)!important;border-radius:14px!important;background:linear-gradient(180deg,rgba(18,21,24,.72),rgba(10,13,15,.74))!important;color:#eee9e2!important;backdrop-filter:blur(9px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
#${SETTINGS} .mrs-card.mrs-full{grid-column:1/-1!important}
#${SETTINGS} .mrs-card h3{display:flex!important;align-items:center!important;margin:0 0 12px!important;font-family:"Noto Serif SC","Songti SC",serif!important;font-size:12px!important;font-weight:560!important;letter-spacing:.06em!important;color:#eee7de!important}
#${SETTINGS} .mrs-card h3::before{content:""!important;width:2px!important;height:12px!important;margin-right:8px!important;border-radius:2px!important;background:linear-gradient(180deg,#d6a06e,#c58d97)!important}
#${SETTINGS} .mrs-card p{margin:7px 0 0!important;color:#83898a!important;font-size:8px!important;line-height:1.7!important}
#${SETTINGS} .mrs-card label{display:block!important;margin-top:10px!important;color:#969895!important;font-size:8px!important}
#${SETTINGS} .mrs-card input:not([type=checkbox]):not([type=range]),#${SETTINGS} .mrs-card select,#${SETTINGS} .mrs-card textarea{appearance:auto!important;width:100%!important;margin-top:6px!important;padding:9px 10px!important;border:1px solid rgba(235,216,194,.12)!important;border-radius:9px!important;background:rgba(5,8,10,.72)!important;color:#ded8d0!important;outline:none!important;font-size:9px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.015)!important}
#${SETTINGS} .mrs-card input:focus,#${SETTINGS} .mrs-card select:focus,#${SETTINGS} .mrs-card textarea:focus{border-color:rgba(155,201,198,.30)!important;box-shadow:0 0 0 2px rgba(155,201,198,.06)!important}
#${SETTINGS} .mrs-card textarea{min-height:72px!important;resize:vertical!important;line-height:1.65!important}
#${SETTINGS} .mrs-card input[type=range]{width:100%!important;margin-top:7px!important;accent-color:#9bc9c6!important}
#${SETTINGS} .mrs-check{display:flex!important;align-items:center!important;gap:7px!important;line-height:1.5!important}
#${SETTINGS} .mrs-check input{margin:0!important;accent-color:#9bc9c6!important}
#${SETTINGS} .mrs-actions{margin-top:10px!important}
#${SETTINGS} .mrs-actions button,#${SETTINGS} .mrs-footer button{appearance:none!important;padding:8px 11px!important;border:1px solid rgba(235,216,194,.13)!important;border-radius:9px!important;background:rgba(19,22,24,.72)!important;color:#bdb7af!important;font-size:8px!important;cursor:pointer!important}
#${SETTINGS} .mrs-actions button:hover,#${SETTINGS} .mrs-footer button:hover{border-color:rgba(216,160,110,.25)!important;color:#eee5da!important;background:rgba(31,29,29,.78)!important}
#${SETTINGS} .mrs-footer{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:7px!important;padding:9px 12px!important;border-top:1px solid rgba(235,216,194,.10)!important;background:rgba(8,11,13,.72)!important;backdrop-filter:blur(10px)!important}
#${SETTINGS} .mrs-footer .mrs-primary{border-color:rgba(155,201,198,.24)!important;background:rgba(59,96,93,.28)!important;color:#e3eeea!important}
#${SETTINGS} .mrs-mode-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;margin-top:8px!important}
#${SETTINGS} .mrs-mode-option{position:relative!important;display:block!important;margin:0!important;cursor:pointer!important}
#${SETTINGS} .mrs-mode-option input{position:absolute!important;opacity:0!important;pointer-events:none!important}
#${SETTINGS} .mrs-mode-option span{display:block!important;min-height:76px!important;padding:11px 12px!important;border:1px solid rgba(235,216,194,.10)!important;border-radius:11px!important;background:rgba(6,9,11,.60)!important;transition:.16s ease!important}
#${SETTINGS} .mrs-mode-option b{display:block!important;color:#cbc4bc!important;font-size:10px!important;font-weight:600!important}
#${SETTINGS} .mrs-mode-option small{display:block!important;margin-top:6px!important;color:#767e80!important;font-size:7px!important;line-height:1.55!important}
#${SETTINGS} .mrs-mode-option input:checked+span{border-color:rgba(155,201,198,.30)!important;background:rgba(58,92,90,.22)!important;box-shadow:inset 0 0 0 1px rgba(155,201,198,.05)!important}
#${SETTINGS} .mrs-mode-option input:checked+span b{color:#e7efeb!important}
#${SETTINGS} .mrs-engine-shell{margin-top:10px!important;padding:11px!important;border:1px solid rgba(235,216,194,.08)!important;border-radius:11px!important;background:rgba(5,8,10,.55)!important}
#${SETTINGS} .mrs-engine{display:none!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
#${SETTINGS} .mrs-engine.active{display:grid!important}
#${SETTINGS} .mrs-engine .mrs-wide{grid-column:1/-1!important}
#${SETTINGS} .mrs-source-note{display:flex!important;align-items:flex-start!important;gap:8px!important;padding:9px 10px!important;border:1px solid rgba(155,201,198,.10)!important;border-radius:9px!important;background:rgba(44,70,69,.13)!important;color:#858f8e!important;font-size:8px!important;line-height:1.6!important}
#${SETTINGS} .mrs-source-note strong{color:#b9cbc7!important;white-space:nowrap!important}
#${SETTINGS} .mrs-field-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:7px!important;align-items:end!important}
#${SETTINGS} .mrs-field-row>label{margin-top:0!important}
#${SETTINGS} .mrs-mini-btn{appearance:none!important;min-width:86px!important;height:33px!important;padding:0 10px!important;border:1px solid rgba(235,216,194,.13)!important;border-radius:9px!important;background:rgba(19,22,24,.75)!important;color:#bdb7af!important;font-size:8px!important;cursor:pointer!important}
#${SETTINGS} .mrs-mini-btn:hover{border-color:rgba(155,201,198,.24)!important;color:#e3eeea!important}
#${SETTINGS} .mrs-mini-btn:disabled{opacity:.45!important;cursor:default!important}
#${SETTINGS} .mrs-status{min-height:16px!important;margin-top:6px!important;color:#767f80!important;font-size:7px!important;line-height:1.5!important}
#${SETTINGS} .mrs-status.ok{color:#91b8ac!important}#${SETTINGS} .mrs-status.warn{color:#c4a776!important}
#${SETTINGS} .mrs-sampling-fields{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;margin-top:8px!important}
#${SETTINGS} .mrs-model-pick-row select{cursor:pointer!important}
#${SETTINGS} .mrs-hidden{display:none!important}
#${SETTINGS} .mrs-badge{display:inline-flex!important;align-items:center!important;min-height:20px!important;padding:2px 7px!important;border:1px solid rgba(235,216,194,.10)!important;border-radius:999px!important;background:rgba(8,11,13,.62)!important;color:#8d9291!important;font-size:7px!important}
#${SETTINGS} .mrs-help{position:relative!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:17px!important;height:17px!important;margin-left:5px!important;border:1px solid rgba(235,216,194,.16)!important;border-radius:50%!important;background:rgba(8,11,13,.74)!important;color:#a7a19a!important;font-size:8px!important;font-style:normal!important;cursor:help!important;vertical-align:middle!important;outline:none!important}
#${SETTINGS} .mrs-help::after{content:attr(data-tip)!important;position:absolute!important;z-index:30!important;left:50%!important;bottom:calc(100% + 8px)!important;width:228px!important;max-width:70vw!important;padding:9px 10px!important;border:1px solid rgba(235,216,194,.15)!important;border-radius:9px!important;background:rgba(10,13,15,.98)!important;color:#c7c2bb!important;font-size:8px!important;line-height:1.6!important;box-shadow:0 14px 32px rgba(0,0,0,.38)!important;transform:translate(-50%,4px)!important;opacity:0!important;pointer-events:none!important;transition:.14s ease!important;white-space:normal!important}
#${SETTINGS} .mrs-help:hover::after,#${SETTINGS} .mrs-help:focus::after{opacity:1!important;transform:translate(-50%,0)!important}
@media(max-width:720px){#${SETTINGS}.mrs-overlay{padding:0!important;background:rgba(4,6,8,.84)!important}#${SETTINGS} .mrs-panel{width:100vw!important;max-height:100vh!important;height:100vh!important;border:0!important;border-radius:0!important;grid-template-rows:58px 42px minmax(0,1fr) 54px!important}#${SETTINGS} .mrs-title{padding-left:13px!important;cursor:default!important}#${SETTINGS} .mrs-title b{font-size:14px!important}#${SETTINGS} .mrs-title span{font-size:7px!important}#${SETTINGS} .mrs-content{padding:8px!important}#${SETTINGS} .mrs-page,#${SETTINGS} .mrs-page.active{grid-template-columns:1fr!important}#${SETTINGS} .mrs-card.mrs-full{grid-column:auto!important}#${SETTINGS} .mrs-mode-grid{grid-template-columns:1fr!important}#${SETTINGS} .mrs-engine.active{grid-template-columns:1fr!important}#${SETTINGS} .mrs-engine .mrs-wide{grid-column:auto!important}#${SETTINGS} .mrs-sampling-fields{grid-template-columns:1fr!important}}
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
    <div class="mr87-brief-mark"><i class="mr87-power-led"></i><b>MR-87</b></div>
    <div class="mr87-brief-station"><span class="mr87-brief-channel">暮迟市</span><small class="mr87-brief-freq">FM 88.7</small></div>
    <div class="mr87-brief-copy"><strong class="mr87-brief-headline">等待接收</strong><span class="mr87-brief-summary">当前没有新的广播。</span></div>
    <div class="mr87-brief-side"><span class="mr87-brief-signal">▮▮▮▯</span><time class="mr87-brief-time">--:--</time><button data-r-action="toggle" class="mr87-expand">展开</button></div>
  </div>
  <div class="mr87-drawer">
    <div class="mr87-topline">
      <div class="mr87-brand"><b>MR-87 · 废墟电波</b><span>MUCHI CITY / SAME FREQUENCY, DIFFERENT TOMORROW</span></div>
      <div class="mr87-status"><i class="mr87-power-led"></i><span>正在接收</span><button class="mr87-gear" data-r-action="settings" title="收音机设置">⚙</button></div>
    </div>
    <div class="mr87-body">
      <aside class="mr87-speaker-side">
        <div class="mr87-side-label"><b>频段选择</b><small>CHANNEL</small></div>
        <div class="mr87-presets"><button data-r-channel="global">SW · 全球</button><button data-r-channel="china">SW · 中国</button><button data-r-channel="muchi">FM · 暮迟市</button></div>
        <div class="mr87-speaker"></div>
        <div class="mr87-meter"><span></span><span></span><span></span><span></span><span></span><i></i></div>
        <div class="mr87-speaker-label">MR-87 · RECEIVER UNIT</div>
        <div class="mr87-side-quote">“无线电没有熄灭，就还不算世界的尽头。”<small>STILL HERE · 87.4</small></div>
      </aside>
      <div class="mr87-console">
        <div class="mr87-screen">
          <div class="mr87-screen-top"><div><span class="mr87-freq">88.7</span><span class="mr87-band">FM</span><small class="mr87-station">暮迟市</small></div><div class="mr87-signal"><div class="mr87-bars"></div><small class="mr87-signal-text">一般</small></div></div>
          <div class="mr87-meta"><span class="mr87-time">--</span><span class="mr87-source">暂无广播</span></div>
          <div class="mr87-headline">等待接收</div><div class="mr87-transcript">当前频道还没有广播记录。</div><div class="mr87-impact"></div>
        </div>
        <div class="mr87-request-pick"><span>本次拉取</span><div class="mr87-request-channels"><button type="button" data-r-request-channel="global" aria-pressed="false">全球</button><button type="button" data-r-request-channel="china" aria-pressed="false">中国</button><button type="button" data-r-request-channel="muchi" aria-pressed="true">暮迟</button></div><button class="mr87-help" type="button" data-help data-tip="这里只决定下一次手动接收要生成哪些频道；可同时选择多个频道，所选频道仍合并成一次 API 请求，不会改变当前正在收听的频段。" aria-label="手动拉取频道说明">?</button></div>
        <div class="mr87-controls"><div class="mr87-knob-wrap"><button class="mr87-knob mr87-tune" data-r-action="tune"></button><small>调频</small></div><div class="mr87-keys"><button data-r-action="prev">◀</button><button data-r-action="scan">扫频</button><button data-r-action="next">▶</button><button class="mr87-receive" data-r-action="receive">接收新播报</button></div><div class="mr87-knob-wrap"><button class="mr87-knob mr87-volume" data-r-action="volume"></button><small>音量 · <span class="mr87-volume-num">48</span></small></div></div>
        <div class="mr87-intel-tools"><div class="mr87-intel-state"><span>地图情报</span><b data-r-intel-status>今日未结算</b></div><div class="mr87-reroll-wrap"><button class="mr87-reroll" data-r-action="reroll">重Roll今日情报</button><button class="mr87-help" type="button" data-help data-tip="恢复到今日结算前的地图情报基线，重新生成暮迟市广播与地图情报，并覆盖上一版；不会叠加数值，也不受每日一次结算限制。已生成的旧正文不会自动改写。" aria-label="重Roll说明">?</button></div></div>
        <div class="mr87-funcs"><button class="mr87-cosmetic" data-r-action="power"><span>◈</span><em>电源</em></button><button class="mr87-cosmetic" data-r-action="mute"><span>◌</span><em>静音</em></button><button class="mr87-cosmetic" data-r-action="light"><span>✦</span><em>背光</em></button><button class="mr87-cosmetic" data-r-action="hold"><span>⟐</span><em>锁定</em></button><button class="mr87-utility" data-r-action="log"><span>☰</span><em>记录</em></button><button class="mr87-utility" data-r-action="collapse"><span>↘</span><em>收起</em></button></div>
      </div>
    </div>
    <div class="mr87-log-drawer"><div class="mr87-log-head"><b>广播记录</b><span>最近接收</span></div><div class="mr87-log-list"></div></div>
    <div class="mr87-foot"><span>MR-87 RADIO · STILL LISTENING</span><span class="mr87-version">暮迟未散 · 频道仍在</span></div>
  </div>
</section>`;}

function settingsHtml(){return `<div id="${SETTINGS}" class="mrs-overlay" aria-hidden="true" style="display:none"><div class="mrs-panel">
  <div class="mrs-title"><div><b>MR-87 · 收音机设置</b><span>广播生成、自动接收与剧情联动</span></div><button class="mrs-close" type="button" data-s-action="close">×</button></div>
  <nav class="mrs-tabs"><button type="button" data-s-tab="general" class="active">常规</button><button type="button" data-s-tab="engine">生成 API</button><button type="button" data-s-tab="auto">自动</button><button type="button" data-s-tab="story">剧情</button><button type="button" data-s-tab="display">显示</button></nav>
  <div class="mrs-content">
    <div class="mrs-page active" data-s-page="general">
      <section class="mrs-card"><h3>内容控制 <i class="mrs-help" tabindex="0" data-tip="随机性由脚本先抽取事件类型、区域、稀有度、播报形式、可靠度、人味插播和连续事件，再交给模型写成广播；不是单纯提高温度。">?</i></h3><label>广播多样性<select name="diversity"><option value="steady">稳健 · 更多连续性，稀有事件很少</option><option value="natural">自然 · 推荐</option><option value="rich">丰富 · 更积极换事件与形式</option><option value="chaotic">混乱 · 更多传闻与非常规频段</option></select></label><label>人味插播概率 <em data-s-value="civilian">34%</em><input name="civilian" type="range" min="0" max="80"></label><label class="mrs-check"><input name="songRequests" type="checkbox">允许幸存者点歌 / 留言 <i class="mrs-help" tabindex="0" data-tip="点歌会随机出现歌名、歌手、点播对象和留言，也可能使用虚构歌曲；它属于生活内容，不会单独改变地图情报。">?</i></label><label class="mrs-check"><input name="storyArcs" type="checkbox">允许连续事件弧 <i class="mrs-help" tabindex="0" data-tip="部分广播会在未来1—3个游戏日继续发展，例如车队失联、供电恢复、寻宠后续；不会保证每次都续写。">?</i></label><label>整体紧张度<select name="tension"><option value="calm">生活化 / 克制</option><option value="balanced">平衡</option><option value="tense">偏紧张</option></select></label><label class="mrs-check"><input name="repeatGuard" type="checkbox">近期广播重复保护</label><label>附加偏好<textarea name="extra"></textarea></label></section>
      <section class="mrs-card"><h3>记录与同步</h3><label>历史保留条数<input name="historyLimit" type="number" min="10" max="200"></label><label class="mrs-check"><input name="syncMvu" type="checkbox">最新摘要同步回 MVU</label><p>完整历史保存在脚本变量；MVU只保留三个频道的最新摘要与最近世界事件。</p></section>
    </div>
    <div class="mrs-page" data-s-page="engine">
      <section class="mrs-card mrs-full">
        <h3>生成来源 <i class="mrs-help" tabindex="0" data-tip="主预设直接跟随酒馆；代理预设使用酒馆已保存的代理连接；独立 API 只给 MR-87 使用，不改变正文模型。">?</i></h3>
        <div class="mrs-mode-grid">
          <label class="mrs-mode-option"><input type="radio" name="mode" value="main"><span><b>主预设</b><small>完全跟随当前酒馆连接与模型。最省心。</small></span></label>
          <label class="mrs-mode-option"><input type="radio" name="mode" value="proxy"><span><b>代理预设</b><small>使用酒馆中已保存的代理预设，不暴露 URL / Key。</small></span></label>
          <label class="mrs-mode-option"><input type="radio" name="mode" value="custom"><span><b>独立 API</b><small>只给 MR-87 使用，不改变主剧情 API。</small></span></label>
        </div>
        <div class="mrs-engine-shell">
          <div class="mrs-engine" data-engine="main">
            <div class="mrs-source-note mrs-wide"><strong>跟随酒馆</strong><span>URL、Key、模型全部使用当前酒馆设置，因此这些字段会自动隐藏。默认也继承主预设采样参数。</span></div>
          </div>
          <div class="mrs-engine" data-engine="proxy">
            <div class="mrs-field-row mrs-wide"><label>代理预设<select name="proxyPreset"></select></label><button type="button" class="mrs-mini-btn" data-s-action="refresh-proxies">刷新预设</button></div>
            <div class="mrs-status mrs-wide" data-proxy-status></div>
            <label class="mrs-check mrs-wide"><input name="proxyModelOverride" type="checkbox">覆盖代理预设中的模型</label>
            <label class="mrs-wide" data-proxy-model-row>模型<input name="proxyModel" placeholder="仅在确实需要覆盖时填写"></label>
          </div>
          <div class="mrs-engine mrs-engine-custom" data-engine="custom">
            <label>API 类型<select name="source"><option value="openai">OpenAI / OpenAI兼容</option><option value="openrouter">OpenRouter</option><option value="deepseek">DeepSeek</option><option value="xai">xAI</option><option value="claude">Claude</option><option value="makersuite">Google MakerSuite</option><option value="mistralai">Mistral</option><option value="groq">Groq</option><option value="custom">Custom</option></select></label>
            <label>API URL<input name="apiUrl" placeholder="https://api.example.com/v1"></label>
            <label>API Key<input name="apiKey" type="password" autocomplete="off" placeholder="不会发送给主剧情"></label>
            <label class="mrs-check"><input name="rememberKey" type="checkbox">在本角色脚本变量中保存 Key</label>
            <div class="mrs-field-row mrs-wide"><label>模型<input name="customModel" placeholder="手填模型，或先拉取列表"></label><button type="button" class="mrs-mini-btn" data-s-action="fetch-models">拉取模型</button></div>
            <label class="mrs-wide mrs-model-pick-row mrs-hidden" data-model-pick-row>已拉取模型<select name="modelPick"><option value="">选择模型…</option></select></label>
            <div class="mrs-status mrs-wide" data-model-status>拉取成功后会出现可下拉选择的模型列表；也可以直接手填。</div>
          </div>
        </div>
      </section>
      <section class="mrs-card mrs-full">
        <h3>采样参数</h3>
        <label class="mrs-check"><input name="inheritSampling" type="checkbox"><span data-sampling-label>沿用来源采样参数</span></label>
        <div class="mrs-sampling-fields" data-sampling-fields>
          <label>温度 <em data-s-value="temperature">0.85</em><input name="temperature" type="range" min="0" max="1.5" step="0.01"></label>
        </div>
        <p data-sampling-help></p>
      </section>
    </div>
    <div class="mrs-page" data-s-page="auto">
      <section class="mrs-card mrs-full"><h3>自动接收 <i class="mrs-help" tabindex="0" data-tip="满足首次、跨日期、换地点或经过指定时间等条件时自动接收；同一轮需要多个频道会合并为一次 API 请求。">?</i></h3><label class="mrs-check"><input name="auto" type="checkbox">开启自动广播</label><label class="mrs-check"><input name="initialBroadcast" type="checkbox">首次生成前接收本地广播</label><label>世界时间至少经过（小时）<input name="hours" type="number" min="1" max="48"></label><label class="mrs-check"><input name="dateRefresh" type="checkbox">跨日期刷新</label><label class="mrs-check"><input name="locationRefresh" type="checkbox">换地点后优先刷新本地台</label><label>自动频道<select name="autoChannel"><option value="context">按情境选择</option><option value="current">只刷新当前频道</option><option value="rotate">三频道轮换</option></select></label></section>
    </div>
    <div class="mrs-page" data-s-page="story">
      <section class="mrs-card mrs-full"><h3>剧情联动</h3><label class="mrs-check"><input name="injectStory" type="checkbox">广播先生成并注入本轮正文上下文 <i class="mrs-help" tabindex="0" data-tip="把刚收到的广播摘要一次性注入下一轮正文，使人物能自然听见；不会把整段广播反复塞进上下文。">?</i></label><label class="mrs-check"><input name="applyEvents" type="checkbox">暮迟市广播联动地图情报 <i class="mrs-help" tabindex="0" data-tip="地图显示的是玩家已知情报。每天最多自动结算一次，最多尝试两次；结算后普通广播只生成文本，除非主动重Roll。">?</i></label><label class="mrs-check"><input name="syncClues" type="checkbox">允许广播成为富余支线线索</label><p>广播不会直接确认同伴最终位置，也不会泄露楚泽暗线。地图情报与真实地点机制分层：重Roll只覆盖情报，不逆转正文里已经发生的搜刮、清剿等事实。</p></section>
    </div>
    <div class="mrs-page" data-s-page="display">
      <section class="mrs-card mrs-full"><h3>设备显示</h3><label class="mrs-check"><input name="sound" type="checkbox">按键与调频音效</label><label>静电强度 <em data-s-value="static">32%</em><input name="static" type="range" min="0" max="100"></label><label>设备缩放 <em data-s-value="scale">100%</em><input name="scale" type="range" min="80" max="120"></label><label class="mrs-check"><input name="inline" type="checkbox">在最新角色回复顶部显示广播</label><label class="mrs-check"><input name="showIdle" type="checkbox">没有新广播时也保留入口</label></section>
    </div>
  </div>
  <div class="mrs-footer"><button data-s-action="clear-history">清空广播历史</button><button class="mrs-primary" data-s-action="save">保存设置</button></div>
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
  store.settings.mainSampling=r.dataset.mainSampling||'inherit';store.settings.proxySampling=r.dataset.proxySampling||'inherit';store.settings.customSampling=r.dataset.customSampling||'custom';store.settings.temperature=clamp(v('temperature'),0,2);store.settings.settingsRevision=140;
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
    console.error('[MR-87 v1.6.0] 设置界面打开失败',err);
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
  try{RDOC.getElementById('swz-radio-style')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v105')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v106')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v107')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v110')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v130')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v140')?.remove()}catch{}
  try{RDOC.getElementById('swz-radio-style-v150')?.remove()}catch{}
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
