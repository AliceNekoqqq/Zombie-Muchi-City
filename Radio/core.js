export const VERSION='1.11.0';

export const channels={
  global:{label:'全球',short:'INTL',band:'SW',freq:'9.650',delay:'2至7天',scope:'全球感染、跨国交通通信、国际医疗、人道援助。不得出现暮迟市街区级即时信息。'},
  china:{label:'中国',short:'CN',band:'SW',freq:'7.210',delay:'6至36小时',scope:'跨区域避难、交通、电网、公共卫生、救援与公开医疗进展。'},
  muchi:{label:'暮迟市',short:'MUCHI',band:'FM',freq:'88.7',delay:'数分钟至12小时',scope:'暮迟市道路桥梁、尸群迁移、供水供电、天气、通信、避难点与普通幸存者信息。'}
};

const KEY='muchi_radio_v3';
const defaults={
  settings:{
    mode:'none',proxyPreset:'',proxyModelOverride:false,proxyModel:'',apiUrl:'',apiKey:'',rememberKey:false,customModel:'',model:'',source:'openai',temperature:.85,settingsRevision:200,
    mainSampling:'inherit',proxySampling:'inherit',customSampling:'custom',
    auto:true,hours:6,dateRefresh:true,locationRefresh:true,initialBroadcast:true,autoChannel:'context',
    historyLimit:60,syncMvu:true,injectStory:true,applyEvents:true,syncClues:true,
    civilian:34,tension:'balanced',diversity:'natural',songRequests:true,storyArcs:true,repeatGuard:true,extra:'',sound:true,static:32,scale:100,inline:true,showIdle:false,
    intelDailyAttempts:2,intelMaxRegions:3,intelStaleDays:3
  },
  state:{
    channel:'muchi',power:true,mute:false,light:true,hold:false,volume:48,
    lastStamp:'',lastLocation:'',rotate:0,pendingStoryId:'',pendingStoryIds:[],displayMessageId:'',displayBroadcastId:'',manualChannels:['muchi']
  },
  intel:{day:0,status:'idle',attempts:0,rerolls:0,baseline:null,directorBaseline:null,broadcastId:'',regions:[],lastStamp:''},
  director:{recent:[],arcs:[],serial:0},
  history:[]
};

export const store=structuredClone(defaults);
let sessionKey='',busy=false,render=()=>{},audio=null,activeRequest=null,requestSeq=0;

const LOCAL_SETTINGS_KEY='mr87_global_settings_v1';
const LOCAL_CUSTOM_PRESETS_KEY='mr87_custom_api_presets_v1';

function browserStorage(){
  const getters=[
    ()=>globalThis.$?.('body')?.[0]?.ownerDocument?.defaultView?.localStorage,
    ()=>globalThis.parent?.localStorage,
    ()=>globalThis.localStorage
  ];
  for(const get of getters){try{const s=get();if(s){const t='__mr87_storage_test__';s.setItem(t,'1');s.removeItem(t);return s}}catch{}}
  return null;
}
function readLocal(key,fallback=null){try{const s=browserStorage(),raw=s?.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){console.warn('[MR-87] local read',e);return fallback}}
function writeLocal(key,value){try{const s=browserStorage();if(!s)return false;s.setItem(key,JSON.stringify(value));return true}catch(e){console.warn('[MR-87] local write',e);return false}}
function persistSettingsLocal(){
  const copy=structuredClone(store.settings);
  copy.apiKey=copy.rememberKey?(sessionKey||copy.apiKey||''):'';
  copy.settingsRevision=200;
  return writeLocal(LOCAL_SETTINGS_KEY,copy);
}
export function settingsPersistenceInfo(){return{scope:'browser-local',available:!!browserStorage(),key:LOCAL_SETTINGS_KEY}}
export function listCustomApiPresets(){
  const all=readLocal(LOCAL_CUSTOM_PRESETS_KEY,{})||{};
  return Object.keys(all).sort((a,b)=>a.localeCompare(b,'zh-CN')).map(name=>({name,...structuredClone(all[name])}));
}
export function getCustomApiPreset(name){
  const all=readLocal(LOCAL_CUSTOM_PRESETS_KEY,{})||{},v=all[String(name||'').trim()];
  return v?structuredClone(v):null;
}
export function saveCustomApiPreset(name,data={}){
  const n=String(name||'').trim();if(!n)throw Error('请输入独立 API 预设名称');if(n.length>60)throw Error('预设名称不能超过60个字符');
  const all=readLocal(LOCAL_CUSTOM_PRESETS_KEY,{})||{};
  const rememberKey=!!data.rememberKey;
  all[n]={source:String(data.source||'openai'),apiUrl:String(data.apiUrl||'').trim(),apiKey:rememberKey?String(data.apiKey||''):'',rememberKey,customModel:String(data.customModel||'').trim(),customSampling:data.customSampling==='inherit'?'inherit':'custom',temperature:clamp(data.temperature,0,2),updatedAt:Date.now()};
  if(!all[n].apiUrl)throw Error('保存预设前请填写 API URL');
  if(!all[n].customModel)throw Error('保存预设前请选择或填写模型');
  if(!writeLocal(LOCAL_CUSTOM_PRESETS_KEY,all))throw Error('浏览器本地存储不可用，无法保存预设');
  return structuredClone(all[n]);
}
export function deleteCustomApiPreset(name){
  const n=String(name||'').trim(),all=readLocal(LOCAL_CUSTOM_PRESETS_KEY,{})||{};if(!n||!all[n])return false;delete all[n];return writeLocal(LOCAL_CUSTOM_PRESETS_KEY,all);
}
export function hasGenerationSource(){
  const s=store.settings;if(s.mode==='main')return true;if(s.mode==='proxy')return !!String(s.proxyPreset||'').trim();if(s.mode==='custom')return !!String(s.apiUrl||'').trim()&&!!String(s.customModel||s.model||'').trim();return false;
}
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const uniq=a=>[...new Set((Array.isArray(a)?a:[]).filter(Boolean).map(String))];
export const isBusy=()=>busy;
export const getActiveRequest=()=>activeRequest?{generationId:activeRequest.generationId,channels:[...(activeRequest.channels||[])],reason:activeRequest.reason,route:activeRequest.route,startedAt:activeRequest.startedAt,cancelled:!!activeRequest.cancelled}:null;
export const canCancelGeneration=()=>!!(busy&&activeRequest?.generationId&&!activeRequest?.cancelled);
export const setRenderer=fn=>{render=typeof fn==='function'?fn:()=>{}};
export const getApiKey=()=>sessionKey||(store.settings.rememberKey?store.settings.apiKey:'');
export const setApiKey=v=>{sessionKey=String(v||'')};


function tavernHelperFn(name){
  try{if(typeof globalThis[name]==='function')return globalThis[name].bind(globalThis)}catch{}
  try{const fn=globalThis.TavernHelper?.[name];if(typeof fn==='function')return fn.bind(globalThis.TavernHelper)}catch{}
  return null;
}

/** 酒馆助手 4.8.3+：读取酒馆中已经保存的代理预设名称。 */
export function getProxyPresets(){
  const fn=tavernHelperFn('getProxyPresetNames');
  if(!fn)return [];
  try{return uniq(fn()).sort((a,b)=>a.localeCompare(b,'zh-CN'))}catch(e){console.warn('[MR-87] getProxyPresetNames',e);return []}
}

/** 酒馆助手 4.5.5+：按独立 API 地址和 Key 拉取模型列表。 */
export async function fetchModelList(apiurl,key=''){
  const fn=tavernHelperFn('getModelList');
  if(!fn)throw Error('当前酒馆助手版本不支持拉取模型，请更新酒馆助手或手动填写模型名');
  const url=String(apiurl||'').trim();
  if(!url)throw Error('请先填写 API URL');
  const list=await fn({apiurl:url,key:String(key||'')});
  const models=uniq(list).sort((a,b)=>a.localeCompare(b,'en'));
  if(!models.length)throw Error('接口没有返回可用模型');
  return models;
}

export function generationCapabilities(){
  return {proxyPresets:!!tavernHelperFn('getProxyPresetNames'),modelList:!!tavernHelperFn('getModelList')};
}

function requestError(message,code){const e=new Error(message);e.code=code;return e}
function stopGenerationRequest(id){
  const fn=tavernHelperFn('stopGenerationById');
  if(!fn)return false;
  try{return !!fn(String(id||''))}catch(e){console.warn('[MR-87] stopGenerationById',e);return false}
}
export function cancelActiveGeneration(){
  const req=activeRequest;
  if(!req||!busy||!req.generationId||req.cancelled)return false;
  req.cancelled=true;
  const stopped=stopGenerationRequest(req.generationId);
  try{req.rejectCancel?.(requestError('用户取消了本次广播请求','MR87_CANCELLED'))}catch{}
  render('busy',true);
  return stopped||true;
}

export function load(){
  try{
    const root=getVariables?.({type:'script'})||{};
    const v=root[KEY]||root.muchi_radio_v2||{};
    const localSettings=readLocal(LOCAL_SETTINGS_KEY,null);
    const legacySettings=v.settings&&typeof v.settings==='object'?v.settings:null;
    const sourceSettings=localSettings||legacySettings||{};
    store.settings={...defaults.settings,...sourceSettings};
    const legacyModel=String(sourceSettings?.model||'');
    if(!store.settings.customModel&&sourceSettings?.mode==='custom')store.settings.customModel=legacyModel;
    if(!store.settings.proxyModel&&sourceSettings?.mode==='proxy')store.settings.proxyModel=legacyModel;
    if(typeof store.settings.proxyModelOverride!=='boolean')store.settings.proxyModelOverride=!!store.settings.proxyModel;
    if(Number(sourceSettings?.settingsRevision||0)<120&&Number(sourceSettings?.temperature)===.72)store.settings.temperature=.85;
    if(!['none','main','proxy','custom'].includes(store.settings.mode))store.settings.mode='none';
    store.settings.settingsRevision=200;delete store.settings.maxTokens;

    const hadManualChannels=Array.isArray(v.state?.manualChannels);
    store.state={...defaults.state,...(v.state||{})};
    if(!Array.isArray(store.state.pendingStoryIds))store.state.pendingStoryIds=store.state.pendingStoryId?[store.state.pendingStoryId]:[];
    store.state.manualChannels=hadManualChannels?uniq(store.state.manualChannels).filter(k=>channels[k]):[store.state.channel||'muchi'];
    if(!store.state.manualChannels.length)store.state.manualChannels=[store.state.channel||'muchi'];
    store.intel={...defaults.intel,...(v.intel||{})};
    if(!['idle','no_intel','settled','exhausted'].includes(store.intel.status))store.intel.status='idle';
    if(!Array.isArray(store.intel.regions))store.intel.regions=[];
    store.director={...defaults.director,...(v.director||{})};
    if(!Array.isArray(store.director.recent))store.director.recent=[];
    if(!Array.isArray(store.director.arcs))store.director.arcs=[];
    store.history=Array.isArray(v.history)?v.history:[];
    if(store.settings.rememberKey)sessionKey=store.settings.apiKey||'';
    if(!localSettings&&legacySettings)persistSettingsLocal();
  }catch(e){console.warn('[MR-87] load',e)}
}

export function save(){
  try{
    const localSaved=persistSettingsLocal();
    const copy=structuredClone(store);
    // 正常环境把设置存到酒馆主页面 localStorage，实现跨角色卡 / 跨聊天复用。
    // 如果浏览器禁用了 localStorage，则保留旧的脚本变量设置作为当前剧情兜底，避免重载即丢失。
    if(localSaved)delete copy.settings;
    else{copy.settings=structuredClone(store.settings);copy.settings.apiKey='';}
    copy.history=copy.history.slice(0,clamp(store.settings.historyLimit,10,200));
    copy.director={...(copy.director||{}),recent:(copy.director?.recent||[]).slice(0,30),arcs:(copy.director?.arcs||[]).slice(0,6)};
    updateVariablesWith?.(v=>{v[KEY]=copy;return v},{type:'script'});
  }catch(e){console.warn('[MR-87] save',e)}
}

const AREA={
  '地下安全屋':'河西旧城边缘','暮迟一中':'西北学区','雁回住宅区':'西北住宅片区','槐安公寓':'雁回住宅片区',
  '河西体育中心':'河西西部','瑞康药房':'河西中部','锦河商圈':'河西中心','河西旧街':'河西旧城区',
  '河西社区医院':'河西南部医疗片区','南桥检查点':'暮江南桥','南郊工业区':'暮江东南工业带'
};


const REGIONS=[
  {id:'01',name:'河西区',type:'城区',risk:'中',baseResource:39,baseHorde:41,note:'旧城、学区与体育设施混合，人口密度中等。'},
  {id:'02',name:'锦河商圈',type:'商业区',risk:'高',baseResource:64,baseHorde:57,note:'核心商业带，店铺多但反复遭搜刮，人流与尸群都较集中。'},
  {id:'03',name:'西郊居民区',type:'居民区',risk:'中',baseResource:53,baseHorde:42,note:'住宅密集，家庭储备分散，楼栋内部威胁不均。'},
  {id:'04',name:'西南工业区',type:'工业区',risk:'高',baseResource:55,baseHorde:48,note:'厂房与仓储混合，工具材料较多，存在机械与火灾风险。'},
  {id:'05',name:'南桥',type:'交通节点',risk:'极高',baseResource:19,baseHorde:66,note:'主要跨江通道，车辆路障形成瓶颈，尸群迁徙与救援行动最容易改变这里。'},
  {id:'06',name:'东城旧区',type:'旧城区',risk:'高',baseResource:45,baseHorde:58,note:'街巷老旧、视野受限，废墟与堵塞较多。'},
  {id:'07',name:'河东医疗区',type:'医疗区',risk:'极高',baseResource:68,baseHorde:84,note:'医院与医疗设施集中，物资价值高，但爆发初期聚集大量伤员。'},
  {id:'08',name:'南郊工业区',type:'工业区',risk:'高',baseResource:63,baseHorde:54,note:'东南岸工业带，道路宽但噪声、化学品与厂房盲区风险明显。'},
  {id:'09',name:'暮迟机场',type:'交通枢纽',risk:'高',baseResource:48,baseHorde:69,note:'航站区与停车区开阔，遗留物资分散，事故车辆与感染者聚集概率高。'},
  {id:'10',name:'临江大学城',type:'大学城',risk:'中高',baseResource:56,baseHorde:50,note:'校园建筑密集，生活物资和医务室资源可能残留。'},
  {id:'11',name:'北山风景区',type:'山林',risk:'未知',baseResource:42,baseHorde:28,note:'山林开阔但通信差，尸群通常较城区稀疏，真实情况更难确认。'}
];
const REGION_BY_ID=Object.fromEntries(REGIONS.map(r=>[r.id,r]));
const REGION_BY_NAME=Object.fromEntries(REGIONS.map(r=>[r.name,r]));
const deepClone=v=>{try{return structuredClone(v)}catch{return JSON.parse(JSON.stringify(v??{}))}};

const DIRECTOR_MODES={
  steady:{label:'稳健',common:88,uncommon:11,rare:1,continuation:.48,humanity:.68,secondary:.10,arcStart:.42,repeatPenalty:.20},
  natural:{label:'自然',common:74,uncommon:21,rare:5,continuation:.38,humanity:1,secondary:.24,arcStart:.36,repeatPenalty:.13},
  rich:{label:'丰富',common:58,uncommon:31,rare:11,continuation:.28,humanity:1.28,secondary:.42,arcStart:.30,repeatPenalty:.08},
  chaotic:{label:'混乱',common:45,uncommon:37,rare:18,continuation:.20,humanity:1.55,secondary:.58,arcStart:.22,repeatPenalty:.05}
};
const EVENT_POOLS={
  global:[
    {id:'intl_outbreak',label:'海外感染态势',w:14,arc:true},{id:'intl_research',label:'公开科研/医疗进展',w:11,arc:true},{id:'intl_aid',label:'跨国人道援助',w:10,arc:true},{id:'intl_transport',label:'航空/海运/边境交通',w:10,arc:true},{id:'intl_supply',label:'全球供应链与物资',w:8,arc:true},{id:'intl_comms',label:'国际通信与广播恢复',w:7,arc:true},{id:'intl_weather',label:'极端天气对灾区的影响',w:5,arc:false},{id:'intl_refugee',label:'跨境避难与安置',w:8,arc:true}
  ],
  china:[
    {id:'cn_transport',label:'跨区域交通与封控',w:13,arc:true},{id:'cn_evac',label:'撤离/安置调整',w:11,arc:true},{id:'cn_grid',label:'电网/供水/通信',w:10,arc:true},{id:'cn_medical',label:'医疗与公共卫生',w:10,arc:true},{id:'cn_rescue',label:'救援力量与物资调度',w:9,arc:true},{id:'cn_city',label:'其他城市公开态势',w:8,arc:true},{id:'cn_weather',label:'天气与灾害影响',w:6,arc:false},{id:'cn_rumor',label:'跨城传闻待核实',w:3,arc:false}
  ],
  muchi:[
    {id:'mu_horde',label:'尸群迁移/聚集/消散',w:14,map:true,arc:true},{id:'mu_supply',label:'食品/药品/燃料等物资变化',w:12,map:true,arc:true},{id:'mu_road',label:'道路/桥梁/检查点通行',w:11,map:true,arc:true},{id:'mu_grid',label:'供电/供水/通信异常',w:10,map:true,arc:true},{id:'mu_survivor',label:'普通幸存者活动与聚居点',w:9,map:true,arc:true},{id:'mu_rescue',label:'救援/撤离/临时车队',w:7,map:true,arc:true},{id:'mu_fire',label:'火灾/事故/噪声事件',w:6,map:true,arc:true},{id:'mu_health',label:'医院/药房/公共卫生消息',w:7,map:true,arc:true},{id:'mu_weather',label:'天气对街区行动的影响',w:5,map:false,arc:false},{id:'mu_comms',label:'本地频段/中继站/广播恢复',w:6,map:false,arc:true},{id:'mu_shelter',label:'避难点与临时秩序',w:6,map:true,arc:true},{id:'mu_rumor',label:'来源不明的本地传闻',w:4,map:false,arc:false}
  ]
};
const REGION_AFFINITY={
  mu_horde:{'02':1.5,'05':1.4,'06':1.6,'07':1.7,'09':1.5},
  mu_supply:{'02':2.5,'04':1.8,'08':2.0,'09':1.4,'10':1.3},
  mu_road:{'05':3.2,'09':1.7,'02':1.4,'06':1.3},
  mu_grid:{'01':1.3,'02':1.4,'03':1.2,'04':1.4,'08':1.5,'10':1.3},
  mu_survivor:{'01':1.5,'03':1.7,'06':1.5,'10':1.8},
  mu_rescue:{'05':1.8,'07':1.8,'09':1.7,'10':1.3},
  mu_fire:{'02':1.5,'04':2.0,'06':1.4,'08':2.1},
  mu_health:{'07':3.8,'01':1.3,'02':1.2,'10':1.4},
  mu_weather:{'05':1.3,'09':1.2,'11':1.7},
  mu_comms:{'09':1.4,'10':1.5,'11':1.6},
  mu_shelter:{'01':1.6,'03':1.8,'06':1.4,'10':1.7}
};
const FORMS={
  global:[['news','国际新闻摘要',12],['agency','国际机构通告',8],['relay','海外电台转录',7],['brief','研究/救援简报',6],['signal','远距离残缺信号',4]],
  china:[['bulletin','应急广播',12],['traffic','交通公告',9],['relay','地方转播汇总',8],['brief','新闻快讯',8],['dispatch','救援调度通报',6]],
  muchi:[['local_news','本地新闻快报',12],['emergency','紧急插播',8],['traffic','道路通告',8],['survivor_relay','幸存者频段转述',8],['damaged','失真录音/断续信号',5],['auto_loop','旧自动广播残片',4],['witness','目击者来电转述',7],['digest','短讯汇总',8],['late_night','夜间小节目',3]]
};
const HUMANITY_POOL=[
  {id:'song_request',label:'幸存者点歌',w:10,guide:'有人点播一首歌，重点写点播者/接收者/一句留言与电台气氛。可给出现实歌曲名与歌手（有把握时）；现实歌曲歌词只允许极短引用，不超过10个词，不要输出整段或连续多行歌词。若使用虚构/原创歌曲，可以写2—4行原创歌词片段，让点歌真的有“听见了一小段歌”的感觉。'},
  {id:'missing_person',label:'寻人启事',w:14,guide:'一条克制的寻人/报平安信息，包含最后见到地点与一句私人留言，不得直接变成任务。'},
  {id:'barter',label:'物物交换',w:12,guide:'一条符合末日供需的交换信息，物品价值要大致合理，可带一点广播员吐槽。'},
  {id:'birthday',label:'生日/纪念日留言',w:6,guide:'极短的生日或纪念日祝福，利用末日环境形成反差，但不要煽情过度。'},
  {id:'pet',label:'寻找宠物',w:8,guide:'寻找宠物或有人目击宠物的消息，可以形成轻量连续小事件。'},
  {id:'lost_found',label:'失物招领',w:7,guide:'末日里有点荒诞但可信的失物招领，不要涉及关键剧情道具。'},
  {id:'checkin_87',label:'“87报平安”频道文化',w:11,guide:'幸存者用“87”作为“今天还活着/这里有人”的简短报平安暗号，保持像逐渐形成的本地频道习惯。'},
  {id:'black_humor',label:'幸存者黑色幽默/吐槽',w:10,guide:'只加一个轻度末日黑色幽默或广播圈内部梗，来自生活困境，不要连续抛网络梗。'},
  {id:'message_wall',label:'匿名留言墙',w:9,guide:'一条匿名留言、感谢、抱怨或给陌生人的回复，体现城市里仍有人互相听见。'},
  {id:'old_ad',label:'旧广告/自动播报残片',w:5,guide:'插入一小段虚构旧商业广告、地铁/商场自动播报残片，再由当前广播语境形成反差。不要大段复刻现实广告词。'},
  {id:'odd_signal',label:'奇怪但未必超自然的频段',w:4,guide:'出现难以解释的重复呼号、灯光/噪声传闻或错误频率，保持可由设备、人为或误传解释，不引入真正超自然设定。'},
  {id:'midnight',label:'午夜读书/故事/聊天节目',w:4,guide:'有人在夜间用私人频段念故事、讲几句话或陪伴陌生听众，篇幅很短，不抢主情报。'}
];
const STAGES=[['new','刚出现',10],['developing','正在发展',12],['aftermath','事件余波',7],['stabilizing','暂时稳定',5],['uncertain','尚未证实',5]];
const RELIABILITY=[['confirmed','多源确认/较可靠',12],['partial','信息不完整但可信',10],['rumor','单一来源/传闻',4],['conflict','互相矛盾的消息',2]];
const MOODS=[['restrained','克制实用',12],['tense','紧张但不夸张',7],['human','有人情味',6],['dry','冷幽默/疲惫感',4],['eerie','安静诡异但非超自然',3]];

function rng(){try{const a=new Uint32Array(1);globalThis.crypto?.getRandomValues?.(a);if(a[0])return a[0]/4294967296}catch{}return Math.random()}
function token(){return `${Date.now().toString(36)}-${Math.floor(rng()*0xffffff).toString(36)}`}
function weighted(items,weightFn=x=>x?.w??1){const rows=(items||[]).map(x=>[x,Math.max(0,Number(weightFn(x))||0)]).filter(x=>x[1]>0);if(!rows.length)return items?.[0]||null;const sum=rows.reduce((a,x)=>a+x[1],0);let r=rng()*sum;for(const [x,w] of rows){r-=w;if(r<=0)return x}return rows[rows.length-1][0]}
function modeProfile(){return DIRECTOR_MODES[store.settings.diversity]||DIRECTOR_MODES.natural}
function recentDirector(k){return (store.director?.recent||[]).filter(x=>x.channel===k).slice(0,10)}
function repeatFactor(k,field,value){if(!store.settings.repeatGuard||!value)return 1;const recent=recentDirector(k),idx=recent.findIndex(x=>x?.[field]===value);if(idx<0)return 1;const p=modeProfile().repeatPenalty;return idx<2?p:idx<5?Math.sqrt(p):.72}
function exactFingerprintRecent(fp){return !!(store.settings.repeatGuard&&fp&&(store.director?.recent||[]).slice(0,14).some(x=>x.fingerprint===fp))}
function rarity(profile){return weighted([['common','普通',profile.common],['uncommon','少见',profile.uncommon],['rare','稀有',profile.rare]],x=>x[2])}
function pickTuple(rows,k,field){return weighted(rows,x=>x[2]*repeatFactor(k,field,x[0]))}
function pickRegion(k,w,route,theme,avoid=[]){
  if(k!=='muchi')return null;
  const recent=recentDirector(k);return weighted(REGIONS,r=>{
    let wt=Number(REGION_AFFINITY[theme?.id]?.[r.id]||1);const state=w.intel?.[r.name]||{};
    if(route==='settle'&&(state.情报状态||'未知')==='未知')wt*=1.35;
    const last=recent.findIndex(x=>x.areaId===r.id);if(last===0)wt*=.18;else if(last>0&&last<4)wt*=.48;
    const fp=`${k}|${theme.id}|${r.id}`;if(avoid.includes(fp))wt*=.02;if(exactFingerprintRecent(fp))wt*=.12;return wt;
  });
}
function humanityChance(profile){return Math.min(.78,Math.max(0,Number(store.settings.civilian||0))/100*profile.humanity)}
function pickHumanity(k,w){if(k!=='muchi'||rng()>humanityChance(modeProfile()))return null;const hour=Number(String(w?.time||'12:00').split(':')[0]||12),night=hour>=21||hour<5;return weighted(HUMANITY_POOL,x=>{if(x.id==='song_request'&&!store.settings.songRequests)return 0;if(x.id==='midnight'&&!night)return 0;return x.w*repeatFactor(k,'humanityId',x.id)})}
function parentShadowHint(k,w,human){
  if(k!=='muchi'||human?.id!=='missing_person')return'';
  const p=w?.raw?.暗线?.父母,day=Number(w?.day||1);
  if(!p||String(p.状态||'')!=='未寻获'||day<1||day>8)return'';
  if(day<=2)return '匿名弱提示候选：河西旧街附近有人见过一对中年夫妻从事故车辆旁互相搀扶离开，女方像医护人员，两人曾反复询问暮迟一中和安全路线，之后失去踪影。只可写成不确定的目击/寻人转述，不得点名身份。';
  if(day<=5)return '匿名弱提示候选：槐安公寓附近的邻里频段有人提到一对中年夫妻短暂返家，反复问一个高三女孩有没有回过小区，之后似乎又在打听南桥方向的撤离消息。不要给门牌或确认身份。';
  return '匿名弱提示候选：河西旧街一带曾收到很短的两人求救/敲击转述，像有一对中年幸存者被堵在临街仓房或后间附近；来源断续，具体门面无法确认。不要生成可导航坐标。';
}
function activeArcFor(k,w,profile,opts={}){
  if(!store.settings.storyArcs||opts.forceFresh||rng()>profile.continuation)return null;
  const arcs=(store.director?.arcs||[]).filter(a=>a.channel===k&&Number(a.expiresDay||0)>=Number(w.day||0));if(!arcs.length)return null;
  return weighted(arcs,a=>repeatFactor(k,'arcId',a.id));
}
function makeChannelPlan(k,w,route,opts={}){
  const profile=modeProfile(),avoid=Array.isArray(opts.avoidFingerprints)?opts.avoidFingerprints:[],arc=activeArcFor(k,w,profile,opts);
  let theme,area,continuation=false,arcId='',continuationContext='';
  if(arc){theme=(EVENT_POOLS[k]||[]).find(x=>x.id===arc.themeId)||weighted(EVENT_POOLS[k]);area=k==='muchi'?REGION_BY_ID[arc.areaId]||null:null;continuation=true;arcId=arc.id;continuationContext=arc.summary||arc.headline||''}
  else{
    for(let tries=0;tries<5;tries++){
      theme=weighted(EVENT_POOLS[k]||[],x=>x.w*repeatFactor(k,'themeId',x.id)*(route==='settle'&&k==='muchi'&&x.map?1.22:1));area=pickRegion(k,w,route,theme,avoid);
      const fp=`${k}|${theme.id}|${area?.id||'-'}`;if(!avoid.includes(fp)&&(!exactFingerprintRecent(fp)||tries===4))break;
    }
  }
  const hour=Number(String(w?.time||'12:00').split(':')[0]||12),night=hour>=21||hour<5,forms=(FORMS[k]||FORMS.muchi).filter(x=>x[0]!=='late_night'||night),form=pickTuple(forms,k,'formId'),stage=weighted(STAGES,x=>x[2]),rel=theme?.id==='mu_rumor'?weighted(RELIABILITY.filter(x=>x[0]==='rumor'||x[0]==='conflict'),x=>x[2]):weighted(RELIABILITY,x=>x[2]),mood=weighted(MOODS,x=>x[2]),rare=rarity(profile),human=pickHumanity(k,w),parentHint=parentShadowHint(k,w,human);
  let secondary=null;if(rng()<profile.secondary){secondary=weighted((EVENT_POOLS[k]||[]).filter(x=>x.id!==theme?.id),x=>x.w*.8*repeatFactor(k,'themeId',x.id))}
  const fingerprint=`${k}|${theme?.id||'misc'}|${area?.id||'-'}`;
  return{seed:token(),channel:k,themeId:theme?.id||'misc',themeLabel:theme?.label||'普通公共消息',mapEligible:!!theme?.map,arcEligible:!!theme?.arc,areaId:area?.id||'',areaName:area?.name||'',rarity:rare?.[0]||'common',rarityLabel:rare?.[1]||'普通',stageId:stage?.[0]||'new',stageLabel:stage?.[1]||'刚出现',reliabilityId:rel?.[0]||'partial',reliabilityLabel:rel?.[1]||'信息不完整但可信',moodId:mood?.[0]||'restrained',moodLabel:mood?.[1]||'克制实用',formId:form?.[0]||'bulletin',formLabel:form?.[1]||'广播',secondaryId:secondary?.id||'',secondaryLabel:secondary?.label||'',humanityId:human?.id||'',humanityLabel:human?.label||'',humanityGuide:human?.guide||'',parentHint,continuation,arcId,continuationContext,fingerprint};
}
function createDirectorPlan(keys,w,route,opts={}){return{mode:store.settings.diversity||'natural',variant:token(),byChannel:Object.fromEntries(keys.map(k=>[k,makeChannelPlan(k,w,route,opts)]))}}
function directorBrief(plan){if(!plan?.byChannel)return'无额外导演简报。';return Object.values(plan.byChannel).map(p=>{
  const lines=[`[${channels[p.channel]?.label||p.channel}] 变体=${p.seed}`,`主事件=${p.themeLabel}${p.areaId?`；优先涉及 ${p.areaId} ${p.areaName}`:''}`,`事件层级=${p.rarityLabel}；阶段=${p.stageLabel}；信息可靠度倾向=${p.reliabilityLabel}`,`地图候选=${p.channel==='muchi'?(p.mapEligible?'主事件可在有证据时支撑地图情报':'主事件通常不单独更新地图'):'不适用'}`,`播报形式=${p.formLabel}；情绪=${p.moodLabel}`];
  if(p.secondaryLabel)lines.push(`可选辅助信息=${p.secondaryLabel}（最多点到为止，不要抢主事件）`);
  if(p.continuation)lines.push(`连续事件：这是既有事件的后续，不要重新从头介绍。上次摘要=${p.continuationContext||'无'}`);
  if(p.humanityId)lines.push(`人味插播=${p.humanityLabel}。要求：${p.humanityGuide} 该插播只是生活/民间内容，不能作为地图数值变化的直接依据。`);else lines.push('人味插播=无；本条保持纯公共信息即可。');
  if(p.parentHint)lines.push(`暗线弱提示候选=${p.parentHint}`);
  return lines.join('\n');
}).join('\n\n')}
function compactDirectorMeta(p){return p?{seed:p.seed,fingerprint:p.fingerprint,themeId:p.themeId,themeLabel:p.themeLabel,areaId:p.areaId,areaName:p.areaName,formId:p.formId,formLabel:p.formLabel,humanityId:p.humanityId,humanityLabel:p.humanityLabel,rarity:p.rarity,stageId:p.stageId,reliabilityId:p.reliabilityId,continuation:!!p.continuation,arcId:p.arcId||''}:null}
function commitDirector(items,plan,w){
  if(!plan?.byChannel)return;const d=store.director||(store.director=deepClone(defaults.director)),profile=modeProfile();d.recent=Array.isArray(d.recent)?d.recent:[];d.arcs=Array.isArray(d.arcs)?d.arcs:[];
  for(const item of items||[]){const p=plan.byChannel[item.channel];if(!p)continue;item.director=compactDirectorMeta(p);d.recent.unshift({broadcastId:item.id,channel:item.channel,day:w.day,fingerprint:p.fingerprint,themeId:p.themeId,areaId:p.areaId,formId:p.formId,humanityId:p.humanityId,arcId:p.arcId||'',headline:item.headline,summary:item.summary});
    if(!store.settings.storyArcs||!p.arcEligible)continue;
    if(p.continuation&&p.arcId){const a=d.arcs.find(x=>x.id===p.arcId);if(a){a.lastDay=w.day;a.expiresDay=Math.max(Number(a.expiresDay||w.day),w.day+1);a.headline=item.headline;a.summary=item.summary}}
    else if(rng()<profile.arcStart){d.serial=Number(d.serial||0)+1;d.arcs.unshift({id:`a${w.day}-${d.serial}-${Math.floor(rng()*9999)}`,channel:item.channel,themeId:p.themeId,areaId:p.areaId,startedDay:w.day,lastDay:w.day,expiresDay:w.day+1+Math.floor(rng()*3),headline:item.headline,summary:item.summary})}
  }
  d.recent=d.recent.slice(0,30);d.arcs=d.arcs.filter(a=>Number(a.expiresDay||0)>=Number(w.day||0)-1).slice(0,6);
}


function splitTime(s){
  const t=String(s||'2024-10-27 19:42');
  const m=t.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  return m?{full:`${m[1]} ${m[2]}`,date:m[1],time:m[2]}:{full:t,date:t.slice(0,10),time:t.slice(11,16)||'00:00'};
}

function formatWeather(w){
  if(!w||typeof w!=='object')return String(w||'未知');
  const a=[];
  if(w.类型)a.push(String(w.类型));
  if(Number.isFinite(Number(w.环境温度)))a.push(`${Number(w.环境温度)}℃`);
  if(w.能见度)a.push(`能见度${w.能见度}`);
  const fx=Array.isArray(w.环境影响)?w.环境影响.filter(Boolean):[];
  if(fx.length)a.push(fx.join('、'));
  return a.join('，')||'未知';
}

function latestAssistantMessageId(){
  try{const chat=globalThis.SillyTavern?.chat||[];for(let i=chat.length-1;i>=0;i--)if(chat[i]&&!chat[i].is_user)return i}catch{}
  return -1;
}

function recentStoryContext(){
  try{
    const chat=globalThis.SillyTavern?.chat||[];
    const rows=[];
    for(let i=chat.length-1;i>=0&&rows.length<4;i--){
      const m=chat[i];if(!m)continue;
      const raw=String(m.mes||m.message||m.content||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      if(!raw)continue;
      rows.unshift(`${m.is_user?'玩家':'正文'}：${raw.slice(0,520)}`);
    }
    return rows.join('\n').slice(-1800)||'无额外剧情硬事实。';
  }catch{return '无额外剧情硬事实。'}
}

function intelDigest(intel={}){
  return REGIONS.map(r=>{
    const x=intel?.[r.name]||{};
    const status=String(x.情报状态||'未知');
    const res=x.资源已知?`${Number(x.资源指数??0)}/100`:'未知';
    const horde=x.尸群已知?`${Number(x.尸群指数??0)}/100`:'未知';
    const passage=String(x.通行状态||'未知');
    const tags=Array.isArray(x.动态标签)&&x.动态标签.length?`；标签${x.动态标签.join('、')}`:'';
    const day=Number(x.最后更新日||0);const summary=x.情报摘要?`；${x.情报摘要}`:'';
    return `${r.id} ${r.name}：${status}；资源${res}；尸群${horde}；通行${passage}${day?`；第${day}日更新`:''}${tags}${summary}`;
  }).join('\n');
}

export async function world(){
  try{await waitGlobalInitialized('Mvu')}catch{}
  let v={};
  try{v=getAllVariables()||{}}catch{}
  const d=v.stat_data||v||{},w=d.世界||{},r=d.广播||{},actual=d.地图?.地点动态||{},intel=d.地图?.区域情报||{},q=d.支线||{};
  const tm=splitTime(w.当前时间);
  const location=String(w.当前地点||'地下安全屋');
  const loc=actual[location]||{};
  const questDigest=['林安安','陆斯年'].map(name=>{
    const x=q[name]||{};const clues=Array.isArray(x.已获得线索)?x.已获得线索.length:0;
    return `${name}：${x.状态||'失联'}，已知线索${clues}条，推测区域${x.推测区域||'未知'}，位置确认${x.位置已确认?'是':'否'}`;
  }).join('；');
  return{
    date:tm.date,time:tm.time,stamp:tm.full,day:Number(w.灾变日||1),location,area:AREA[location]||'暮迟市',
    crowd:Number(loc.尸群指数??25),resource:Number(loc.资源指数??50),passage:String(loc.通行状态||'谨慎通行'),
    weather:formatWeather(w.天气),cureStatus:String(w.解药?.状态||'研发中'),cureAt:String(w.解药?.研发完成时间||'2026-04-27 19:42'),
    cureLeft:`${Number(w.解药?.剩余天数??547)}天${Number(w.解药?.剩余小时??0)}小时`,signal:String(r.信号状态||'一般'),
    mapDigest:intelDigest(intel),questDigest,storyFacts:recentStoryContext(),intel:deepClone(intel),raw:d
  };
}

const stamp=w=>w.stamp||`${w.date} ${w.time}`;
function hours(a,b){
  const p=s=>{const m=String(s).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]):null};
  const x=p(a),y=p(b);return x===null||y===null?0:Math.max(0,(y-x)/36e5);
}
const recent=k=>store.history.filter(x=>x.channel===k).slice(0,7).map(x=>`- [${x.eventTime}] ${x.source}: ${x.summary}`).join('\n')||'暂无。';
function tone(){return store.settings.tension==='calm'?'偏生活化克制，重大消息很少。':store.settings.tension==='tense'?'可以更紧张，但仍必须具体、有限、可信。':'保持真实公共广播节奏：大多数消息普通具体，偶尔出现重要变化。'}

function systemPrompt(){return `你是虚构末世世界“暮迟之昼”的公共无线电广播生成器。
世界时间起点为2024-10-27 19:42；稳定解药的世界事件节点固定为2026-04-27 19:42，整整一年半后。这个完成时间只是生成约束，广播中的公众和机构不能预知这个精确未来日期；完成日前不得宣布“稳定解药已经研发完成”，完成后也不能让社会瞬间恢复。
沈挽昼与{{user}}只是普通幸存者，不是关键样本、救世主或病毒源。广播不知道沈挽昼的特殊感染，不知道{{user}}的实时位置，也不知道楚泽的私人秘密、日记内容或其暗中行为。不得以广播形式揭露楚泽暗线。
E-P病毒原本属于正规的生物医学研究；公共频道只能报道公开层面的研究、事故、医疗和救援信息，不能凭空把研究机构写成邪恶组织。
暮迟市地理必须保持稳定：主体城区在暮江西岸；南桥是主要跨江节点；南郊工业区在东南岸。普通尸群跨江优先受南桥通行状态影响。
广播必须像公共信息，不得给主角发布专属任务。允许滞后、重复、误传、信号中断与失效信息；天气、道路、供水供电、通信和普通幸存者消息应占相当比例。
你会收到一些“仅用于避免矛盾的幕后上下文”。这些内容不是电台知情来源，绝不能因为看到了它们就让广播表现出对主角私人经历或实时位置的了解。
不要提AI、变量、世界书、脚本、SillyTavern、重Roll、每日结算或游戏机制。`;}

const radioProps={
  event_time:{type:'string'},source:{type:'string'},signal:{type:'string',enum:['强','一般','微弱','断续']},category:{type:'string'},headline:{type:'string'},summary:{type:'string'},transcript:{type:'string'},certainty:{type:'string'},
  side_clue:{type:'object',properties:{target:{type:'string',enum:['无','林安安','陆斯年']},name:{type:'string'},summary:{type:'string'},strength:{type:'string',enum:['无','弱','中','强']},region_hint:{type:'string'}},required:['target','name','summary','strength','region_hint'],additionalProperties:false}
};
const radioRequired=['event_time','source','signal','category','headline','summary','transcript','certainty','side_clue'];
const broadcastItemSchema={type:'object',properties:{channel:{type:'string',enum:['global','china','muchi']},...radioProps},required:['channel',...radioRequired],additionalProperties:false};
const pureEnvelopeSchema={name:'muchi_radio_pure_v1',strict:true,value:{type:'object',properties:{broadcasts:{type:'array',minItems:1,maxItems:3,items:broadcastItemSchema}},required:['broadcasts'],additionalProperties:false}};
const intelMetricSchema={type:'object',properties:{known:{type:'boolean'},estimate:{type:'integer',minimum:0,maximum:100},trend:{type:'string',enum:['未知','上升','下降','稳定']},strength:{type:'string',enum:['无','轻','中','高']}},required:['known','estimate','trend','strength'],additionalProperties:false};
const intelChangeSchema={type:'object',properties:{
  area_id:{type:'string',enum:REGIONS.map(r=>r.id)},reliability:{type:'string',enum:['传闻','已确认']},confidence:{type:'integer',minimum:0,maximum:100},summary:{type:'string'},
  resource:intelMetricSchema,horde:intelMetricSchema,passage:{type:'string',enum:['未知','不变','可通行','谨慎通行','受阻','封锁']},
  add_tags:{type:'array',maxItems:4,items:{type:'string'}},remove_tags:{type:'array',maxItems:4,items:{type:'string'}}
},required:['area_id','reliability','confidence','summary','resource','horde','passage','add_tags','remove_tags'],additionalProperties:false};
const intelEnvelopeSchema={name:'muchi_radio_intel_v1',strict:true,value:{type:'object',properties:{
  broadcasts:{type:'array',minItems:1,maxItems:3,items:broadcastItemSchema},
  map_intel:{type:'object',properties:{has_intel:{type:'boolean'},reason:{type:'string'},changes:{type:'array',maxItems:3,items:intelChangeSchema}},required:['has_intel','reason','changes'],additionalProperties:false}
},required:['broadcasts','map_intel'],additionalProperties:false}};

function regionReference(){return REGIONS.map(r=>`${r.id} ${r.name}｜${r.type}｜基础风险${r.risk}｜后台基准：资源约${r.baseResource}、尸群约${r.baseHorde}｜${r.note}`).join('\n')}
function channelBlocks(keys,w){return keys.map(k=>{const c=channels[k];return `频道ID=${k}；频道=${c.label} ${c.band} ${c.freq}；典型信息延迟${c.delay}；范围=${c.scope}。\n近期内容：\n${store.settings.repeatGuard?recent(k):'无需重复保护。'}`}).join('\n\n---\n\n')}
function basePrompt(keys,w,plan){return `当前世界时间：${stamp(w)}；灾变第${w.day}日；天气：${w.weather}。
玩家当前地点=${w.location}/${w.area}；当前地点幕后真实态势约为尸群${w.crowd}/100、资源${w.resource}/100、通行${w.passage}。这些只用于避免明显矛盾，广播不得表现为知道玩家实时位置。
解药公开状态：${w.cureStatus}。固定完成节点不可被行动提前或延后，也不可作为广播预言。
最近正文硬事实（只用于避免矛盾，不是电台信息源）：\n${w.storyFacts}
风格：${tone()} 人味/民间插播目标概率约${store.settings.civilian}%；多样性=${DIRECTOR_MODES[store.settings.diversity]?.label||'自然'}。
摘要30-100字；听写正文90-320字；事件时间不得晚于当前世界时间。每个频道以1个主事件为核心，最多带0-2个短辅助段，不要把每条广播都写成大灾难或任务公告。导演简报里的“稀有”只表示不常见，不等于更严重、更宏大或更危险。
若导演简报包含人味插播，正文可用【幸存者频段】【点歌留言】【短讯】等自然分段；summary仍需先概括主事件，并用一句短语带到插播，便于后续剧情知道有人听见了什么。
若导演简报出现“暗线弱提示候选”，它只能作为普通匿名寻人/目击片段自然混入广播：不得说明其与玩家的真实关系，不得给出精确门牌或可导航坐标，不得让播音者表现为知道主角正在寻找谁，不得写入side_clue，也不得单独支撑map_intel。玩家是否联想到自己家人、是否前往调查完全由玩家决定。
失散同伴线索默认target="无"；只有普通广播自然构成模糊冗余线索时才允许填写，绝不能直接确认最终藏身房间。
需要生成的频道：\n${channelBlocks(keys,w)}
隐藏创作导演简报（只决定本轮内容方向与形式，不是电台凭空掌握的事实；若与正文硬事实冲突，以硬事实为准）：\n${directorBrief(plan)}
附加偏好：${store.settings.extra||'无'}`}
function purePrompt(keys,w,plan){return `一次请求生成 ${keys.length} 个频道的公共广播。每个频道只生成一条，互相独立，不要把同一事件机械改写三遍。
${basePrompt(keys,w,plan)}
本轮是“纯广播请求”：地图情报已经结算、没有更新权限，或本轮不包含暮迟市频道。你不得输出地图字段、地点数值变动、地图更新指令或类似结构。广播正文可以正常提及公开发生的城市事件，但这次请求只负责广播文本。
若频道不是暮迟市，side_clue必须target="无"。
只输出一个JSON对象，格式为 {"broadcasts":[...]}；broadcasts每项必须包含channel，channel只能是 ${keys.map(k=>`"${k}"`).join('、')}。不要代码块、前后说明或思维过程。`}
function settlementPrompt(keys,w,plan,reroll=false){const rule=reroll?`这是玩家主动要求重新生成“今日暮迟市情报”的请求。旧版今日暮迟市广播与旧版地图情报应视为不存在；所有地图判断必须从下面提供的今日基线重新出发，而不是在旧版结果上继续叠加。必须给出1至3个有逻辑根据的区域情报变化；如果没有可靠依据，优先选择较克制的变化，不要制造灾难性跳变。`:`这是今天尚未完成地图情报结算时的本地情报请求。只有本次暮迟市广播中明确出现、且足以支撑地图判断的内容才能进入map_intel。允许0至3个区域变化；没有有效本地情报时必须令has_intel=false且changes=[]，不要为了消耗更新次数而硬凑变化。`;
return `一次请求生成 ${keys.length} 个频道的公共广播，并在同一个请求里处理一次暮迟市地图情报。
${basePrompt(keys,w,plan)}
${rule}
地图显示的是幸存者“目前掌握的情报”，不是全知真相。初始未知区域只有在广播确实提供了信息时才被揭示；已知区域只依据新广播产生克制变化。
当前玩家可见地图情报：\n${w.mapDigest}
暮迟市01—11后台一致性参考（仅用于生成合理估计，广播不得把“后台基准”当成精确官方数字逐字播报）：\n${regionReference()}
map_intel规则：
- 只有暮迟市频道的主硬情报事件可以支撑map_intel；全球/中国广播本身不能直接改变暮迟地图。
- 幸存者点歌、玩梗、生日、宠物、交换、留言、旧广告残片等“人味插播”永远不能单独支撑map_intel；即使插播里提到地点，也必须有独立硬情报才能改地图。
- 每次最多3个区域；区域必须使用01—11编号。
- 对未知/部分未知区域：resource/horde的known=true时estimate才会首次写入；没有相关信息就known=false。首次估值应接近区域性质与本次事件，不要无理由极端。
- 对已经知道的指标：脚本主要使用trend+strength计算变化；轻/中/高必须与正文事件强度匹配。普通变化不要剧烈跳动。
- 资源通常因搜刮、补给、仓储开启/损毁而改变；尸群通常因迁徙、噪声、清剿、火灾、救援车队等改变。不要让天气一句话同时改遍全城。
- passage只有广播明确涉及道路/封锁/桥梁/救援线路时才改变，否则填“不变”。
- reliability为“传闻”或“已确认”，confidence与来源可靠程度一致。
- ${reroll?'本次重生成不得推翻最近正文已经明确发生的硬事实。':'如果本轮没有合格地图情报，has_intel=false且changes=[]。'}
- 本次日结算/重生成不承担失散同伴线索：所有broadcasts中的side_clue必须target="无"，避免重生成造成支线重复写入。
只输出一个JSON对象，格式为 {"broadcasts":[...],"map_intel":{"has_intel":true或false,"reason":"...","changes":[...]}}。不要代码块、前后说明或思维过程。`}

const normalizeChannelKeys=input=>uniq((Array.isArray(input)?input:[input]).filter(k=>channels[k])).slice(0,3);
function samplingModeFor(s,mode){return mode==='proxy'?s.proxySampling:mode==='custom'?s.customSampling:s.mainSampling}
function applySampling(target,s,mode){const sm=samplingModeFor(s,mode)||'inherit';if(sm==='custom')target.temperature=clamp(s.temperature,0,2);else if(mode==='custom')target.temperature='same_as_preset';return target}
function config(input,w,route='pure',plan=null){
  const keys=normalizeChannelKeys(input);if(!keys.length)throw Error('没有可生成的广播频道');
  const s=store.settings;if(!hasGenerationSource())throw requestError('MR-87 尚未配置生成来源，请先打开收音机设置选择主预设、代理预设或独立 API','MR87_API_UNSET');
  const intel=route==='settle'||route==='reroll',prompt=intel?settlementPrompt(keys,w,plan,route==='reroll'):purePrompt(keys,w,plan);
  const c={user_input:prompt,ordered_prompts:[{role:'system',content:systemPrompt()},{role:'user',content:prompt}],should_silence:true,json_schema:intel?intelEnvelopeSchema:pureEnvelopeSchema,generation_id:`muchi-radio-${route}-${Date.now()}-${++requestSeq}`};
  if(s.mode==='proxy'){
    const api={proxy_preset:String(s.proxyPreset||'').trim()};if(s.proxyModelOverride&&String(s.proxyModel||'').trim())api.model=String(s.proxyModel).trim();c.custom_api=applySampling(api,s,'proxy');
  }else if(s.mode==='custom'){
    const api={apiurl:String(s.apiUrl||'').trim(),key:getApiKey(),model:String(s.customModel||s.model||'').trim(),source:s.source||'openai'};c.custom_api=applySampling(api,s,'custom');
  }else if(samplingModeFor(s,'main')==='custom')c.custom_api=applySampling({},s,'main');
  return c;
}

function responseText(x){
  if(typeof x==='string')return x;
  if(x&&typeof x.content==='string')return x.content;
  try{return JSON.stringify(x??'')}catch{return String(x??'')}
}
function balancedObjects(text){
  const out=[];let start=-1,depth=0,quote='',escape=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(start<0){if(c==='{'){start=i;depth=1}continue}
    if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}
    if(c==='"'||c==="'"){quote=c;continue}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0){out.push(text.slice(start,i+1));start=-1}
  }
  return out;
}
function parseJsonCandidate(text){
  const raw=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  const fenced=[...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(x=>x[1].trim());
  const clean=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  const candidates=[clean,...fenced,...balancedObjects(clean)].filter(Boolean).reverse();
  for(const candidate of candidates){
    try{return JSON.parse(candidate)}catch{}
    try{return JSON.parse(candidate.replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/,\s*([}\]])/g,'$1'))}catch{}
  }
  return null;
}
function fallbackBroadcast(text,k,w){
  const plain=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/```[a-z]*|```/gi,'').trim();
  if(!plain)throw Error('模型没有返回可用内容');
  const oneLine=plain.replace(/\s+/g,' ').trim();const first=(oneLine.match(/^.{1,36}?[。！？!?]/)?.[0]||oneLine.slice(0,32)||'广播更新').trim();
  return{channel:k,event_time:stamp(w),source:`${channels[k].label}公共广播`,signal:'一般',category:'广播',headline:first.replace(/[。！？!?]+$/,''),summary:oneLine.slice(0,90),transcript:plain.slice(0,900),certainty:'未结构化播报',side_clue:{target:'无',name:'',summary:'',strength:'无',region_hint:''}};
}
function parseEnvelope(x,keys,w,route='pure'){
  const text=responseText(x),parsed=parseJsonCandidate(text),rows=Array.isArray(parsed?.broadcasts)?parsed.broadcasts:[];
  const broadcasts=[];
  for(const k of keys){const row=rows.find(v=>v&&v.channel===k);if(row)broadcasts.push(row)}
  if(broadcasts.length!==keys.length){
    if(keys.length===1&&!parsed?.broadcasts){console.warn('[MR-87] 模型未按JSON envelope返回，已降级为普通广播文本',text);return{broadcasts:[fallbackBroadcast(text,keys[0],w)],mapIntel:null}}
    console.warn('[MR-87] 广播返回格式无效',text);throw Error(`广播只返回 ${broadcasts.length}/${keys.length} 个频道`);
  }
  return{broadcasts,mapIntel:(route==='settle'||route==='reroll')?(parsed?.map_intel||{has_intel:false,reason:'未返回地图情报',changes:[]}):null};
}

function normalizeIntelChange(raw){
  const x=raw&&typeof raw==='object'?raw:{},region=REGION_BY_ID[String(x.area_id||'')];if(!region)return null;
  const metric=m=>{const v=m&&typeof m==='object'?m:{};return{known:!!v.known,estimate:clamp(Math.round(Number(v.estimate)||0),0,100),trend:['未知','上升','下降','稳定'].includes(v.trend)?v.trend:'未知',strength:['无','轻','中','高'].includes(v.strength)?v.strength:'无'}};
  return{region,reliability:['传闻','已确认'].includes(x.reliability)?x.reliability:'传闻',confidence:clamp(Math.round(Number(x.confidence)||0),0,100),summary:String(x.summary||''),resource:metric(x.resource),horde:metric(x.horde),passage:['未知','不变','可通行','谨慎通行','受阻','封锁'].includes(x.passage)?x.passage:'不变',addTags:uniq(x.add_tags).slice(0,4),removeTags:uniq(x.remove_tags).slice(0,4)};
}
function normalizeMapIntel(raw,route='settle'){
  const x=raw&&typeof raw==='object'?raw:{},limit=clamp(store.settings.intelMaxRegions||3,1,3);
  const changes=(Array.isArray(x.changes)?x.changes:[]).map(normalizeIntelChange).filter(Boolean).slice(0,limit);
  const has=!!x.has_intel&&changes.length>0;
  if(route==='reroll'&&!changes.length)throw Error('重Roll没有返回有效地图情报，已保留上一版结果');
  return{hasIntel:has,reason:String(x.reason||''),changes:has?changes:[]};
}
function deltaFor(kind,trend,strength){
  if(!['上升','下降'].includes(trend))return 0;
  const table=kind==='resource'?{轻:4,中:9,高:14}:{轻:6,中:12,高:18};const n=table[strength]||0;return trend==='下降'?-n:n;
}
function freshIntelState(){return{情报状态:'未知',资源已知:false,资源指数:50,尸群已知:false,尸群指数:50,通行状态:'未知',动态标签:[],情报摘要:'',情报来源:'',置信度:0,首次发现日:0,最后更新日:0,最后更新时间:'',资源趋势:'未知',尸群趋势:'未知'};}
function intelSnapshotFromWorld(w){return deepClone(w?.raw?.地图?.区域情报||{})}
function visibleSnapshotFromWorld(w){return{intel:deepClone(w?.raw?.地图?.区域情报||{}),radio:deepClone(w?.raw?.广播||{})}}
function ensureIntelCycle(w){
  const day=Number(w?.day||0);if(Number(store.intel?.day)!==day){store.intel={...defaults.intel,day,status:'idle'};save()}return store.intel;
}
function generationRoute(keys,w,forced=''){
  if(forced==='reroll')return'reroll';
  if(!store.settings.applyEvents||!keys.includes('muchi'))return'pure';
  const c=ensureIntelCycle(w),max=clamp(store.settings.intelDailyAttempts||2,1,4);
  if(c.status==='settled'||c.status==='exhausted'||Number(c.attempts||0)>=max)return'pure';
  return'settle';
}
async function restoreIntelSnapshot(snapshot){
  updateVariablesWith?.(v=>{const d=v.stat_data||(v.stat_data={}),map=d.地图||(d.地图={});map.区域情报=deepClone(snapshot||{});return v},{type:'message',message_id:latestAssistantMessageId()});
}
async function restoreVisibleSnapshot(snapshot){
  updateVariablesWith?.(v=>{const d=v.stat_data||(v.stat_data={}),map=d.地图||(d.地图={});map.区域情报=deepClone(snapshot?.intel||{});d.广播=deepClone(snapshot?.radio||{});return v},{type:'message',message_id:latestAssistantMessageId()});
}

function normalizeClue(raw,k){
  const c=raw&&typeof raw==='object'?raw:{};
  if(k!=='muchi'||!['林安安','陆斯年'].includes(c.target))return{target:'无',name:'',summary:'',strength:'无',regionHint:''};
  return{target:c.target,name:String(c.name||'广播中的模糊线索'),summary:String(c.summary||''),strength:['弱','中','强'].includes(c.strength)?c.strength:'弱',regionHint:String(c.region_hint||'')};
}

async function syncBroadcastAndClue(x,{allowClue=true}={}){
  if(!store.settings.syncMvu&&!store.settings.syncClues)return x;
  let clueApplied='';
  try{
    updateVariablesWith?.(v=>{
      const d=v.stat_data||(v.stat_data={});
      if(store.settings.syncMvu){
        const r=d.广播||(d.广播={}),label=channels[x.channel].label;r.当前频道=channels[store.state.channel]?.label||label;if(x.channel===store.state.channel)r.信号状态=x.signal;r.上次刷新时间=x.worldStamp;
        const sec=r[label]||(r[label]={});sec.事件时间=x.eventTime;sec.来源=x.source;sec.摘要=x.summary;
      }
      if(allowClue&&store.settings.syncClues&&x.channel==='muchi'&&x.sideClue?.target!=='无'){
        const q=d.支线?.[x.sideClue.target];if(q&&!q.位置已确认){const clues=Array.isArray(q.已获得线索)?q.已获得线索:[];if(!clues.includes(x.sideClue.name)){q.已获得线索=[...clues,x.sideClue.name];q.最近线索=x.sideClue.summary||x.sideClue.name;if(q.状态==='失联')q.状态='发现踪迹';if(x.sideClue.regionHint&&q.推测区域==='未知')q.推测区域=x.sideClue.regionHint;if(x.sideClue.strength==='强'&&q.已获得线索.length>=3&&q.状态==='发现踪迹')q.状态='锁定区域';clueApplied=`${x.sideClue.target}：${x.sideClue.name}`}}
      }
      return v;
    },{type:'message',message_id:latestAssistantMessageId()});
  }catch(e){console.warn('[MR-87] MVU broadcast sync',e)}
  x.appliedClue=clueApplied;return x;
}

async function applyMapIntel(payload,w,item){
  const p=normalizeMapIntel(payload,item?.intelRoute||'settle');if(!p.hasIntel){item.appliedImpact=[];return p}
  const summaries=[];
  updateVariablesWith?.(v=>{
    const d=v.stat_data||(v.stat_data={}),map=d.地图||(d.地图={}),intel=map.区域情报||(map.区域情报={});
    for(const ch of p.changes){
      const name=ch.region.name,prev={...freshIntelState(),...(intel[name]||{})},next={...prev};
      const discovered=prev.情报状态==='未知'&& !prev.资源已知 && !prev.尸群已知 && (prev.通行状态||'未知')==='未知';
      if(ch.resource.known){
        if(!prev.资源已知||discovered){next.资源已知=true;next.资源指数=clamp(ch.resource.estimate,0,100);next.资源趋势='未知'}
        else{const dlt=deltaFor('resource',ch.resource.trend,ch.resource.strength);next.资源指数=clamp(Number(prev.资源指数??50)+dlt,0,100);next.资源趋势=ch.resource.trend}
      }else if(prev.资源已知&&['上升','下降','稳定'].includes(ch.resource.trend)){const dlt=deltaFor('resource',ch.resource.trend,ch.resource.strength);next.资源指数=clamp(Number(prev.资源指数??50)+dlt,0,100);next.资源趋势=ch.resource.trend}
      if(ch.horde.known){
        if(!prev.尸群已知||discovered){next.尸群已知=true;next.尸群指数=clamp(ch.horde.estimate,0,100);next.尸群趋势='未知'}
        else{const dlt=deltaFor('horde',ch.horde.trend,ch.horde.strength);next.尸群指数=clamp(Number(prev.尸群指数??50)+dlt,0,100);next.尸群趋势=ch.horde.trend}
      }else if(prev.尸群已知&&['上升','下降','稳定'].includes(ch.horde.trend)){const dlt=deltaFor('horde',ch.horde.trend,ch.horde.strength);next.尸群指数=clamp(Number(prev.尸群指数??50)+dlt,0,100);next.尸群趋势=ch.horde.trend}
      if(ch.passage!=='不变')next.通行状态=ch.passage;
      let tags=uniq(prev.动态标签);tags=tags.filter(t=>!ch.removeTags.includes(t));next.动态标签=uniq([...tags,...ch.addTags]).slice(0,8);
      next.情报状态=ch.reliability;next.情报摘要=ch.summary;next.情报来源=item.source||'暮迟市公共广播';next.置信度=ch.confidence;if(!Number(prev.首次发现日||0))next.首次发现日=w.day;next.最后更新日=w.day;next.最后更新时间=stamp(w);
      intel[name]=next;
      const parts=[];if(next.资源已知)parts.push(`资源${next.资源指数}`);if(next.尸群已知)parts.push(`尸群${next.尸群指数}`);if(next.通行状态&&next.通行状态!=='未知')parts.push(`通行${next.通行状态}`);summaries.push(`${ch.region.id} ${name} · ${parts.join(' / ')||ch.summary}`);
    }
    if(store.settings.syncMvu){const r=d.广播||(d.广播={});r.最近事件=summaries.length?(p.reason||summaries.join('；')):(r.最近事件||'无')}
    return v;
  },{type:'message',message_id:latestAssistantMessageId()});
  item.appliedImpact=summaries;item.mapIntel=p;return p;
}

function makeRecord(raw,k,w,reason,index=0,route='pure',director=null){
  return{id:`r${Date.now()}-${index}`,channel:k,eventTime:String(raw.event_time||stamp(w)),source:String(raw.source||channels[k].label),signal:['强','一般','微弱','断续'].includes(raw.signal)?raw.signal:'一般',category:String(raw.category||'其他'),headline:String(raw.headline||'广播更新'),summary:String(raw.summary||raw.transcript||''),transcript:String(raw.transcript||raw.summary||''),certainty:String(raw.certainty||'公开信息'),worldStamp:stamp(w),location:w.location,sideClue:normalizeClue(raw.side_clue,k),reason,intelRoute:route,director:compactDirectorMeta(director),appliedImpact:[]};
}

function pendingRecords(){
  const ids=Array.isArray(store.state.pendingStoryIds)&&store.state.pendingStoryIds.length?store.state.pendingStoryIds:(store.state.pendingStoryId?[store.state.pendingStoryId]:[]);
  return ids.map(byId).filter(Boolean);
}
function setPendingRecords(items){
  const ids=(items||[]).map(x=>x?.id).filter(Boolean);store.state.pendingStoryIds=ids;store.state.pendingStoryId=ids[0]||'';
}

async function awaitModelResponse(cfg,{keys=[],reason='',route='pure'}={}){
  const req={generationId:String(cfg?.generation_id||''),channels:[...keys],reason,route,startedAt:Date.now(),cancelled:false,rejectCancel:null,timer:null};
  activeRequest=req;render('busy',true);
  const modelPromise=Promise.resolve().then(()=>generateRaw(cfg));
  const cancelPromise=new Promise((_,reject)=>{req.rejectCancel=reject});
  /* Safety net only: manual cancellation remains available immediately. 180s avoids a dead request holding MR-87 forever. */
  const timeoutPromise=new Promise((_,reject)=>{req.timer=setTimeout(()=>{if(activeRequest!==req)return;req.cancelled=true;stopGenerationRequest(req.generationId);reject(requestError('广播请求超过180秒，已自动中止','MR87_TIMEOUT'))},180000)});
  try{return await Promise.race([modelPromise,cancelPromise,timeoutPromise])}
  finally{
    if(req.timer)clearTimeout(req.timer);
    req.rejectCancel=null;
    if(activeRequest===req)activeRequest=null;
    render('busy',true);
  }
}
async function runGeneration(keys,reason,forcedRoute='',directorOptions={}){
  const w=await world(),route=generationRoute(keys,w,forcedRoute),cycle=ensureIntelCycle(w);
  if(route==='settle'&&!cycle.baseline){cycle.baseline=intelSnapshotFromWorld(w);cycle.directorBaseline=deepClone(store.director);cycle.lastStamp=stamp(w);save()}
  const directorPlan=createDirectorPlan(keys,w,route,directorOptions);
  const cfg=config(keys,w,route,directorPlan);
  const envelope=parseEnvelope(await awaitModelResponse(cfg,{keys,reason,route}),keys,w,route);
  const mapPayload=(route==='settle'||route==='reroll')?normalizeMapIntel(envelope.mapIntel,route):null;
  const items=envelope.broadcasts.map((raw,i)=>makeRecord(raw,keys[i],w,reason,i,route,directorPlan.byChannel[keys[i]]));
  const local=items.find(x=>x.channel==='muchi')||null;
  const visibleBefore=(route==='settle'||route==='reroll')?visibleSnapshotFromWorld(w):null;
  try{
    for(const x of items)await syncBroadcastAndClue(x,{allowClue:route==='pure'});
    if(local&&mapPayload){
      local.mapIntel=mapPayload;
      if(mapPayload.hasIntel)await applyMapIntel(envelope.mapIntel,w,local);
      if(route==='settle'){
        cycle.attempts=Number(cycle.attempts||0)+1;
        if(mapPayload.hasIntel){cycle.status='settled';cycle.broadcastId=local.id;cycle.regions=mapPayload.changes.map(c=>c.region.id);cycle.lastStamp=stamp(w)}
        else cycle.status=cycle.attempts>=clamp(store.settings.intelDailyAttempts||2,1,4)?'exhausted':'no_intel';
      }else if(route==='reroll'){
        cycle.status='settled';cycle.broadcastId=local.id;cycle.regions=mapPayload.changes.map(c=>c.region.id);cycle.lastStamp=stamp(w);
      }
    }
  }catch(e){
    if(visibleBefore)try{await restoreVisibleSnapshot(visibleBefore)}catch(_){}
    throw e;
  }
  commitDirector(items,directorPlan,w);
  return{items,w,route,cycle,directorPlan};
}

export async function generate(input=store.state.channel,reason='manual'){
  const keys=normalizeChannelKeys(input),wantsArray=Array.isArray(input);if(!keys.length)return wantsArray?[]:null;if(busy)return wantsArray?[]:null;
  busy=true;render('busy',true);noise(.28);
  try{
    const out=await runGeneration(keys,reason),items=out.items;
    store.history=[...items,...store.history].slice(0,clamp(store.settings.historyLimit,10,200));
    if(reason==='manual'&&keys.length===1)store.state.channel=keys[0];
    store.state.lastStamp=items[0]?.worldStamp||stamp(out.w);store.state.lastLocation=out.w.location;setPendingRecords(items);save();render('all');
    if(reason==='manual')toastr?.success?.(items.length>1?`一次收到 ${items.length} 个频道的新广播`:`收到新的${channels[keys[0]].label}广播`);
    return wantsArray?items:(items[0]||null);
  }catch(e){
    if(e?.code==='MR87_API_UNSET'){console.info('[MR-87] generation source unset');render('error',e?.message||String(e));toastr?.warning?.('MR-87 尚未配置生成来源，请先打开设置');return wantsArray?[]:null}
    if(e?.code==='MR87_CANCELLED'){console.info('[MR-87] request cancelled');toastr?.info?.('已取消本次广播请求');return wantsArray?[]:null}
    if(e?.code==='MR87_TIMEOUT'){console.warn('[MR-87] request timeout',e);render('error',e?.message||String(e));toastr?.warning?.(e?.message||'广播请求超时');return wantsArray?[]:null}
    console.error('[MR-87]',e);render('error',e?.message||String(e));toastr?.error?.(`收音机生成失败：${e?.message||e}`);return wantsArray?[]:null
  }
  finally{busy=false;render('busy',false)}
}

export function getIntelUiState(){return deepClone(store.intel||defaults.intel)}
export function canRerollToday(){return !!(store.settings.applyEvents&&store.intel?.status==='settled'&&store.intel?.baseline&&store.intel?.broadcastId)}
export async function rerollTodayIntel(){
  if(busy)return null;busy=true;render('busy',true);noise(.25);
  const oldHistory=deepClone(store.history),oldIntel=deepClone(store.intel),oldDirector=deepClone(store.director);let currentSnapshot=null;
  try{
    let w=await world(),cycle=ensureIntelCycle(w);if(cycle.status!=='settled'||!cycle.baseline||!cycle.broadcastId)throw Error('今天还没有可重Roll的地图情报');
    currentSnapshot=visibleSnapshotFromWorld(w);const oldId=cycle.broadcastId,oldItem=store.history.find(x=>x.id===oldId);
    await restoreIntelSnapshot(cycle.baseline);
    store.history=store.history.filter(x=>x.id!==oldId);
    store.director=deepClone(cycle.directorBaseline||store.director||defaults.director);
    w=await world();
    const out=await runGeneration(['muchi'],'reroll','reroll',{forceFresh:true,avoidFingerprints:[oldItem?.director?.fingerprint].filter(Boolean)}),item=out.items[0];if(!item?.mapIntel?.hasIntel)throw Error('重Roll没有生成有效地图情报');
    store.intel.rerolls=Number(oldIntel.rerolls||0)+1;
    store.history=[item,...store.history].slice(0,clamp(store.settings.historyLimit,10,200));
    if(store.state.displayBroadcastId===oldId)store.state.displayBroadcastId=item.id;
    setPendingRecords([item]);store.state.lastStamp=item.worldStamp;store.state.lastLocation=out.w.location;save();render('all');toastr?.success?.(`今日情报已重Roll · 第${store.intel.rerolls}次`);return item;
  }catch(e){
    if(e?.code==='MR87_CANCELLED')console.info('[MR-87 reroll] cancelled');else console.error('[MR-87 reroll]',e);
    if(currentSnapshot)try{await restoreVisibleSnapshot(currentSnapshot)}catch(_){}store.history=oldHistory;store.intel=oldIntel;store.director=oldDirector;save();render('all');
    if(e?.code==='MR87_CANCELLED')toastr?.info?.('已取消重Roll，本次变化已回退');else if(e?.code==='MR87_TIMEOUT')toastr?.warning?.(e?.message||'重Roll请求超时，已回退');else toastr?.error?.(`重Roll失败：${e?.message||e}`);return null;
  }finally{busy=false;render('busy',false)}
}

function autoReasons(w){
  if(!store.settings.auto)return[];
  if(store.settings.initialBroadcast&&!store.history.length)return['initial'];
  const prev=store.state.lastStamp;if(!prev)return['initial'];
  const out=[];
  if(store.settings.dateRefresh&&prev.slice(0,10)!==stamp(w).slice(0,10))out.push('date');
  if(store.settings.locationRefresh&&store.state.lastLocation&&store.state.lastLocation!==w.location)out.push('location');
  if(hours(prev,stamp(w))>=clamp(store.settings.hours,1,48))out.push('time');
  return out;
}
function channelFor(reason,w){
  let k=store.state.channel;
  if(store.settings.autoChannel==='context'){
    if(reason==='initial'||reason==='location')k='muchi';
    else if(reason==='date')k=w.day<=14?'china':'global';
  }else if(store.settings.autoChannel==='rotate'){
    const a=['muchi','china','global'];store.state.rotate=(store.state.rotate+1)%a.length;k=a[store.state.rotate];
  }
  return k;
}
function autoPlan(w){
  const reasons=autoReasons(w),keys=[];
  for(const reason of reasons){const k=channelFor(reason,w);if(k&&!keys.includes(k))keys.push(k)}
  return{reasons,keys};
}
function injectStoryBroadcast(value){
  const items=(Array.isArray(value)?value:[value]).filter(Boolean);if(!items.length||!store.settings.injectStory||typeof injectPrompts!=='function')return;
  const blocks=items.map(x=>{
    const changes=x.appliedImpact?.length?`\n这条广播已经更新了可见的城市情报：${x.appliedImpact.join('；')}。`:'';
    const clue=x.appliedClue?`\n广播同时构成一条模糊的失散同伴线索：${x.appliedClue}。只能自然感知，不要把它写成任务提示。`:'';
    return `频道：${channels[x.channel].label}；事件时间：${x.eventTime}\n${x.headline}\n${x.summary}${changes}${clue}`;
  });
  const content=`【刚刚从MR-87收音机听到的公共广播】\n${blocks.join('\n\n--- 频道切换 ---\n\n')}\n\n本轮正文中的人物可以把这些内容视为刚刚听到的信息。只在自然相关时作出反应，不要全文复述广播，不要把它们变成系统任务，也不要声称电台知道主角实时位置。`;
  try{uninjectPrompts?.(['muchi-radio-current'])}catch{}
  try{injectPrompts([{id:'muchi-radio-current',position:'in_chat',depth:0,role:'system',content,should_scan:true}],{once:true})}catch(e){console.warn('[MR-87] inject',e)}
}

export async function prepareBeforeGeneration(){
  if(busy||!hasGenerationSource())return null;
  const pending=pendingRecords();if(pending.length){injectStoryBroadcast(pending);return pending.length===1?pending[0]:pending}
  const w=await world(),plan=autoPlan(w);if(!plan.keys.length)return null;
  const value=await generate(plan.keys.length===1?plan.keys[0]:plan.keys,`auto:${plan.reasons.join('+')}`),items=(Array.isArray(value)?value:[value]).filter(Boolean);
  if(items.length)injectStoryBroadcast(items);return items.length===1?items[0]:items;
}

export function markStoryMessage(messageId){
  const items=pendingRecords();if(!items.length)return null;
  const x=items.find(v=>v.channel===store.state.channel)||items[0];
  store.state.displayMessageId=String(messageId);store.state.displayBroadcastId=x.id;store.state.pendingStoryId='';store.state.pendingStoryIds=[];save();return x;
}

export function displayForMessage(messageId){
  if(String(messageId)!==String(store.state.displayMessageId))return null;
  return byId(store.state.displayBroadcastId);
}

export async function autoRefresh(){
  if(!hasGenerationSource())return null;
  const w=await world(),plan=autoPlan(w);if(!plan.keys.length||busy)return null;
  return generate(plan.keys.length===1?plan.keys[0]:plan.keys,`auto:${plan.reasons.join('+')}`);
}

export const latest=k=>store.history.find(x=>x.channel===k);
export const byId=id=>store.history.find(x=>x.id===id);
export function switchChannel(k){if(!channels[k]||!store.state.power)return;store.state.channel=k;noise(.1);clickSound();save();render('radio')}
export function cycle(d){const a=['global','china','muchi'],i=a.indexOf(store.state.channel);switchChannel(a[(i+d+a.length)%a.length])}
export function clearHistory(){store.history=[];store.state.pendingStoryId='';store.state.pendingStoryIds=[];store.state.displayBroadcastId='';store.state.displayMessageId='';if(store.intel)store.intel.broadcastId='';store.director=deepClone(defaults.director);save();render('all')}

export function audioCtx(){if(!store.settings.sound||store.state.mute)return null;try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;audio ||= new A();if(audio.state==='suspended')audio.resume();return audio}catch{return null}}
export function clickSound(){const a=audioCtx();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type='square';o.frequency.value=165;g.gain.value=(store.state.volume/100)*.025;o.connect(g).connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.035);o.stop(a.currentTime+.04)}
export function noise(sec=.15){const a=audioCtx();if(!a)return;const n=Math.floor(a.sampleRate*sec),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();f.type='bandpass';f.frequency.value=1800;g.gain.value=(store.state.volume/100)*(store.settings.static/100)*.18;s.buffer=b;s.connect(f).connect(g).connect(a.destination);s.start()}


export async function initCore(){
  load();
  const w=await world();
  if(!store.state.lastLocation)store.state.lastLocation=w.location;
  if(store.history.length&&!store.state.lastStamp)store.state.lastStamp=store.history[0]?.worldStamp||stamp(w);
  save();
}
