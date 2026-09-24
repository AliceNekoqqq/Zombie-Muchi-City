async function importMr87(){
  const urls=[
    'https://cdn.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/index.js?mr87=1150',
    'https://testingcf.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/index.js?mr87=1150',
    'https://fastly.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/index.js?mr87=1150'
  ];
  const errors=[];
  for(const url of urls){
    try{
      const mod=await import(url);
      if(mod.VERSION!=='1.15.0')throw new Error('收音机模块版本不匹配');
      if(typeof mod?.openRadio==='function' && typeof mod?.openSettings==='function')return mod;
      errors.push(`${url} -> 导出不匹配: ${Object.keys(mod||{}).join(',')||'无导出'}`);
    }catch(e){errors.push(`${url} -> ${e?.message||e}`)}
  }
  throw new Error('MR-87 v1.15.0 模块加载失败；请将 Radio 目录上传到 Zombie-Muchi-City main，并可在发布后固定提交版本。'+errors.join(' | '));
}
const mr87=await importMr87();
$(()=>{
  eventOn(getButtonEvent('打开MR-87'),()=>mr87.openRadio());
  eventOn(getButtonEvent('收音机设置'),()=>mr87.openSettings());
});
