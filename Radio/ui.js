import { store, channels, latest, byId, displayForMessage, switchChannel, cycle, generate, clearHistory, clickSound, noise, testConnection, save, setApiKey, getApiKey, setRenderer, isBusy } from './core.js';

const ROOT='swz-inline-radio';
const SETTINGS='swz-radio-settings';
const STYLE='swz-radio-style';
const INLINE_CLASS='swz-mr87-inline';

const RH = (()=>{ try { return window.parent && window.parent.document ? window.parent : window; } catch (_) { return window; } })();
const RDOC = RH.document;
let forceShow=false,forceBroadcastId='';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function styleUrl(){return 'https://testingcf.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/style.css';}
function ensureStyle(){if(RDOC.getElementById(STYLE))return;const link=RDOC.createElement('link');link.id=STYLE;link.rel='stylesheet';link.href=styleUrl();RDOC.head.appendChild(link)}

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
      <div class="mr87-brand"><b>暮迟 · MR-87</b><span>便携多波段接收终端</span></div>
      <div class="mr87-status"><i class="mr87-power-led"></i><span>接收</span><button class="mr87-gear" data-r-action="settings" title="收音机设置">⚙</button></div>
    </div>
    <div class="mr87-body">
      <div class="mr87-speaker-side"><div class="mr87-speaker"></div><div class="mr87-meter"><span></span><span></span><span></span><span></span><span></span><i></i></div><div class="mr87-speaker-label">MR-87 · 接收单元</div></div>
      <div class="mr87-console">
        <div class="mr87-screen">
          <div class="mr87-screen-top"><div><span class="mr87-freq">88.7</span><span class="mr87-band">FM</span><small class="mr87-station">暮迟市</small></div><div class="mr87-signal"><div class="mr87-bars"></div><small class="mr87-signal-text">一般</small></div></div>
          <div class="mr87-meta"><span class="mr87-time">--</span><span class="mr87-source">暂无广播</span></div>
          <div class="mr87-headline">等待接收</div><div class="mr87-transcript">当前频道还没有广播记录。</div><div class="mr87-impact"></div>
        </div>
        <div class="mr87-presets"><button data-r-channel="global">SW · 全球</button><button data-r-channel="china">SW · 中国</button><button data-r-channel="muchi">FM · 暮迟市</button></div>
        <div class="mr87-controls"><div class="mr87-knob-wrap"><button class="mr87-knob mr87-tune" data-r-action="tune"></button><small>调频</small></div><div class="mr87-keys"><button data-r-action="prev">◀</button><button data-r-action="scan">扫频</button><button data-r-action="next">▶</button><button class="mr87-receive" data-r-action="receive">接收新播报</button></div><div class="mr87-knob-wrap"><button class="mr87-knob mr87-volume" data-r-action="volume"></button><small>音量 · <span class="mr87-volume-num">48</span></small></div></div>
        <div class="mr87-funcs"><button class="mr87-cosmetic" data-r-action="power"><span>◈</span><em>电源</em></button><button class="mr87-cosmetic" data-r-action="mute"><span>◌</span><em>静音</em></button><button class="mr87-cosmetic" data-r-action="light"><span>✦</span><em>背光</em></button><button class="mr87-cosmetic" data-r-action="hold"><span>⟐</span><em>锁定</em></button><button class="mr87-utility" data-r-action="log"><span>☰</span><em>记录</em></button><button class="mr87-utility" data-r-action="collapse"><span>↘</span><em>收起</em></button></div>
      </div>
    </div>
    <div class="mr87-log-drawer"><div class="mr87-log-head"><b>广播记录</b><span>最近接收</span></div><div class="mr87-log-list"></div></div>
    <div class="mr87-foot"><span>灾变公共广播接收终端</span><span class="mr87-version">MR-87</span></div>
  </div>
</section>`;}

function settingsHtml(){return `<div id="${SETTINGS}" class="swz-radio-settings-overlay" aria-hidden="true"><div class="swz-radio-settings-panel">
  <button class="swz-settings-close" data-s-action="close">×</button><div class="swz-settings-title"><b>MR-87 · 收音机设置</b><span>广播在正文顶部显示；完整设备按需展开</span></div>
  <div class="swz-settings-grid">
    <section class="swz-setting-card swz-full"><h3>生成来源</h3><label>模式<select name="mode"><option value="main">跟随酒馆主 API</option><option value="proxy">酒馆代理预设</option><option value="custom">独立 API</option></select></label><div class="swz-engine" data-engine="main"><p>直接使用当前酒馆连接。</p></div><div class="swz-engine" data-engine="proxy"><label>代理预设<input name="proxyPreset"></label><label>模型<input name="model"></label></div><div class="swz-engine" data-engine="custom"><label>API URL<input name="apiUrl"></label><label>API Key<input name="apiKey" type="password" autocomplete="off"></label><label class="swz-check"><input name="rememberKey" type="checkbox">记住 Key</label><label>模型<input name="modelCustom"></label><label>API Source<input name="source" placeholder="openai"></label></div><label>温度 <em data-s-value="temperature">0.72</em><input name="temperature" type="range" min="0" max="1.5" step="0.01"></label><label>最大输出 Tokens<input name="maxTokens" type="number" min="256" max="1600" step="32"></label><div class="swz-setting-actions"><button data-s-action="test">测试连接</button></div></section>
    <section class="swz-setting-card"><h3>自动接收</h3><label class="swz-check"><input name="auto" type="checkbox">开启自动广播</label><label class="swz-check"><input name="initialBroadcast" type="checkbox">首次生成前接收本地广播</label><label>世界时间至少经过（小时）<input name="hours" type="number" min="1" max="48"></label><label class="swz-check"><input name="dateRefresh" type="checkbox">跨日期刷新</label><label class="swz-check"><input name="locationRefresh" type="checkbox">换地点后优先刷新本地台</label><label>自动频道<select name="autoChannel"><option value="context">按情境选择</option><option value="current">只刷新当前频道</option><option value="rotate">三频道轮换</option></select></label></section>
    <section class="swz-setting-card"><h3>剧情联动</h3><label class="swz-check"><input name="injectStory" type="checkbox">广播先生成并注入本轮正文上下文</label><label class="swz-check"><input name="applyEvents" type="checkbox">可信本地事件可更新地图态势</label><label class="swz-check"><input name="syncClues" type="checkbox">允许广播成为富余支线线索</label><p>广播不会直接确认同伴最终位置，也不会泄露楚泽暗线。</p></section>
    <section class="swz-setting-card"><h3>内容控制</h3><label>民间信息倾向 <em data-s-value="civilian">28%</em><input name="civilian" type="range" min="0" max="100"></label><label>整体紧张度<select name="tension"><option value="calm">生活化 / 克制</option><option value="balanced">平衡</option><option value="tense">偏紧张</option></select></label><label class="swz-check"><input name="repeatGuard" type="checkbox">近期广播重复保护</label><label>附加偏好<textarea name="extra"></textarea></label></section>
    <section class="swz-setting-card"><h3>记录与同步</h3><label>历史保留条数<input name="historyLimit" type="number" min="10" max="200"></label><label class="swz-check"><input name="syncMvu" type="checkbox">最新摘要同步回 MVU</label><p>完整历史保存在脚本变量；MVU只保留三个频道的最新摘要与最近世界事件。</p></section>
    <section class="swz-setting-card"><h3>设备显示</h3><label class="swz-check"><input name="sound" type="checkbox">按键与调频音效</label><label>静电强度 <em data-s-value="static">32%</em><input name="static" type="range" min="0" max="100"></label><label>设备缩放 <em data-s-value="scale">100%</em><input name="scale" type="range" min="80" max="120"></label><label class="swz-check"><input name="inline" type="checkbox">在最新角色回复顶部显示广播</label><label class="swz-check"><input name="showIdle" type="checkbox">没有新广播时也保留入口</label></section>
  </div><div class="swz-setting-footer"><button data-s-action="clear-history">清空广播历史</button><button class="primary" data-s-action="save">保存设置</button></div>
</div></div>`;}

function bars(signal){const n=signal==='强'?5:signal==='一般'?4:signal==='微弱'?2:1;return [1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}
function glyph(signal){return signal==='强'?'▮▮▮▮':signal==='一般'?'▮▮▮▯':signal==='微弱'?'▮▮▯▯':'▮▯▯▯'}

function itemForRoot(root){return byId(root?.dataset?.broadcastId)||latest(store.state.channel)}

function renderRadio(preferred){
  const root=RDOC.getElementById(ROOT);if(!root)return;
  const item=preferred||itemForRoot(root);const c=channels[item?.channel||store.state.channel]||channels.muchi;
  if(item)root.dataset.broadcastId=item.id;
  root.classList.toggle('is-off',!store.state.power);root.classList.toggle('is-muted',!!store.state.mute);root.classList.toggle('light-off',!store.state.light);root.classList.toggle('hold-on',!!store.state.hold);root.classList.toggle('is-busy',isBusy());root.style.setProperty('--mr87-scale',String(clamp(store.settings.scale,80,120)/100));
  root.querySelectorAll('.mr87-power-led').forEach(x=>x.classList.toggle('on',!!store.state.power));
  root.querySelector('.mr87-brief-channel').textContent=c.label;root.querySelector('.mr87-brief-freq').textContent=`${c.band} ${c.freq}`;
  root.querySelector('.mr87-freq').textContent=c.freq;root.querySelector('.mr87-band').textContent=c.band;root.querySelector('.mr87-station').textContent=`${c.label} · ${c.short}`;
  root.querySelector('.mr87-volume-num').textContent=Math.round(store.state.volume);root.querySelector('.mr87-volume')?.style.setProperty('--rot',`${-135+(store.state.volume/100)*270}deg`);
  root.querySelectorAll('[data-r-channel]').forEach(b=>b.classList.toggle('active',b.dataset.rChannel===store.state.channel));
  const receive=root.querySelector('[data-r-action="receive"]');if(receive){receive.disabled=isBusy();receive.textContent=isBusy()?'接收中…':'接收新播报'}
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

function renderSettings(){const r=RDOC.getElementById(SETTINGS);if(!r)return;const s=store.settings,set=(name,v)=>{const e=r.querySelector(`[name="${name}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v??''};['mode','proxyPreset','apiUrl','model','source','temperature','maxTokens','hours','autoChannel','historyLimit','civilian','tension','extra','static','scale'].forEach(n=>set(n,s[n]));set('apiKey',getApiKey());set('modelCustom',s.model);['rememberKey','auto','initialBroadcast','dateRefresh','locationRefresh','injectStory','applyEvents','syncClues','syncMvu','repeatGuard','sound','inline','showIdle'].forEach(n=>set(n,s[n]));r.querySelector('[data-s-value="temperature"]').textContent=Number(s.temperature).toFixed(2);r.querySelector('[data-s-value="civilian"]').textContent=`${s.civilian}%`;r.querySelector('[data-s-value="static"]').textContent=`${s.static}%`;r.querySelector('[data-s-value="scale"]').textContent=`${s.scale}%`;r.querySelectorAll('.swz-engine').forEach(x=>x.style.display=x.dataset.engine===s.mode?'grid':'none')}
function readSettings(){const r=RDOC.getElementById(SETTINGS);if(!r)return;const v=n=>r.querySelector(`[name="${n}"]`)?.value??'',c=n=>!!r.querySelector(`[name="${n}"]`)?.checked;store.settings.mode=v('mode')||'main';store.settings.proxyPreset=v('proxyPreset');store.settings.apiUrl=v('apiUrl');setApiKey(v('apiKey'));store.settings.rememberKey=c('rememberKey');store.settings.model=store.settings.mode==='custom'?v('modelCustom'):v('model');store.settings.source=v('source')||'openai';store.settings.temperature=clamp(v('temperature'),0,2);store.settings.maxTokens=clamp(v('maxTokens'),256,1600);store.settings.auto=c('auto');store.settings.initialBroadcast=c('initialBroadcast');store.settings.hours=clamp(v('hours'),1,48);store.settings.dateRefresh=c('dateRefresh');store.settings.locationRefresh=c('locationRefresh');store.settings.autoChannel=v('autoChannel')||'context';store.settings.historyLimit=clamp(v('historyLimit'),10,200);store.settings.syncMvu=c('syncMvu');store.settings.injectStory=c('injectStory');store.settings.applyEvents=c('applyEvents');store.settings.syncClues=c('syncClues');store.settings.civilian=clamp(v('civilian'),0,100);store.settings.tension=v('tension')||'balanced';store.settings.repeatGuard=c('repeatGuard');store.settings.extra=v('extra');store.settings.sound=c('sound');store.settings.static=clamp(v('static'),0,100);store.settings.scale=clamp(v('scale'),80,120);store.settings.inline=c('inline');store.settings.showIdle=c('showIdle');store.settings.apiKey=store.settings.rememberKey?getApiKey():'';save();renderSettings();mountInline()}

export function openSettings(){renderSettings();const r=RDOC.getElementById(SETTINGS);if(r){r.classList.add('open');r.setAttribute('aria-hidden','false')}}
export function closeSettings(){const r=RDOC.getElementById(SETTINGS);if(r){r.classList.remove('open');r.setAttribute('aria-hidden','true')}}

export function mountInline(force=false){
  RDOC.querySelectorAll(`.${INLINE_CLASS}`).forEach(el=>el.remove());
  const mes=getLatestAssistantMessage(),host=getMessageContentHost(mes);if(!host)return;
  const messageId=getMessageId(mes),scheduled=displayForMessage(messageId),forced=forceBroadcastId?byId(forceBroadcastId):null;
  const item=forced||scheduled||(force||forceShow||store.settings.showIdle?latest(store.state.channel):null);
  if(!store.settings.inline&&!force&&!forceShow)return;
  if(!item&&!store.settings.showIdle&&!force&&!forceShow)return;
  host.insertAdjacentHTML('afterbegin',inlineHtml());const root=RDOC.getElementById(ROOT);if(!root)return;bindInline(root);root.dataset.broadcastId=item?.id||'';if(force||forceShow)root.classList.add('expanded');renderRadio(item||undefined);
}

export function openRadio(){forceShow=true;forceBroadcastId=forceBroadcastId||latest(store.state.channel)?.id||'';mountInline(true);setTimeout(()=>RDOC.getElementById(ROOT)?.scrollIntoView({behavior:'smooth',block:'center'}),50)}

function bindInline(root){
  root.addEventListener('click',async e=>{
    const ch=e.target.closest('[data-r-channel]');if(ch){switchChannel(ch.dataset.rChannel);const x=latest(ch.dataset.rChannel);if(x){root.dataset.broadcastId=x.id;forceBroadcastId=x.id}renderRadio(x);return}
    const row=e.target.closest('[data-log-index]');if(row){const x=store.history[Number(row.dataset.logIndex)];if(!x)return;store.state.channel=x.channel;save();root.dataset.broadcastId=x.id;forceBroadcastId=x.id;renderRadio(x);root.classList.remove('log-open');return}
    const b=e.target.closest('[data-r-action]');if(!b)return;const a=b.dataset.rAction;
    if(a==='toggle'){root.classList.toggle('expanded');clickSound();renderRadio();return}if(a==='collapse'){root.classList.remove('expanded');renderRadio();return}if(a==='settings'){openSettings();return}
    if(a==='prev'){cycle(-1);const x=latest(store.state.channel);if(x){root.dataset.broadcastId=x.id;forceBroadcastId=x.id}renderRadio(x);return}if(a==='next'){cycle(1);const x=latest(store.state.channel);if(x){root.dataset.broadcastId=x.id;forceBroadcastId=x.id}renderRadio(x);return}
    if(a==='scan'){noise(.4);root.classList.add('scanning');setTimeout(()=>{cycle(1);const x=latest(store.state.channel);if(x){root.dataset.broadcastId=x.id;forceBroadcastId=x.id}root.classList.remove('scanning');renderRadio(x)},520);return}
    if(a==='receive'){if(store.state.power){const x=await generate(store.state.channel,'manual');if(x){forceShow=true;forceBroadcastId=x.id;root.dataset.broadcastId=x.id;root.classList.add('expanded');renderRadio(x)}}return}
    if(a==='power'){store.state.power=!store.state.power;clickSound();save();renderRadio();return}if(a==='mute'){store.state.mute=!store.state.mute;save();renderRadio();return}if(a==='light'){store.state.light=!store.state.light;clickSound();save();renderRadio();return}if(a==='hold'){store.state.hold=!store.state.hold;clickSound();save();renderRadio();return}if(a==='log'){root.classList.toggle('log-open');clickSound();return}if(a==='tune'){noise(.08);b.style.setProperty('--rot',`${Math.round(Math.random()*90-45)}deg`);return}if(a==='volume'){store.state.volume=store.state.volume>=90?20:store.state.volume+10;save();renderRadio();clickSound();return}
  });
  root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('mr87-brief')){e.preventDefault();root.classList.toggle('expanded');renderRadio()}});
  root.querySelector('.mr87-volume')?.addEventListener('wheel',e=>{e.preventDefault();store.state.volume=clamp(store.state.volume+(e.deltaY<0?5:-5),0,100);save();renderRadio()},{passive:false});
}

function bindSettings(){const r=RDOC.getElementById(SETTINGS);if(!r)return;r.addEventListener('click',async e=>{if(e.target===r){closeSettings();return}const b=e.target.closest('[data-s-action]');if(!b)return;const a=b.dataset.sAction;if(a==='close'){closeSettings();return}if(a==='save'){readSettings();toastr?.success?.('收音机设置已保存');closeSettings();return}if(a==='test'){readSettings();b.disabled=true;b.textContent='测试中…';try{await testConnection();toastr?.success?.('API连接正常')}catch(err){toastr?.error?.(`API测试失败：${err?.message||err}`)}finally{b.disabled=false;b.textContent='测试连接'}return}if(a==='clear-history'){clearHistory();toastr?.info?.('广播历史已清空');return}});r.addEventListener('input',e=>{const n=e.target.name;if(n==='temperature')r.querySelector('[data-s-value="temperature"]').textContent=Number(e.target.value).toFixed(2);if(n==='civilian')r.querySelector('[data-s-value="civilian"]').textContent=`${e.target.value}%`;if(n==='static')r.querySelector('[data-s-value="static"]').textContent=`${e.target.value}%`;if(n==='scale'){r.querySelector('[data-s-value="scale"]').textContent=`${e.target.value}%`;RDOC.getElementById(ROOT)?.style.setProperty('--mr87-scale',String(clamp(e.target.value,80,120)/100))}});r.addEventListener('change',e=>{if(e.target.name==='mode'){store.settings.mode=e.target.value;renderSettings()}})}

export function installUi(){ensureStyle();if(!RDOC.getElementById(SETTINGS)){RDOC.body.insertAdjacentHTML('beforeend',settingsHtml());bindSettings()}setRenderer((type,payload)=>{if(type==='error'){const root=RDOC.getElementById(ROOT);if(root){root.querySelector('.mr87-headline').textContent='接收失败';root.querySelector('.mr87-transcript').textContent=String(payload||'未知错误')}}else renderRadio()});try{appendInexistentScriptButtons?.([{name:'打开MR-87',visible:true},{name:'收音机设置',visible:true}]);eventOn?.(getButtonEvent?.('打开MR-87'),openRadio);eventOn?.(getButtonEvent?.('收音机设置'),openSettings)}catch{}try{eventOn?.('swz:open-radio-settings',openSettings);eventOn?.('swz:open-radio',openRadio)}catch{}mountInline()}
export function refreshInlineSoon(){setTimeout(()=>mountInline(),140)}
export function clearForcedView(){forceShow=false;forceBroadcastId=''}
