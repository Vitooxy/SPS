# DESIGN.md

## 项目与用户画像

学术研究者（心理学/高敏感研究），需要清晰、准确地展示 141 个 SPS 条目在 6 轴编码框架中的分类路径与组合模式。

## 品牌与视觉方向

- **气质**：学术、简约、清晰、数据驱动
- **风格**：类学术论文插图风格，无装饰性元素，信息密度高但层次分明

## Design Tokens

### 色彩

- **背景**：`bg-background`（浅色模式）
- **节点色**：每个轴值有独立语义色，按轴分组配色
  - Stimulus：暖色系（红/橙/黄）为主，区分物理/内部/社会刺激
  - Process：蓝色系
  - Outcome：红（负面）/绿（正面）/灰（未指定）
  - Response：红/绿/蓝 对应 Withdraw/Active Coping/Preventive
  - Cognitive Disposition：紫/粉
  - Primary Code：按上位分类着色（Overload=粉, Aversion=橙红, Coping=绿, Perceptual Sensitivity=蓝, Affective=紫, Social=青, Cognitive=橙, Other=灰）
- **链接色**：继承源节点颜色，低透明度（0.22）
- **选中态**：前景色描边，非活跃元素降至 0.08 透明度

### 字体

- 字体族：system-ui, -apple-system, sans-serif
- 标题：11-13px, semibold
- 节点标签：8-10px
- 分类标签：9.5px, semibold, 使用分类色

### 间距

- 节点间距：4px
- 列间距：自动均分
- 内边距：上52 下20 左20 右210（右侧留空给分类标签）

### 圆角

- 节点：`rounded-sm` (1.5px)

## 交互与状态

- **悬停**：节点/链接高亮，显示 tooltip
- **选中**：黑色描边，路径高亮，其余元素淡化
- **底部面板**：展示选中路径对应的条目列表

## 设计禁忌

- 不使用渐变色、阴影装饰
- 不使用蓝紫色 AI 味配色
- 不使用动画过渡以外的装饰性动效
- 不使用表情符号
