let registerMvuSchema;
try { ({registerMvuSchema}=await import('https://cdn.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js')); }
catch(e){ ({registerMvuSchema}=await import('https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js')); }
const pct=(d)=>z.coerce.number().transform(v=>_.clamp(v,0,100)).prefault(d);
const nni=(d=0)=>z.coerce.number().transform(v=>Math.max(0,Math.round(v))).prefault(d);
const txt=(d='')=>z.string().prefault(d);
const item=z.object({ID:txt(''),名称:txt('未命名'),数量:nni(1),状态:txt('完好'),新鲜度:txt('不适用')}).prefault({});
const loc=z.object({资源指数:pct(50),尸群指数:pct(50),通行状态:z.enum(['可通行','谨慎通行','受阻','封锁']).prefault('谨慎通行'),动态标签:z.array(z.string()).prefault([]),最后更新时间:txt('未知')}).prefault({});
const sideQuest=z.object({状态:z.enum(['失联','发现踪迹','锁定区域','位置确认','等待救援','已救援']).prefault('失联'),已获得线索:z.array(z.string()).prefault([]),最近线索:txt('无'),推测区域:txt('未知'),位置已确认:z.coerce.boolean().prefault(false),救援状态:z.enum(['未触发','可救援','救援中','已救援']).prefault('未触发')}).prefault({});
const dispatch=z.object({是否进行:z.coerce.boolean().prefault(false),任务ID:txt(''),目标地点:txt(''),行动类型:z.enum(['无','物资搜集','肉食搜集','医疗搜集','路线侦查','情报搜寻','协助搬运']).prefault('无'),目标物资:txt('无'),出发时间:txt(''),预计返回时间:txt(''),携带物品:z.array(z.string()).prefault([]),状态:z.enum(['无','准备','外出中','返程中','待结算','遇险']).prefault('无'),结果摘要:txt('')}).prefault({});
const teammate=z.object({状态:z.enum(['未归队','休养中','可行动','受伤','外出中','遇险','失联']).prefault('未归队'),所在地:txt('未知'),当前派遣:dispatch}).prefault({});
const radioBrief=z.object({事件时间:txt(''),来源:txt(''),摘要:txt('')}).prefault({});
const radio=z.object({当前频道:z.enum(['全球','中国','暮迟市']).prefault('暮迟市'),信号状态:z.enum(['强','一般','微弱','断续']).prefault('断续'),上次刷新时间:txt(''),最近事件:txt('无'),全球:radioBrief,中国:radioBrief,暮迟市:radioBrief}).prefault({});
const Schema=z.object({
 世界:z.object({当前时间:txt('2024-10-27 19:42'),灾变日:nni(1),时段:txt('夜间'),当前地点:txt('地下安全屋'),天气:z.object({类型:txt('多云'),环境温度:z.coerce.number().prefault(12),能见度:txt('良好'),环境影响:z.array(z.string()).prefault([])}).prefault({}),解药:z.object({状态:txt('研发中'),研发完成时间:txt('2026-04-27 19:42'),剩余天数:nni(547),剩余小时:z.coerce.number().transform(v=>_.clamp(Math.round(v),0,23)).prefault(0),终局阶段:txt('等待研发'),候选发放点:z.array(z.any()).max(3).prefault([])}).prefault({})}).prefault({}),
 沈挽昼:z.object({核心状态:z.object({理智值:pct(78),躁变值:pct(18),侵蚀度:pct(23),异化阶段:txt('稳定'),是否狂暴:z.coerce.boolean().prefault(false),抑制剩余分钟:nni(180)}).prefault({}),生命体征:z.object({饱腹度:pct(68),水合度:pct(76),体能:pct(82),睡眠充足度:pct(70),伤势度:pct(18),体温:z.coerce.number().prefault(35.9)}).prefault({}),身体状态:z.object({当前伤口:z.array(z.string()).prefault([]),当前症状:z.array(z.string()).prefault([]),状态标签:z.array(z.string()).prefault([])}).prefault({}),装备:z.object({主手:txt('消防斧'),副手:txt('折叠刀'),防护装备:z.array(z.string()).prefault([]),随身工具:z.array(z.string()).prefault([]),负重状态:z.enum(['轻便','适中','沉重','超载']).prefault('适中')}).prefault({})}).prefault({}),
 用户:z.object({当前伤势:z.array(z.string()).prefault([]),状态标签:z.array(z.string()).prefault([]),装备:z.array(z.string()).prefault([])}).prefault({}),
 物资:z.object({沈挽昼携带:z.array(item).prefault([]),用户背包:z.array(item).prefault([]),安全屋储备:z.array(item).prefault([])}).prefault({}),
 安全屋:z.object({名称:txt('地下安全屋'),防护完整度:pct(86),隐蔽度:pct(92),电力状态:txt('有限供电'),状态标签:z.array(z.string()).prefault([]),可用设施:z.record(z.string(),z.object({状态:txt('未知'),备注:txt('')}).prefault({})).prefault({})}).prefault({}),
 支线:z.object({林安安:sideQuest,陆斯年:sideQuest}).prefault({}),
 队友:z.object({林安安:teammate,陆斯年:teammate}).prefault({}),
 广播:radio,
 地图:z.object({地点动态:z.record(z.string(),loc).prefault({})}).prefault({})
}).prefault({});
$(()=>registerMvuSchema(Schema));
