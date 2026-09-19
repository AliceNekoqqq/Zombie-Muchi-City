# MR-87 Radio v1.1.0

## 生成 API 设置重构

- **主预设**：默认完全跟随酒馆当前 API / 模型 / 采样参数，不再无条件覆盖温度与最大 Tokens。
- **代理预设**：通过 Tavern Helper `getProxyPresetNames()` 读取酒馆中已经保存的代理预设；默认沿用预设模型，可按需开启“覆盖模型”。
- **独立 API**：只供 MR-87 使用。选择常见服务商时自动填入推荐 API URL；URL 可继续手改。
- **模型拉取**：通过 Tavern Helper `getModelList({ apiurl, key })` 拉取模型列表，并提供手填回退。
- **采样参数**：按模式独立记忆“继承 / 覆盖”，不再因为切换模式互相污染。
- v1.0.x 单一 `model` 字段会自动迁移到代理模型或独立 API 模型字段。

## 运行模型

- 脚本库按钮事件由角色卡脚本本体绑定。
- 设置界面使用独立 iframe 挂载到酒馆页面。
- 通过 Tavern Helper 注入的 jQuery 定位真实酒馆 document。
- 收音机正文仍挂载在消息楼层。
