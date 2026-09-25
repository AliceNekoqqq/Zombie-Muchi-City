const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../core.js'),'utf8').replace(/\bexport /g,'');
function runtime(){
 let id='A',pending,started;
 const chats={A:{},B:{}},messages={A:{stat_data:{世界:{当前时间:'2025-01-01 10:00',灾变日:1},地图:{区域情报:{河西区:{资源已知:true,尸群已知:true,资源指数:0,尸群指数:0,情报状态:'已确认'}}}}},B:{stat_data:{世界:{当前时间:'2025-01-01 10:00',灾变日:1}}}};
 const ctx={console,structuredClone,setTimeout,clearTimeout,Date,Math,window:{},toastr:{},uninjectPrompts(){},waitGlobalInitialized:async()=>{},getAllVariables:()=>messages[id],getVariables:o=>o.type==='chat'?chats[id]:{},updateVariablesWith:(fn,o)=>{const target=o.type==='chat'?chats:messages;target[id]=fn(target[id]);return target[id]},SillyTavern:{chat:[{is_user:false}],getCurrentChatId:()=>id},generateRaw:()=>new Promise(r=>{pending=r;started?.()})};
 vm.createContext(ctx);vm.runInContext(source+'\nglobalThis.api={store,load,save,onChatChanged,generate,prepareBeforeGeneration,autoRefresh,markStoryMessage,isCampusPeriod,applyMapIntel,captureScope,writeScope,indexValue,rerollTodayIntel,autoReasons,config};',ctx);ctx.api.load();
 return{ctx,api:ctx.api,chats,messages,switch(to,event=true){id=to;if(event)ctx.api.onChatChanged()},waitStart:()=>new Promise(r=>started=r),respond:v=>pending(v)};
}
(async()=>{
 const r=runtime(),a=r.api;const payload={has_intel:true,changes:[{area_id:'01',resource:{known:true,trend:'上升',strength:'轻'},horde:{known:true,trend:'上升',strength:'轻'}}]};
 await a.applyMapIntel(payload,{day:1,date:'2025-01-01',time:'10:00'},{source:'test'});
 assert.equal(r.messages.A.stat_data.地图.区域情报.河西区.资源指数,4);assert.equal(r.messages.A.stat_data.地图.区域情报.河西区.尸群指数,6);
 assert.equal(a.indexValue('invalid'),50);assert.equal(a.indexValue(null),50);assert.equal(a.indexValue(0),0);
 a.store.history=[{id:'A-history'}];a.save();r.switch('B');assert.equal(a.store.history.length,0);a.store.history=[{id:'B-history'}];a.save();r.switch('A');assert.equal(a.store.history[0].id,'A-history');
 const scope=a.captureScope();r.switch('B',false);assert.throws(()=>a.writeScope(scope,v=>{v.bad=true;return v}),{code:'MR87_CHAT_CHANGED'});assert.equal(r.messages.B.bad,undefined);
 for(const event of [false,true]){
  const t=runtime();t.api.store.settings.mode='main';const start=t.waitStart(),job=t.api.generate('muchi','manual');await start;t.switch('B',event);t.respond(JSON.stringify({broadcasts:[{channel:'muchi',headline:'from A',summary:'A event'}],map_intel:payload}));assert.equal(await job,null);assert.equal(t.messages.B.stat_data.广播,undefined);assert.equal(t.chats.B.muchi_radio_chat_v1,undefined);
 }
 const t=runtime(),s=t.api.captureScope();t.ctx.SillyTavern.chat.push({is_user:false});assert.throws(()=>t.api.writeScope(s,v=>v),{code:'MR87_TARGET_CHANGED'});
 const opts=runtime(),world={date:'2025-01-01',time:'10:00',location:'地下安全屋',day:1};
 opts.api.store.settings.initialBroadcast=false;
 assert.equal(opts.api.autoReasons(world).length,0,'turning off initial reception must suppress the first automatic request');
 assert.ok(opts.api.store.state.lastStamp,'time-based reception still needs a baseline after suppressing the first broadcast');
 assert.ok(opts.api.autoReasons({...world,time:'16:00'}).includes('time'));
 opts.api.store.settings.initialBroadcast=true;
 assert.equal(opts.api.autoReasons(world)[0],'initial');
 opts.api.store.settings.mode='custom';opts.api.store.settings.apiUrl='https://api.example.com/v1';opts.api.store.settings.customModel='test-model';opts.api.store.settings.customSampling='custom';opts.api.store.settings.temperature=.55;
 const cfg=opts.api.config(['muchi'],world,'pure');
 assert.equal(cfg.custom_api.model,'test-model');assert.equal(cfg.custom_api.temperature,.55);
 opts.api.store.settings.customSampling='inherit';
 assert.equal(opts.api.config(['muchi'],world,'pure').custom_api.temperature,'same_as_preset');
 const campus=runtime();campus.api.store.settings.mode='main';campus.messages.A.stat_data.世界.剧情时期='校园日常';campus.messages.A.stat_data.世界.灾变日=0;
 assert.equal(campus.api.isCampusPeriod(),true);
 assert.equal(await campus.api.prepareBeforeGeneration(),null);
 assert.equal(await campus.api.autoRefresh(),null);
 assert.equal(await campus.api.generate('muchi','manual'),null);
 assert.equal(campus.api.store.history.length,0);
 campus.messages.A.stat_data.世界.剧情时期='灾变后';
 const campusStart=campus.waitStart(),campusJob=campus.api.generate('muchi','manual');await campusStart;
 campus.messages.A.stat_data.世界.剧情时期='校园日常';
 campus.respond(JSON.stringify({broadcasts:[{channel:'muchi',headline:'late signal',summary:'late signal'}]}));
 assert.equal(await campusJob,null,'a delayed response must not leak into campus time');
 assert.equal(campus.api.store.history.length,0);
 assert.equal(campus.messages.A.stat_data.广播,undefined);
 console.log('PASS radio: zero/invalid indices, chat storage, stale target, late response, first reception and API sampling');
})().catch(e=>{console.error(e);process.exitCode=1});
