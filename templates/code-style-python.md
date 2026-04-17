# Python 代码规范

## 命名约定
- 变量/函数: snake_case
- 类: PascalCase
- 常量: UPPER_SNAKE_CASE
- 模块: snake_case
- 私有成员: _leading_underscore

## 代码风格
- 遵循 PEP 8
- 最大行长度: 88 (Black 默认)
- 使用 type hints
- 使用 docstring 文档化所有公共函数

## 导入规范
- 标准库 → 第三方库 → 本地模块
- 避免 `from module import *`
- 使用绝对导入

## 异常处理
- 捕获具体异常，避免 bare except
- 使用 logging 而非 print
- 自定义异常继承自 Exception

## 项目特定规则
- 使用 Poetry 管理依赖
- 使用 pytest 进行测试
- 使用 Black + isort + flake8 格式化
