# TypeScript 代码规范

## 命名约定
- 变量/函数: camelCase
- 类/接口/类型: PascalCase
- 常量: UPPER_SNAKE_CASE
- 文件名: kebab-case

## 类型要求
- 禁止使用 any，使用 unknown 替代
- 优先使用 interface 而非 type
- 必须显式声明函数返回类型

## 导入规范
- 使用绝对路径导入（配置 path alias）
- 按顺序排列：外部库 → 内部模块 → 相对路径
- 使用 type-only imports: `import type { Foo } from './types'`

## 函数规范
- 优先使用箭头函数
- 函数参数不超过 3 个，超过使用对象参数
- 异步函数必须处理错误

## 项目特定规则
- 组件文件使用 .tsx 后缀
- 工具函数文件使用 .ts 后缀
- 每个文件只导出一个主要内容
