# 暮迟市 MR-87 末世收音机 v2

## 设计方向

v2 改为：**收音机本体直接出现在最新一条角色回复末尾**。不再打开独立的大型收音机弹窗。

独立界面只保留「设置」。

## 文件

```text
Radio/
├─ index.js      # import 入口
├─ core.js       # 广播生成、API、历史、自动刷新、MVU同步
├─ ui.js         # 回复末尾的实体收音机 + 设置面板
└─ style.css     # 收音机与设置UI样式
```

## Tavern Helper 导入

```js
import 'https://testingcf.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/index.js';
```

稳定发布后可切换为：

```js
import 'https://cdn.jsdelivr.net/gh/AliceNekoqqq/Zombie-Muchi-City@main/Radio/index.js';
```

## 收音机本体

会自动挂载到最新一条 AI/角色回复的正文末尾。

包含：
- 全球 / 中国 / 暮迟市三个频道
- 实体扬声器、LCD、频率、信号格
- TUNING / VOL 旋钮
- POWER / MUTE / LIGHT / HOLD / SCAN / M1
- 接收新播报
- LOG 广播历史抽屉
- 静电与按键音效

其中只有「接收新播报」和开启后的自动刷新会真正调用模型。其余很多按键主要承担沉浸式视觉与交互反馈。

## 设置

独立设置面板支持：
- 跟随酒馆主 API
- 酒馆代理预设
- 独立 API
- API URL / Key / Model / Source
- 温度 / 最大 Tokens
- 世界时间自动刷新
- 跨日期刷新
- 跨区域刷新本地台
- 自动频道策略
- 民间信息倾向
- 紧张度
- 重复保护
- 自定义广播偏好
- 历史保存数量
- MVU 最新摘要同步
- 音效 / 静电强度 / UI缩放
- 是否在最新回复末尾显示设备

## 世界观保护

固定：
- 灾变：2031-05-07
- 稳定解药：2031-11-03
- 主角不是关键样本或救世主
- 广播不知道沈挽昼特殊感染
- 广播不知道 {{user}} 的实时位置
- 广播不知道楚泽私人秘密
- 广播不能成为主角专属任务发布器

## MVU 分工

完整历史由脚本管理。

MVU只镜像：
- 当前频道
- 信号状态
- 上次刷新时间
- 全球 / 中国 / 暮迟市各自最新摘要

这样原状态栏仍能显示简短广播，而完整设备负责阅读和互动。
