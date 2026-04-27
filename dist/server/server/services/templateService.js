export function getBuiltInTemplates() {
    return [
        {
            id: 'code-style-ts',
            name: 'TypeScript 代码规范',
            description: '定义 TypeScript 项目的编码风格和最佳实践',
            category: 'code-style',
            content: `# TypeScript 代码规范

## 命名约定
- 变量/函数: camelCase
- 类/接口/类型: PascalCase
- 常量: UPPER_SNAKE_CASE
- 文件名: kebab-case

## 类型要求
- 禁止使用 any，使用 unknown 替代
- 优先使用 interface 而非 type
- 必须显式声明函数返回类型

## 项目特定规则
{{PROJECT_RULES}}
`,
            variables: [
                {
                    key: 'PROJECT_RULES',
                    label: '项目特定规则',
                    defaultValue: '- 使用绝对路径导入\n- 组件文件使用 .tsx 后缀',
                    description: '添加你项目特有的规则',
                },
            ],
        },
        {
            id: 'code-style-python',
            name: 'Python 代码规范',
            description: '定义 Python 项目的编码风格和最佳实践',
            category: 'code-style',
            content: `# Python 代码规范

## 命名约定
- 变量/函数: snake_case
- 类: PascalCase
- 常量: UPPER_SNAKE_CASE
- 模块: snake_case

## 代码风格
- 遵循 PEP 8
- 最大行长度: 88 (Black 默认)
- 使用 type hints
- 使用 docstring 文档化所有公共函数

## 项目特定规则
{{PROJECT_RULES}}
`,
            variables: [
                {
                    key: 'PROJECT_RULES',
                    label: '项目特定规则',
                    defaultValue: '- 使用 Poetry 管理依赖\n- 使用 pytest 进行测试',
                    description: '添加你项目特有的规则',
                },
            ],
        },
        {
            id: 'testing-strategy',
            name: '测试策略',
            description: '定义项目的测试策略和规范',
            category: 'testing',
            content: `# 测试策略

## 测试类型
- 单元测试: 覆盖所有业务逻辑
- 集成测试: 覆盖 API 端点
- E2E 测试: 覆盖关键用户流程

## 测试规范
- 测试文件命名: \`*.test.ts\` 或 \`*.spec.ts\`
- 使用 describe/it 组织测试
- 每个测试只验证一个行为
- 使用 AAA 模式 (Arrange, Act, Assert)

## 覆盖率要求
- 最低覆盖率: {{MIN_COVERAGE}}%
- 关键路径: 100%

## Mock 策略
{{MOCK_STRATEGY}}
`,
            variables: [
                {
                    key: 'MIN_COVERAGE',
                    label: '最低覆盖率',
                    defaultValue: '80',
                    description: '设置最低测试覆盖率百分比',
                },
                {
                    key: 'MOCK_STRATEGY',
                    label: 'Mock 策略',
                    defaultValue: '- 外部 API 调用必须 Mock\n- 数据库操作使用内存数据库',
                    description: '定义 Mock 使用策略',
                },
            ],
        },
        {
            id: 'documentation',
            name: '文档规范',
            description: '定义项目文档编写规范',
            category: 'documentation',
            content: `# 文档规范

## 代码注释
- 所有公共 API 必须有 JSDoc/docstring
- 复杂逻辑需要行内注释
- TODO 注释必须关联 Issue 编号

## README 要求
- 项目简介
- 快速开始指南
- API 文档链接
- 贡献指南

## 变更日志
- 遵循 Conventional Commits
- 每次发布更新 CHANGELOG.md

## 项目特定要求
{{DOC_REQUIREMENTS}}
`,
            variables: [
                {
                    key: 'DOC_REQUIREMENTS',
                    label: '项目特定文档要求',
                    defaultValue: '- 使用中文编写文档\n- API 文档使用 Swagger',
                    description: '添加项目特有的文档要求',
                },
            ],
        },
        {
            id: 'architecture',
            name: '架构设计规范',
            description: '定义项目架构设计原则和规范',
            category: 'architecture',
            content: `# 架构设计规范

## 项目结构
{{PROJECT_STRUCTURE}}

## 设计原则
- 单一职责原则
- 依赖倒置原则
- 接口隔离原则

## 分层架构
- 表现层: UI 组件和页面
- 业务层: 业务逻辑和状态管理
- 数据层: API 调用和数据持久化

## 错误处理
- 统一错误边界
- 分级错误处理
- 用户友好的错误提示

## 性能要求
- 首屏加载 < 3s
- API 响应 < 500ms
- 组件懒加载
`,
            variables: [
                {
                    key: 'PROJECT_STRUCTURE',
                    label: '项目结构',
                    defaultValue: '```\nsrc/\n├── components/\n├── pages/\n├── stores/\n├── hooks/\n├── api/\n└── types/\n```',
                    description: '定义项目目录结构',
                },
            ],
        },
    ];
}
