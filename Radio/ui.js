import { store, channels, latest, switchChannel, cycle, generate, clearHistory, clickSound, noise, testConnection, save, setApiKey, getApiKey, setRenderer, isBusy } from './core.js';

const ROOT='swz-inline-radio';
const SETTINGS='swz-radio-settings';
const STYLE='swz-radio-style';
const INLINE_CLASS='swz-mr87-inline';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function styleUrl(){
  return 'https://cdn.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/style.css';
}

function ensureStyle(){
  if(document.getElementById(STYLE)) return;
  const link=document.createElement('link');
  link.id=STYLE;
  link.rel='stylesheet';
  link.href=styleUrl();
  document.head.appendChild(link);
}

function getLatestAssistantMessage(){
  const selectors=['#chat .mes[is_user="false"]','#chat .mes:not([is_user="true"])','#chat .mes'];
  for(const sel of selectors){
    const nodes=[...document.querySelectorAll(sel)].filter(el=>{
      const isUser=el.getAttribute('is_user');
      if(isUser==='true') return false;
      const role=el.getAttribute('data-message-role');
      if(role==='user') return false;
      return true;
    });
    if(nodes.length) return nodes[nodes.length-1];
  }
  return null;
}

function getMessageContentHost(mes){
  if(!mes) return null;
  return mes.querySelector('.mes_text') || mes.querySelector('.mes_block') || mes;
}

function inlineHtml(){
  return `<section id="${ROOT}" class="${INLINE_CLASS}" aria-label="暮迟市 MR-87 收音机">
    <div class="mr87-topline">
      <div class="mr87-brand"><b>暮迟 · MR-87</b><span>EMERGENCY MULTIBAND RECEIVER</span></div>
      <div class="mr87-status"><i class="mr87-power-led"></i><span>POWER</span><button class="mr87-gear" data-r-action="settings" title="收音机设置">⚙</button></div>
    </div>

    <div class="mr87-body">
      <div class="mr87-speaker-side">
        <div class="mr87-speaker"></div>
        <div class="mr87-meter"><span></span><span></span><span></span><span></span><span></span><i></i></div>
        <div class="mr87-speaker-label">DYNAMIC SPEAKER · 8Ω</div>
      </div>

      <div class="mr87-console">
        <div class="mr87-screen">
          <div class="mr87-screen-top">
            <div><span class="mr87-freq">88.7</span><span class="mr87-band">FM</span><small class="mr87-station">暮迟市 · MUCHI</small></div>
            <div class="mr87-signal"><div class="mr87-bars"></div><small class="mr87-signal-text">一般</small></div>
          </div>
          <div class="mr87-meta"><span class="mr87-time">--</span><span class="mr87-source">暂无广播</span></div>
          <div class="mr87-headline">等待接收</div>
          <div class="mr87-transcript">当前频道还没有广播记录。</div>
        </div>

        <div class="mr87-presets">
          <button data-r-channel="global">SW · 全球</button>
          <button data-r-channel="china">SW · 中国</button>
          <button data-r-channel="muchi">FM · 暮迟市</button>
        </div>

        <div class="mr87-controls">
          <div class="mr87-knob-wrap"><button class="mr87-knob mr87-tune" data-r-action="tune" aria-label="调频旋钮"></button><small>TUNING</small></div>
          <div class="mr87-keys">
            <button data-r-action="prev">◀</button>
            <button data-r-action="scan">SCAN</button>
            <button data-r-action="next">▶</button>
            <button class="mr87-receive" data-r-action="receive">接收新播报</button>
          </div>
          <div class="mr87-knob-wrap"><button class="mr87-knob mr87-volume" data-r-action="volume" aria-label="音量旋钮"></button><small>VOL · <span class="mr87-volume-num">48</span></small></div>
        </div>

        <div class="mr87-funcs">
          <button data-r-action="power">POWER</button><button data-r-action="mute">MUTE</button><button data-r-action="light">LIGHT</button><button data-r-action="hold">HOLD</button><button data-r-action="log">LOG</button><button data-r-action="preset">M1</button>
        </div>
      </div>
    </div>

    <div class="mr87-log-drawer"><div class="mr87-log-head"><b>广播记录</b><span>最近接收</span></div><div class="mr87-log-list"></div></div>
    <div class="mr87-foot"><span>灾变公共广播接收终端</span><span class="mr87-version">MR-87</span></div>
  </section>`;
}

function settingsHtml(){
  return `<div id="${SETTINGS}" class="swz-radio-settings-overlay" aria-hidden="true">
    <div class="swz-radio-settings-panel">
      <button class="swz-settings-close" data-s-action="close">×</button>
      <div class="swz-settings-title"><b>MR-87 · 收音机设置</b><span>独立设置界面</span></div>
      <div class="swz-settings-grid">
        <section class="swz-setting-card swz-full"><h3>生成来源</h3>
          <label>模式<select name="mode"><option value="main">跟随酒馆主 API</option><option value="proxy">酒馆代理预设</option><option value="custom">独立 API</option></select></label>
          <div class="swz-engine" data-engine="main"><p>直接使用当前酒馆连接，不额外保存 Key。</p></div>
          <div class="swz-engine" data-engine="proxy"><label>代理预设<input name="proxyPreset" placeholder="预设名称"></label><label>模型<input name="model" placeholder="可留空"></label></div>
          <div class="swz-engine" data-engine="custom"><label>API URL<input name="apiUrl" placeholder="https://..."></label><label>API Key<input name="apiKey" type="password" autocomplete="off"></label><label class="swz-check"><input name="rememberKey" type="checkbox">记住 Key（分享角色卡前建议关闭）</label><label>模型<input name="modelCustom" placeholder="模型名称"></label><label>API Source<input name="source" placeholder="openai"></label></div>
          <label>温度 <em data-s-value="temperature">0.72</em><input name="temperature" type="range" min="0" max="1.5" step="0.01"></label>
          <label>最大输出 Tokens<input name="maxTokens" type="number" min="128" max="1400" step="32"></label>
          <div class="swz-setting-actions"><button data-s-action="test">测试连接</button></div>
        </section>

        <section class="swz-setting-card"><h3>自动广播</h3>
          <label class="swz-check"><input name="auto" type="checkbox">开启智能自动刷新</label>
          <label>世界时间至少经过（小时）<input name="hours" type="number" min="1" max="48"></label>
          <label class="swz-check"><input name="dateRefresh" type="checkbox">跨日期刷新</label>
          <label class="swz-check"><input name="locationRefresh" type="checkbox">跨区域优先刷新本地台</label>
          <label>自动频道<select name="autoChannel"><option value="context">按情境选择</option><option value="current">只刷新当前频道</option><option value="rotate">三频道轮换</option></select></label>
        </section>

        <section class="swz-setting-card"><h3>内容控制</h3>
          <label>民间信息倾向 <em data-s-value="civilian">28%</em><input name="civilian" type="range" min="0" max="100"></label>
          <label>整体紧张度<select name="tension"><option value="calm">生活化 / 克制</option><option value="balanced">平衡</option><option value="tense">偏紧张</option></select></label>
          <label class="swz-check"><input name="repeatGuard" type="checkbox">近期广播重复保护</label>
          <label>附加偏好<textarea name="extra" placeholder="例如：多一些停水、天气、道路和普通幸存者消息"></textarea></label>
        </section>

        <section class="swz-setting-card"><h3>记录与同步</h3>
          <label>历史保留条数<input name="historyLimit" type="number" min="10" max="200"></label>
          <label class="swz-check"><input name="syncMvu" type="checkbox">最新摘要同步回 MVU</label>
          <p>完整历史保存在脚本变量；MVU仅保存每个频道的最新摘要。</p>
        </section>

        <section class="swz-setting-card"><h3>实体收音机效果</h3>
          <label class="swz-check"><input name="sound" type="checkbox">按钮与调频音效</label>
          <label>静电强度 <em data-s-value="static">32%</em><input name="static" type="range" min="0" max="100"></label>
          <label>收音机缩放 <em data-s-value="scale">100%</em><input name="scale" type="range" min="80" max="120"></label>
          <label class="swz-check"><input name="inline" type="checkbox">在最新角色回复末尾显示收音机</label>
          <label class="swz-check"><input name="showEmpty" type="checkbox">没有广播时也显示设备</label>
        </section>
      </div>
      <div class="swz-setting-footer"><button data-s-action="clear-history">清空广播历史</button><button class="primary" data-s-action="save">保存设置</button></div>
    </div>
  </div>`;
}

function bars(signal){
  const n=signal==='强'?5:signal==='一般'?4:signal==='微弱'?2:1;
  return [1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('');
}

function renderRadio(){
  const root=document.getElementById(ROOT); if(!root) return;
  const c=channels[store.state.channel]||channels.muchi;
  const item=latest(store.state.channel);
  root.classList.toggle('is-off',!store.state.power);
  root.classList.toggle('is-muted',!!store.state.mute);
  root.classList.toggle('light-off',!store.state.light);
  root.classList.toggle('hold-on',!!store.state.hold);
  root.classList.toggle('is-busy',isBusy());
  root.style.setProperty('--mr87-scale',String(clamp(store.settings.scale,80,120)/100));
  root.querySelector('.mr87-power-led')?.classList.toggle('on',!!store.state.power);
  root.querySelector('.mr87-freq').textContent=c.freq;
  root.querySelector('.mr87-band').textContent=c.band;
  root.querySelector('.mr87-station').textContent=`${c.label} · ${c.short}`;
  root.querySelector('.mr87-volume-num').textContent=Math.round(store.state.volume);
  root.querySelector('.mr87-volume')?.style.setProperty('--rot',`${-135+(store.state.volume/100)*270}deg`);
  root.querySelectorAll('[data-r-channel]').forEach(b=>b.classList.toggle('active',b.dataset.rChannel===store.state.channel));
  const receive=root.querySelector('[data-r-action="receive"]'); if(receive){receive.disabled=isBusy();receive.textContent=isBusy()?'接收中…':'接收新播报';}
  if(!item){root.querySelector('.mr87-bars').innerHTML=bars('断续');root.querySelector('.mr87-signal-text').textContent='NO DATA';root.querySelector('.mr87-time').textContent='--';root.querySelector('.mr87-source').textContent='暂无广播';root.querySelector('.mr87-headline').textContent='等待接收';root.querySelector('.mr87-transcript').textContent='按下「接收新播报」从当前世界状态生成广播。';}
  else{root.querySelector('.mr87-bars').innerHTML=bars(item.signal);root.querySelector('.mr87-signal-text').textContent=item.signal;root.querySelector('.mr87-time').textContent=item.eventTime;root.querySelector('.mr87-source').textContent=item.source;root.querySelector('.mr87-headline').textContent=item.headline;root.querySelector('.mr87-transcript').textContent=item.transcript||item.summary;}
  renderLog();
}

function renderLog(){
  const root=document.getElementById(ROOT); if(!root) return;
  const host=root.querySelector('.mr87-log-list'); if(!host) return;
  host.innerHTML='';
  if(!store.history.length){host.innerHTML='<div class="mr87-empty">还没有广播记录。</div>';return;}
  store.history.slice(0,12).forEach((x,i)=>{
    const c=channels[x.channel]||channels.muchi;
    const b=document.createElement('button');
    b.className='mr87-log-item';b.dataset.logIndex=String(i);
    b.innerHTML=`<span>${esc(c.band)} ${esc(c.freq)}</span><b>${esc(x.headline||x.category||'广播')}</b><small>${esc(x.eventTime)} · ${esc(x.source)}</small>`;
    host.appendChild(b);
  });
}

function renderSettings(){
  const r=document.getElementById(SETTINGS); if(!r) return;
  const s=store.settings;
  const set=(name,v)=>{const e=r.querySelector(`[name="${name}"]`);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v??''};
  set('mode',s.mode);set('proxyPreset',s.proxyPreset);set('apiUrl',s.apiUrl);set('apiKey',getApiKey());set('rememberKey',s.rememberKey);set('model',s.model);set('modelCustom',s.model);set('source',s.source);set('temperature',s.temperature);set('maxTokens',s.maxTokens);set('auto',s.auto);set('hours',s.hours);set('dateRefresh',s.dateRefresh);set('locationRefresh',s.locationRefresh);set('autoChannel',s.autoChannel);set('historyLimit',s.historyLimit);set('syncMvu',s.syncMvu);set('civilian',s.civilian);set('tension',s.tension);set('repeatGuard',s.repeatGuard);set('extra',s.extra);set('sound',s.sound);set('static',s.static);set('scale',s.scale);set('inline',s.inline);set('showEmpty',s.showEmpty);
  r.querySelector('[data-s-value="temperature"]').textContent=Number(s.temperature).toFixed(2);
  r.querySelector('[data-s-value="civilian"]').textContent=`${s.civilian}%`;
  r.querySelector('[data-s-value="static"]').textContent=`${s.static}%`;
  r.querySelector('[data-s-value="scale"]').textContent=`${s.scale}%`;
  r.querySelectorAll('.swz-engine').forEach(x=>x.style.display=x.dataset.engine===s.mode?'grid':'none');
}

function readSettings(){
  const r=document.getElementById(SETTINGS); if(!r)return;
  const v=n=>r.querySelector(`[name="${n}"]`)?.value??'';
  const c=n=>!!r.querySelector(`[name="${n}"]`)?.checked;
  store.settings.mode=v('mode')||'main';store.settings.proxyPreset=v('proxyPreset');store.settings.apiUrl=v('apiUrl');setApiKey(v('apiKey'));store.settings.rememberKey=c('rememberKey');store.settings.model=store.settings.mode==='custom'?v('modelCustom'):v('model');store.settings.source=v('source')||'openai';store.settings.temperature=clamp(v('temperature'),0,2);store.settings.maxTokens=clamp(v('maxTokens'),128,1400);store.settings.auto=c('auto');store.settings.hours=clamp(v('hours'),1,48);store.settings.dateRefresh=c('dateRefresh');store.settings.locationRefresh=c('locationRefresh');store.settings.autoChannel=v('autoChannel')||'context';store.settings.historyLimit=clamp(v('historyLimit'),10,200);store.settings.syncMvu=c('syncMvu');store.settings.civilian=clamp(v('civilian'),0,100);store.settings.tension=v('tension')||'balanced';store.settings.repeatGuard=c('repeatGuard');store.settings.extra=v('extra');store.settings.sound=c('sound');store.settings.static=clamp(v('static'),0,100);store.settings.scale=clamp(v('scale'),80,120);store.settings.inline=c('inline');store.settings.showEmpty=c('showEmpty');store.settings.apiKey=store.settings.rememberKey?getApiKey():'';save();renderSettings();mountInline();
}

export function openSettings(){renderSettings();const r=document.getElementById(SETTINGS);if(r){r.classList.add('open');r.setAttribute('aria-hidden','false');}}
export function closeSettings(){const r=document.getElementById(SETTINGS);if(r){r.classList.remove('open');r.setAttribute('aria-hidden','true');}}

export function mountInline(){
  document.querySelectorAll(`.${INLINE_CLASS}`).forEach((el,i,arr)=>{if(i<arr.length-1)el.remove()});
  const item=latest(store.state.channel);
  if(!store.settings.inline || (!store.settings.showEmpty && !item)){document.getElementById(ROOT)?.remove();return;}
  const mes=getLatestAssistantMessage();
  const host=getMessageContentHost(mes);
  if(!host)return;
  let root=document.getElementById(ROOT);
  if(!root){host.insertAdjacentHTML('beforeend',inlineHtml());root=document.getElementById(ROOT);bindInline(root);} else if(root.parentElement!==host){root.remove();host.insertAdjacentHTML('beforeend',inlineHtml());root=document.getElementById(ROOT);bindInline(root);}
  renderRadio();
}

function bindInline(root){
  root.addEventListener('click',async e=>{
    const ch=e.target.closest('[data-r-channel]');if(ch){switchChannel(ch.dataset.rChannel);return;}
    const b=e.target.closest('[data-r-action]');if(!b)return;const a=b.dataset.rAction;
    if(a==='settings'){openSettings();return;}
    if(a==='prev'){cycle(-1);return;}if(a==='next'){cycle(1);return;}
    if(a==='scan'){noise(.4);root.classList.add('scanning');setTimeout(()=>{cycle(1);root.classList.remove('scanning')},520);return;}
    if(a==='receive'){if(store.state.power)await generate(store.state.channel,'manual');return;}
    if(a==='power'){store.state.power=!store.state.power;clickSound();save();renderRadio();return;}
    if(a==='mute'){store.state.mute=!store.state.mute;save();renderRadio();return;}
    if(a==='light'){store.state.light=!store.state.light;clickSound();save();renderRadio();return;}
    if(a==='hold'){store.state.hold=!store.state.hold;clickSound();save();renderRadio();return;}
    if(a==='log'){root.classList.toggle('log-open');clickSound();return;}
    if(a==='preset'){b.classList.toggle('active');clickSound();return;}
    if(a==='tune'){noise(.08);b.style.setProperty('--rot',`${Math.round(Math.random()*90-45)}deg`);return;}
    if(a==='volume'){store.state.volume=store.state.volume>=90?20:store.state.volume+10;save();renderRadio();clickSound();return;}
  });
  root.addEventListener('click',e=>{const row=e.target.closest('[data-log-index]');if(!row)return;const x=store.history[Number(row.dataset.logIndex)];if(!x)return;store.state.channel=x.channel;save();renderRadio();root.classList.remove('log-open');});
  root.querySelector('.mr87-volume')?.addEventListener('wheel',e=>{e.preventDefault();store.state.volume=clamp(store.state.volume+(e.deltaY<0?5:-5),0,100);save();renderRadio();},{passive:false});
}

function bindSettings(){
  const r=document.getElementById(SETTINGS); if(!r)return;
  r.addEventListener('click',async e=>{
    if(e.target===r){closeSettings();return;}
    const b=e.target.closest('[data-s-action]');if(!b)return;const a=b.dataset.sAction;
    if(a==='close'){closeSettings();return;}
    if(a==='save'){readSettings();toastr?.success?.('收音机设置已保存');closeSettings();return;}
    if(a==='test'){readSettings();b.disabled=true;b.textContent='测试中…';try{await testConnection();toastr?.success?.('API连接正常')}catch(err){toastr?.error?.(`API测试失败：${err?.message||err}`)}finally{b.disabled=false;b.textContent='测试连接'}return;}
    if(a==='clear-history'){clearHistory();toastr?.info?.('广播历史已清空');return;}
  });
  r.addEventListener('input',e=>{const n=e.target.name;if(n==='temperature')r.querySelector('[data-s-value="temperature"]').textContent=Number(e.target.value).toFixed(2);if(n==='civilian')r.querySelector('[data-s-value="civilian"]').textContent=`${e.target.value}%`;if(n==='static')r.querySelector('[data-s-value="static"]').textContent=`${e.target.value}%`;if(n==='scale'){r.querySelector('[data-s-value="scale"]').textContent=`${e.target.value}%`;document.getElementById(ROOT)?.style.setProperty('--mr87-scale',String(clamp(e.target.value,80,120)/100));}});
  r.addEventListener('change',e=>{if(e.target.name==='mode'){store.settings.mode=e.target.value;renderSettings();}});
}

export function installUi(){
  ensureStyle();
  if(!document.getElementById(SETTINGS)){document.body.insertAdjacentHTML('beforeend',settingsHtml());bindSettings();}
  setRenderer((type,payload)=>{if(type==='error'){const root=document.getElementById(ROOT);if(root){root.querySelector('.mr87-headline').textContent='接收失败';root.querySelector('.mr87-transcript').textContent=String(payload||'未知错误')}} else renderRadio();});
  try{appendInexistentScriptButtons?.([{name:'收音机设置',visible:true}]);eventOn?.(getButtonEvent?.('收音机设置'),openSettings);}catch{}
  try{eventOn?.('swz:open-radio-settings',openSettings);eventOn?.('swz:open-radio',()=>{mountInline();document.getElementById(ROOT)?.scrollIntoView({behavior:'smooth',block:'center'})});}catch{}
  mountInline();
}

export function refreshInlineSoon(){setTimeout(mountInline,120);}
