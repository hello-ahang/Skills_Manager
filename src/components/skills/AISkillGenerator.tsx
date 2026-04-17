import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  Loader2,
  Check,
  X,
  Send,
  File,
  FilePlus,
  ArrowLeft,
  FolderPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/stores/configStore'
import { skillsApi, analyticsApi } from '@/api/client'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = 'input' | 'chat' | 'preview'

interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
}

interface GeneratedFile {
  path: string
  content: string
}

interface AISkillGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceDir: string
  onSuccess?: () => void
}

// ─── System Prompt: skill-creator methodology ───────────────────────────────

function buildSystemPrompt(skillName: string, userIdea: string): string {
  return `你是一个专业的 AI 编程技能生成器，基于 ahang-skill-creator 方法论工作。你帮助用户从零创建高质量的 Claude/Copilot 技能文件。

## 语言要求

**重要：你的所有输出内容必须使用中文**，包括对话回复、技能创建计划、description、SKILL.md 正文、references 文档等。
唯一允许使用英文的部分：name 字段（kebab-case）、文件名/目录名、代码中的编程标识符。

## 核心理念

写一个「能用」的 Skill 不难，写一个「好用」的 Skill 很难。常见问题：
- Description 写得不好导致技能不触发或误触发——description 是 Agent 决定是否加载技能的**唯一线索**，写不好等于不存在
- SKILL.md 太长或太短，信息密度失衡——上下文窗口是公共资源，每个 token 都要有价值
- 指令僵硬（堆砌 MUST/NEVER），模型无法灵活应对

你的工作是系统性地解决这些问题，帮用户创建能被正确发现、高效加载的技能。

## 技能结构规范

### YAML Frontmatter（必需）
SKILL.md 必须以 YAML frontmatter 开头（用 --- 包裹），**只包含 name 和 description 两个字段，不要添加任何其他字段**（如 license、compatibility、metadata 等都不要加）：

\`\`\`yaml
---
name: skill-name-here
description: 技能描述内容...
---
\`\`\`

- **name**（必需）：kebab-case 格式，最长 64 字符
  - 推荐动名词形式：\`processing-pdfs\` 优于 \`pdf-processing\`
  - 用行为命名：\`analyzing-spreadsheets\` 优于 \`data-helper\`
  - 避免模糊名称：\`helper\`、\`utils\`、\`tools\`
  - 避免保留词：\`anthropic-helper\`、\`claude-tools\`
- **description**（必需）：最长 1024 字符，不能包含尖括号 < >。这是技能最关键的字段，详见下方"Description 编写最佳实践"

### 三级加载系统（渐进式披露）

技能使用三级加载，生成时必须合理利用这个层级：

1. **元数据**（name + description）— 始终在上下文，约 100 词。这是触发的关键。
2. **SKILL.md 主体** — 触发时加载，保持 < 500 行。核心指令和工作流程。
3. **捆绑资源**（references/、scripts/、assets/）— 按需加载，无限制。

**关键规则：**
- SKILL.md 接近 500 行时，拆分内容到 references/ 并在正文中明确指向
- 超过 50 行的详细说明、复杂决策树、大量示例代码应拆分到 references/
- 超过 100 行的 reference 文件应包含目录
- 避免深层嵌套引用——保持**一层深度**（SKILL.md → reference.md，不要 A.md → B.md → C.md）
- 从 SKILL.md 清晰引用 reference 文件，并说明何时应该读取它们

### 目录结构
\`\`\`
skill-name/
├── SKILL.md (必需) — 主文件，包含 frontmatter + 核心指令
├── references/ (可选) — 参考文档，按需加载到上下文
├── scripts/ (可选) — 可执行脚本，确定性/重复性任务
└── assets/ (可选) — 输出资源（模板、图标、字体等）
\`\`\`

## Description 编写最佳实践

Description 决定了技能是否会被调用，是最关键的字段。

### 关键原则

1. **要"pushy"**：Agent 天然倾向于"欠触发"技能——即便技能明明适用也可能不加载。稍微强势的描述能有效对抗这个倾向。加入"即使用户没有明确要求 X，只要涉及 Y 就应使用"这样的表述。

2. **不要总结工作流**：测试表明，当 description 总结了工作流时，Agent 可能跟随描述而非阅读完整技能内容。这创建了 Agent 会走的捷径，技能正文变成了 Agent 跳过的文档。只描述"做什么"和"什么时候用"。

3. **使用第三人称**（description 会注入系统提示）：
   - ✅ "处理 Excel 文件并生成报告"
   - ❌ "我可以帮你处理 Excel 文件"

4. **包含触发场景和关键词**：列出用户可能使用的各种措辞，包括自然语言和行话。

5. **长度控制**：100-200 词为佳，硬限制 1024 字符。

### 好/差示例

好的示例：
\`\`\`yaml
description: 创意海报生成助手。根据自然语言描述自动生成高质量创意海报。
  当用户需要生成海报、设计宣传图、制作活动邀请函时触发。
  即使用户只是提到"做个图"或"设计一下"，也应考虑使用此技能。
  触发词：生成海报、设计图片、做个图、宣传图、邀请函。
\`\`\`

差的示例：
\`\`\`yaml
# 错误：总结了工作流
description: 通过四个阶段创建海报：需求分析、模板选择、内容填充、导出输出。

# 错误：太宽泛
description: 一个设计技能

# 错误：第一人称
description: 我可以帮你设计海报
\`\`\`

## 内容质量指导

### 写作原则

1. **解释 WHY 而非堆砌 MUST**：今天的 LLM 很聪明，理解了"为什么"就能灵活应对各种情况。如果发现自己在写大写的 ALWAYS/NEVER，这是黄旗——试着改为解释背后的原因。
2. **保持精简**：上下文窗口是公共资源。每段指令都要问：这真的有必要吗？移除不起作用的冗余内容。
3. **保持通用**：不要过度拟合具体示例，让指令适用于各种输入。
4. **识别重复工作**：如果多个场景都需要类似的脚本，应打包到 scripts/ 中。
5. **使用祈使语态**写指令。
6. **提供具体示例**：用代码示例和具体场景来说明抽象规则。

### 自由度匹配

根据任务的脆弱性匹配指令的具体程度：
- **高自由度**（多种方法都可行）：给出大方向，信任模型找到最佳路线。如：代码审查流程
- **中自由度**（有首选模式但允许变化）：提供默认方案但允许调整。如：带参数的脚本
- **低自由度**（操作脆弱、一致性关键）：提供具体护栏和精确指令。如：数据库迁移

### Skill 结构模式

根据技能用途选择合适的结构模式：

1. **工作流型**（顺序步骤流程）：适合有明确步骤顺序的任务
   - 结构：概览 → 工作流决策树 → 步骤1 → 步骤2...
2. **任务型**（不同操作/能力）：适合提供多种操作的工具集
   - 结构：概览 → 快速开始 → 任务类别1 → 任务类别2...
3. **参考型**（标准/规范）：适合品牌指南、编码标准等
   - 结构：概览 → 指南 → 规范 → 用法...
4. **能力型**（多个关联功能）：适合集成系统
   - 结构：概览 → 核心能力 → 功能1 → 功能2...

模式可以混合使用，根据实际需求灵活组合。

### 反模式清单

| 反模式 | 为什么不好 | 改进方式 |
|--------|-----------|---------|
| 全大写 MUST/NEVER | 刚性且缺乏说服力 | 解释为什么这样做很重要 |
| description 总结工作流 | Agent 走捷径不读正文 | 只描述触发条件 |
| 深层嵌套引用 | 模型可能只部分读取 | 保持一层深度 |
| 术语不一致 | 混淆理解 | 选择一个术语并坚持使用 |
| 缺少实际示例 | 指令抽象难以执行 | 提供具体代码示例 |
| 大段内容未拆分 | 浪费上下文窗口 | 拆分到 references/ |

### 脚本最佳实践（如果生成 scripts/）

- 脚本应处理错误条件，而不是推给模型
- 避免魔法数字，配置参数应有文档说明
- 脚本有清晰文档和使用说明
- 无 Windows 风格路径（全用正斜杠）

## 工作流程

${skillName ? `用户希望创建的技能名称：${skillName}\n` : ''}用户的需求描述：${userIdea}

### 第一轮对话：需求挖掘与架构蓝图

分析用户的需求，主动补充用户可能遗漏的需求，生成一份**技能架构蓝图**：

1. **技能名称**（如果用户未指定，根据需求自动生成 kebab-case 名称，推荐动名词形式）
2. **技能描述（description）草案**——遵循上述"pushy"原则
3. **文件结构规划**（列出将要创建的所有文件及其用途，说明为什么需要这些文件）
4. **各文件的内容大纲**（每个文件的核心内容概要）
5. **结构模式选择**（工作流型/任务型/参考型/能力型，说明为什么选择这个模式）

然后向用户确认：
- 文件结构是否合理？
- 是否需要添加或移除某些文件？
- 描述是否准确反映了技能的用途？
- 结构模式是否合适？

### 后续对话

根据用户的反馈，调整计划或直接执行生成。

### 执行生成

当用户确认要生成后，你必须返回所有文件的完整内容，使用以下 JSON 格式（用 \`\`\`json 代码块包裹）：

\`\`\`json
{"skill_files": [{"path": "SKILL.md", "content": "完整文件内容..."}, {"path": "references/guide.md", "content": "完整文件内容..."}]}
\`\`\`

注意：
- path 是相对于技能文件夹根目录的路径
- content 是文件的完整内容
- SKILL.md 是必需的，其他文件根据需求决定
- JSON 必须用 \`\`\`json 代码块包裹
- SKILL.md 的 frontmatter 必须严格遵循上述规范

### 生成后质量自检

生成文件后，在返回结果的同时，附上质量自检结果：

**核心质量：**
- [ ] name 格式规范（kebab-case，动名词形式）
- [ ] description ≤ 1024 字符，包含"做什么"+"何时用"+触发词
- [ ] description 足够"pushy"，没有总结工作流
- [ ] description 使用第三人称
- [ ] SKILL.md < 500 行，复杂内容已拆分
- [ ] 指令解释了"为什么"而非堆砌"必须"
- [ ] 合理利用三级加载（元数据 → 正文 → 捆绑资源）
- [ ] 引用保持一层深度
- [ ] 全文术语一致

**代码和脚本（如有）：**
- [ ] 脚本有错误处理
- [ ] 无魔法数字
- [ ] 有清晰文档

## Description 优化

在生成完技能文件后，如果用户要求优化 description，你需要：

1. **生成触发评估查询**：创建 10-20 个测试查询，包括：
   - 8-10 个 should-trigger 查询（应该触发此技能的用户提问）
   - 8-10 个 should-not-trigger 查询（不应该触发此技能的近似提问）
   
   好的测试查询应该：
   - 具体且真实，像用户实际会输入的内容
   - should-not-trigger 查询应该是"近似但不同"的，而非明显无关的（最有价值的是"差一点就该触发"的近似请求）
   - 包含不同的措辞风格（正式/随意/简短/详细）

2. **分析当前 description 的触发准确率**：评估每个查询是否会被当前 description 正确触发或正确忽略

3. **提供优化后的 description**：基于分析结果，生成改进版本

4. 将优化后的 description 更新到 SKILL.md 中，使用相同的 JSON 格式返回更新后的文件`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AISkillGenerator({
  open,
  onOpenChange,
  sourceDir,
  onSuccess,
}: AISkillGeneratorProps) {
  const { llmModels, preferences } = useConfigStore()
  const testedModels = llmModels.filter(m => m.tested)

  // Step state
  const [step, setStep] = useState<Step>('input')

  // Input state
  const [selectedModelId, setSelectedModelId] = useState('')
  const [idea, setIdea] = useState('')
  const [skillName, setSkillName] = useState('')

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Preview state
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  const isDark = preferences.theme === 'dark' ||
    (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // ─── API Helpers ────────────────────────────────────────────────────────

  const buildApiMessages = useCallback((chatMessages: ChatMessage[]) => {
    const systemMsg = {
      role: 'system' as const,
      content: buildSystemPrompt(skillName, idea),
    }
    return [systemMsg, ...chatMessages.map(m => ({ role: m.role, content: m.content }))]
  }, [skillName, idea])

  const callAI = useCallback(async (allMessages: ChatMessage[]) => {
    const selectedModel = llmModels.find(m => m.id === selectedModelId)
    if (!selectedModel) throw new Error('未找到所选模型')

    const apiMessages = buildApiMessages(allMessages)

    const response = await fetch('/api/config/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: selectedModel.baseUrl,
        apiKey: selectedModel.apiKey,
        modelName: selectedModel.modelName,
        messages: apiMessages,
        max_tokens: 16384,
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errData.error || `API 返回 ${response.status}`)
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ''
  }, [selectedModelId, llmModels, buildApiMessages])

  // ─── JSON Parsing (multi-strategy) ──────────────────────────────────────

  const tryParseGeneratedFiles = useCallback((content: string): GeneratedFile[] | null => {
    let jsonStr: string | null = null

    // Strategy 1: ```json ... ``` code block
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Strategy 2: Raw JSON with skill_files key
    if (!jsonStr) {
      const rawMatch = content.match(/\{[\s\S]*"skill_files"\s*:\s*\[[\s\S]*\]\s*\}/)
      if (rawMatch) {
        jsonStr = rawMatch[0]
      }
    }

    // Strategy 3: Try parsing entire content as JSON
    if (!jsonStr && content.trim().startsWith('{')) {
      jsonStr = content.trim()
    }

    if (!jsonStr) return null

    try {
      const parsed = JSON.parse(jsonStr)
      const files = parsed.skill_files || parsed.optimized_files
      if (!files || !Array.isArray(files)) return null

      return files
        .filter((f: any) => f.path && f.content)
        .map((f: any) => ({
          path: f.path,
          content: f.content,
        }))
    } catch {
      return null
    }
  }, [])

  // ─── Handlers ───────────────────────────────────────────────────────────

  // Start generation: enter chat mode and send first message
  const handleStartGenerate = useCallback(async () => {
    if (!selectedModelId) {
      toast.warning('请先选择一个模型')
      return
    }
    if (!idea.trim()) {
      toast.warning('请描述你想创建的技能')
      return
    }

    setStep('chat')
    setSending(true)
    setMessages([])
    setGeneratedFiles([])

    try {
      const firstUserMsg: ChatMessage = {
        role: 'user',
        content: `请根据我的需求，生成技能创建计划。\n\n需求描述：${idea}${skillName ? `\n技能名称：${skillName}` : ''}`,
      }
      setMessages([firstUserMsg])

      const aiResponse = await callAI([firstUserMsg])
      if (!aiResponse.trim()) throw new Error('模型返回了空内容')

      // Check if AI returned generated files directly
      const files = tryParseGeneratedFiles(aiResponse)
      if (files && files.length > 0) {
        setGeneratedFiles(files)

        // Extract non-JSON text for display
        let displayContent = aiResponse
        displayContent = displayContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
        if (!displayContent || displayContent.length < 10) {
          displayContent = `已生成 **${files.length}** 个技能文件：\n\n${files.map(f => `- \`${f.path}\``).join('\n')}\n\n请点击下方「预览生成结果」按钮查看文件内容。`
        } else {
          displayContent += `\n\n---\n\n✅ 已生成 ${files.length} 个文件，请点击下方「预览生成结果」按钮查看。`
        }

        const aiMsg: ChatMessage = { role: 'assistant', content: displayContent }
        setMessages(prev => [...prev, aiMsg])
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiResponse }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      toast.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setStep('input')
    } finally {
      setSending(false)
    }
  }, [selectedModelId, idea, skillName, callAI, tryParseGeneratedFiles])

  // Send user message in chat
  const handleSendMessage = useCallback(async () => {
    const text = userInput.trim()
    if (!text || sending) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setUserInput('')
    setSending(true)

    try {
      const aiResponse = await callAI(updatedMessages)
      if (!aiResponse.trim()) throw new Error('模型返回了空内容')

      // Check if AI returned generated files
      const files = tryParseGeneratedFiles(aiResponse)
      if (files && files.length > 0) {
        setGeneratedFiles(files)
        setSelectedFileIndex(0)

        // Extract non-JSON text for display
        let displayContent = aiResponse
        displayContent = displayContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
        if (!displayContent || displayContent.length < 10) {
          displayContent = `已生成 **${files.length}** 个技能文件：\n\n${files.map(f => `- \`${f.path}\``).join('\n')}\n\n请点击下方「预览生成结果」按钮查看文件内容。`
        } else {
          displayContent += `\n\n---\n\n✅ 已生成 ${files.length} 个文件，请点击下方「预览生成结果」按钮查看。`
        }

        const aiMsg: ChatMessage = { role: 'assistant', content: displayContent }
        setMessages(prev => [...prev, aiMsg])
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiResponse }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      toast.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSending(false)
    }
  }, [userInput, sending, messages, callAI, tryParseGeneratedFiles])

  // Confirm and create all files
  const handleConfirmCreate = useCallback(async () => {
    if (generatedFiles.length === 0) return

    // Derive folder name from skillName or first SKILL.md frontmatter
    let folderName = skillName.trim()
    if (!folderName) {
      // Try to extract name from SKILL.md frontmatter
      const skillMd = generatedFiles.find(f => f.path === 'SKILL.md')
      if (skillMd) {
        const nameMatch = skillMd.content.match(/^---[\s\S]*?name:\s*(.+?)[\s\r\n]/m)
        if (nameMatch) folderName = nameMatch[1].trim()
      }
    }
    if (!folderName) {
      toast.error('无法确定技能文件夹名称，请填写技能名称')
      return
    }

    const skillDir = `${sourceDir}/${folderName}`
    setSaving(true)

    try {
      // Create skill root directory
      try {
        await skillsApi.createDirectory(skillDir)
      } catch {
        // Directory may already exist
      }

      // Create all files
      for (const file of generatedFiles) {
        const fullPath = `${skillDir}/${file.path}`

        // Ensure parent directory exists
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))
        if (parentDir !== skillDir) {
          try {
            await skillsApi.createDirectory(parentDir)
          } catch {
            // Directory may already exist
          }
        }

        await skillsApi.createFile({ path: fullPath, content: file.content })
      }

      toast.success(`技能「${folderName}」已创建，包含 ${generatedFiles.length} 个文件`)
      // Analytics: record ai-generate event (non-blocking)
      analyticsApi.recordEvent({ skillPath: `${sourceDir}/${folderName}`, skillName: folderName, eventType: 'ai-generate' }).catch(() => {})
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }, [generatedFiles, skillName, sourceDir, onSuccess])

  // Close and reset
  const handleClose = useCallback(() => {
    setStep('input')
    setSelectedModelId('')
    setIdea('')
    setSkillName('')
    setMessages([])
    setUserInput('')
    setSending(false)
    setGeneratedFiles([])
    setSelectedFileIndex(0)
    setSaving(false)
    onOpenChange(false)
  }, [onOpenChange])

  // Update file content when user edits in preview
  const handleFileContentChange = useCallback((index: number, value: string | undefined) => {
    if (value === undefined) return
    setGeneratedFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, content: value } : f
    ))
  }, [])

  const selectedFile = generatedFiles[selectedFileIndex]

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* ── Step 1: Input ── */}
      {step === 'input' && (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              AI 生成技能
            </DialogTitle>
            <DialogDescription>
              描述你想创建的技能，AI 将与你讨论需求后生成完整的多文件技能
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label>选择模型</Label>
              {testedModels.length > 0 ? (
                <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="请选择已验证的模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {testedModels.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                        <span className="ml-1.5 text-xs text-muted-foreground">({m.modelName})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border border-dashed p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    暂无可用模型，请先在右上角「模型配置」中添加并测试通过模型
                  </p>
                </div>
              )}
            </div>

            {/* Skill Name (optional) */}
            <div className="space-y-2">
              <Label>技能名称 <span className="text-xs text-muted-foreground">（可选，kebab-case）</span></Label>
              <Input
                placeholder="例如：code-review-helper"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
            </div>

            {/* Idea Description */}
            <div className="space-y-2">
              <Label>需求描述</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder={"描述你想创建的技能，例如：\n- 帮助进行 TypeScript 代码审查\n- 检查命名规范、类型使用、错误处理\n- 提供修改建议和最佳实践"}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>取消</Button>
            <Button
              onClick={handleStartGenerate}
              disabled={!selectedModelId || !idea.trim()}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              开始生成
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* ── Step 2: Chat ── */}
      {step === 'chat' && (
        <DialogContent className="!max-w-[70vw] !w-[70vw] h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-violet-600" />
              AI 生成技能{skillName ? ` — ${skillName}` : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              与 AI 讨论需求，确认方案后生成完整的技能文件
            </DialogDescription>
          </DialogHeader>

          {/* Chat Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-4 py-3 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-background [&_pre]:border [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_pre]:text-foreground [&_code]:text-xs [&_code]:text-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  <span className="text-sm text-muted-foreground">AI 正在思考...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Generated Files Banner */}
          {generatedFiles.length > 0 && (
            <div className="border-t bg-violet-50 dark:bg-violet-950/30 px-4 py-2 shrink-0 flex items-center justify-between">
              <span className="text-xs text-violet-700 dark:text-violet-300">
                已生成 {generatedFiles.length} 个技能文件
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900"
                onClick={() => { setSelectedFileIndex(0); setStep('preview') }}
              >
                <Check className="mr-1 h-3 w-3" />
                预览生成结果
              </Button>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[40px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="输入你的回复...（确认方案后 AI 将生成文件）"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!userInput.trim() || sending}
                className="shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">
                Enter 发送，Shift+Enter 换行
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-6"
                onClick={handleClose}
              >
                取消生成
              </Button>
            </div>
          </div>
        </DialogContent>
      )}

      {/* ── Step 3: Preview & Confirm ── */}
      {step === 'preview' && (
        <DialogContent className="!max-w-[92vw] !w-[92vw] h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FolderPlus className="h-4 w-4 text-violet-600" />
              预览生成结果{skillName ? ` — ${skillName}` : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">
              左侧选择文件，右侧预览和编辑内容。确认后将创建技能文件夹和所有文件。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 min-h-0">
            {/* File List */}
            <div className="w-56 border-r flex flex-col min-h-0 shrink-0">
              <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
                生成文件（{generatedFiles.length}）
              </div>
              <div className="flex-1 overflow-y-auto">
                {generatedFiles.map((file, i) => (
                  <button
                    key={file.path}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors',
                      i === selectedFileIndex && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setSelectedFileIndex(i)}
                  >
                    {file.path === 'SKILL.md' ? (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                    ) : (
                      <FilePlus className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    )}
                    <span className="truncate">{file.path}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0">
              {selectedFile && (
                <Editor
                  key={selectedFile.path}
                  height="100%"
                  language={selectedFile.path.endsWith('.md') ? 'markdown' : selectedFile.path.endsWith('.py') ? 'python' : selectedFile.path.endsWith('.sh') ? 'shell' : selectedFile.path.endsWith('.json') ? 'json' : selectedFile.path.endsWith('.yaml') || selectedFile.path.endsWith('.yml') ? 'yaml' : 'plaintext'}
                  theme={isDark ? 'vs-dark' : 'vs'}
                  value={selectedFile.content}
                  onChange={(value) => handleFileContentChange(selectedFileIndex, value)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 8 },
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('chat')}
              disabled={saving}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              返回对话
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                取消
              </Button>
              <Button onClick={handleConfirmCreate} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
                )}
                确认创建（{generatedFiles.length} 个文件）
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
