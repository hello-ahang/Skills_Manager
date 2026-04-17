import { useState, useCallback, useRef, useEffect } from 'react'
import { DiffEditor } from '@monaco-editor/react'
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
import { Label } from '@/components/ui/label'
import { Wand2, Loader2, Check, X, Send, File, FilePlus, FileCheck, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useConfigStore } from '@/stores/configStore'
import { skillsApi, versionsApi, analyticsApi } from '@/api/client'
import { cn } from '@/lib/utils'

type Step = 'select-model' | 'chat' | 'compare'

interface ChatMessage {
  role: 'assistant' | 'user'
  content: string
}

interface FileOptimization {
  relativePath: string
  originalContent: string
  draftContent: string
  hasChanges: boolean
  isNew: boolean
}

interface AISkillOptimizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dirPath: string
  onSuccess?: () => void
}

// Build the system prompt from ahang-skill-checker methodology
function buildSystemPrompt(folderName: string, filesContent: string): string {
  return `你是一个专业的 AI 编程技能优化专家（Skill Checker），基于 ahang-skill-checker 方法论工作。你的任务是系统性地分析和优化技能文件，提升质量、结构、可发现性和安全性。

## 语言要求

**重要：你的所有输出内容必须使用中文**，包括优化报告、建议说明、优化后的文件内容（description、正文指令、参考文档等）。
唯一允许使用英文的部分：name 字段（kebab-case）、文件名/目录名、代码中的编程标识符。

## 核心理念

技能的 description 是 Agent 决定是否加载它的**唯一线索**——一个写得不好的 description 意味着技能永远不会被触发，等于不存在。同样，超长的 SKILL.md 浪费上下文窗口，硬编码凭证带来安全风险。你需要系统性地解决这些问题，让每个技能都能被正确发现、高效加载、安全运行。

## 当前技能文件夹：${folderName}

## 技能文件内容

${filesContent}

## 优化评估体系

### 一、元数据质量评估（满分 100）

这是最关键的一步——description 质量直接决定技能能否被发现和触发。

**name 字段（20 分）：**
- 格式为小写字母+数字+连字符（kebab-case），最长 64 字符
- 推荐动名词形式：\`creating-skills\` 优于 \`skill-creation\`
- 用行为命名：\`condition-based-waiting\` 优于 \`async-test-helpers\`
- 避免模糊名称：\`helper\`、\`utils\`、\`tools\`

**description 字段（80 分）：**
- 长度 ≤ 1024 字符，100-200 词为佳（10 分）
- 清楚说明"做什么"和"何时用"（30 分）
- 列出具体使用场景和触发词（30 分）
- 描述足够"pushy"——宁可多触发也不要漏触发（10 分）

> **关键原则——description 要"pushy"：** Agent 天然倾向于"欠触发"技能，即便技能明明适用也可能不加载。稍微强势的描述（如"即使用户没有明确要求 X，只要涉及 Y 就应该使用"）能有效对抗这个倾向。

> **关键反模式——不要在 description 中总结工作流：** 测试表明，当 description 总结了工作流时，Agent 可能跟随描述而非阅读完整技能内容。这创建了 Agent 会走的捷径，技能正文变成了 Agent 跳过的文档。

**description 好/差示例：**

好的示例：
\`\`\`yaml
description: 创意海报生成助手。根据自然语言描述自动生成高质量创意海报。
  当用户需要生成海报、设计宣传图、制作活动邀请函时触发。
  即使用户只是提到"做个图"或"设计一下"，也应考虑使用此技能。
\`\`\`

差的示例：
\`\`\`yaml
# 错误：总结了工作流
description: 系统化调试方法，先收集证据，再定位根因，最后验证修复

# 错误：太宽泛
description: 一个 TypeScript 技能
\`\`\`

**评级标准：**
- 🟢 优秀（90-100）：完全符合规范，description 足够 pushy
- 🟡 良好（70-89）：小幅改进空间
- 🟠 需改进（50-69）：需要重写
- 🔴 不合格（<50）：必须修复

### 二、结构合规性检查（三级加载系统）

技能使用三级加载系统，检查是否合理利用了这个层级：

1. **元数据**（name + description）— 始终在上下文，约 100 词。这是触发的关键。
2. **SKILL.md 主体** — 触发时加载，保持 < 500 行。核心指令和工作流程。
3. **捆绑资源**（references/、scripts/、assets/）— 按需加载，无限制。

**检查要点：**
- SKILL.md ≤ 500 行（推荐），超长内容拆到 references/
- 超过 50 行的详细说明、复杂决策树、大量示例代码应拆分到 references/
- 超过 300 行的 reference 文件应包含目录
- 多个场景都需要的类似脚本应打包到 scripts/
- 输出模板、配置模板应放到 assets/
- 从 SKILL.md 清晰引用 reference 文件，并说明何时应该读取它们
- references/ 中的文件命名语义化

### 三、内容质量审查

**写作原则（核心）：**
1. **解释 WHY 比堆砌 MUST/NEVER 更有效**：Agent 有良好的理解力，给它理由比给它命令效果更好。如果发现自己在写全大写的 ALWAYS 或 NEVER，这是一个信号——尝试重新表述，解释背后的推理。
2. **保持精简**：移除不起作用的冗余内容。每条指令都应该有明确的价值。
3. **泛化而非过拟合**：指令应适用于多种场景，不要为特定示例过度拟合。
4. **识别重复工作**：如果多个场景都需要类似的脚本，应打包到 scripts/ 中。

**常见反模式：**
| 反模式 | 为什么不好 | 改进方式 |
|--------|-----------|---------|
| 全大写 MUST/NEVER | 刚性且缺乏说服力 | 解释为什么这样做很重要 |
| description 总结工作流 | Agent 走捷径不读正文 | 只描述触发条件 |
| 大段内容未拆分 | 浪费上下文窗口 | 拆分到 references/ |
| 缺少实际示例 | 指令抽象难以执行 | 提供具体代码示例 |
| 叙事性故事 | 太具体，不可复用 | 提取通用模式 |

**指令质量：** 使用祈使语态、指令具体可执行、包含必要上下文
**工作流程：** 步骤清晰编号、逻辑顺序合理、包含决策分支、提供错误处理
**输出格式：** 标准化模板、使用代码块示例、提供变量占位符

### 四、安全检测

扫描技能文件中的安全风险，按严重程度分级：

**🔴 高危（必须修复）：**
- 凭证硬编码：API Key、Access Key（LTAI/AKID/AKIA 开头）、Secret Key、Token、Password、PEM 私钥
- 代码混淆：base64 解码后执行（\`base64 -d | bash\`）、大量 hex/unicode 编码
- 权限提升：sudo 调用、chmod 777、SetUID/SetGID

**🟠 中危（需审核）：**
- 命令执行：eval/exec/system 调用、subprocess 调用
- 网络外联：curl/wget 请求、非 localhost 的外部 URL
- 敏感路径：/etc/passwd、~/.ssh、~/.aws 等
- 连接串：数据库连接串（mysql://user:pass@host）、SSH 连接
- 内网 IP：10.x.x.x、172.16-31.x.x、192.168.x.x

**白名单豁免：**
- 明确标注为示例占位符的内容（如 \`# 示例，请替换\`）
- 官方文档链接
- localhost/127.0.0.1 本地地址

### 五、量化指标

优化效果的量化评估：

**可发现性提升：**
- 添加触发词：每个 +15%
- description 包含使用场景：每个 +10%（最多 3 个）
- description "pushy" 程度提升：+10%
- 格式规范符合：+5%

**加载效率提升：**
- SKILL.md 行数减少：每减少 10% 加 5%
- 逻辑拆分至 references/：+10%
- 合理利用三级加载：+10%

**内容质量提升：**
- 解释"为什么"而非堆砌"必须"：+15%
- 脚本封装：每个 +20%
- 模板添加：每个 +15%

## 工作流程

整个流程遵循：**扫描 → 评估 → 报告 → 确认 → 执行 → 验证** 的循环。

**第一轮对话**：分析所有文件，生成结构化优化报告，包括：

\`\`\`markdown
## [技能名称] 优化分析报告

### 📊 元数据评估
- **name**：[评分/20] — [评级] — [具体问题]
- **description**：[评分/80] — [评级] — [具体问题]
- **总分**：[X/100] [评级emoji]

### 📁 结构合规性
- SKILL.md 行数：[X 行]，[是否需要拆分]
- 三级加载利用情况：[评估]
- [具体问题列表]

### ✍️ 内容质量
- [具体问题列表，标注反模式类型]

### 🔒 安全检测
- [检测结果，按严重程度分级]

### 🔴 高优先级（必须修复）
- [ ] **问题**：...
  - **原因**：为什么这是个问题
  - **方案**：具体怎么修

### 🟡 中优先级（建议改进）
- [ ] ...

### 🟢 低优先级（优化提升）
- [ ] ...

### 📈 预估优化效果
- 可发现性提升：+X%
- 加载效率提升：+X%
- 内容质量提升：+X%
\`\`\`

然后向用户确认：
1. **全部自动优化** — 执行所有修复
2. **仅高优先级** — 只修复关键问题
3. **仅查看报告** — 不执行修改

**后续对话**：根据用户的回答，继续讨论或执行优化。

**执行优化时**：当用户确认要执行优化后，你必须返回优化后的所有文件内容，使用以下 JSON 格式（用 \`\`\`json 代码块包裹）：

\`\`\`json
{"optimized_files": [{"path": "SKILL.md", "content": "优化后的完整内容..."}, {"path": "references/xxx.md", "content": "优化后的完整内容..."}]}
\`\`\`

注意：
- path 是相对于技能文件夹的路径
- content 是优化后的完整文件内容
- 只包含有变更的文件和新增的文件
- 不要删除任何现有文件
- JSON 必须用 \`\`\`json 代码块包裹

**执行后验证**：优化不是一次性的。执行修复后，如果用户继续对话：
1. 重新评估修复效果
2. 检查是否引入新问题
3. 根据反馈调整并重新执行

**质量验证清单**（优化完成后逐项验证）：
- name 格式规范（小写+连字符，与目录名一致）
- description ≤ 1024 字符，包含"做什么"+"何时用"+触发词
- description 没有总结工作流（只描述触发条件）
- description 足够"pushy"
- SKILL.md < 500 行，复杂内容已拆分
- 无硬编码凭证或危险命令
- 指令解释了"为什么"而非堆砌"必须"`
}

export default function AISkillOptimizer({
  open,
  onOpenChange,
  dirPath,
  onSuccess,
}: AISkillOptimizerProps) {
  const { llmModels, preferences } = useConfigStore()
  const testedModels = llmModels.filter(m => m.tested)

  const [step, setStep] = useState<Step>('select-model')
  const [selectedModelId, setSelectedModelId] = useState('')

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const [folderFiles, setFolderFiles] = useState<{ relativePath: string; content: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Compare state
  const [fileOptimizations, setFileOptimizations] = useState<FileOptimization[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  const isDark = preferences.theme === 'dark' ||
    (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const folderName = dirPath.split('/').pop() || ''

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Build full messages array for API call
  const buildApiMessages = useCallback((chatMessages: ChatMessage[], filesContent: string) => {
    const systemMsg = {
      role: 'system' as const,
      content: buildSystemPrompt(folderName, filesContent),
    }
    return [systemMsg, ...chatMessages.map(m => ({ role: m.role, content: m.content }))]
  }, [folderName])

  // Call AI API via backend proxy to avoid CORS issues
  const callAI = useCallback(async (allMessages: ChatMessage[], files?: { relativePath: string; content: string }[]) => {
    const selectedModel = llmModels.find(m => m.id === selectedModelId)
    if (!selectedModel) throw new Error('未找到所选模型')

    const actualFiles = files || folderFiles
    const filesContent = actualFiles.map(f => `### 文件：${f.relativePath}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
    const apiMessages = buildApiMessages(allMessages, filesContent)

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
  }, [selectedModelId, llmModels, folderFiles, buildApiMessages])

  // Try to parse optimized files from AI response
  // Accept optional files param to avoid stale closure on folderFiles
  const tryParseOptimizedFiles = useCallback((content: string, files?: { relativePath: string; content: string }[]): FileOptimization[] | null => {
    const actualFiles = files || folderFiles
    let jsonStr: string | null = null

    // Strategy 1: Look for ```json ... ``` code block
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    // Strategy 2: Try to find raw JSON with "optimized_files" key
    if (!jsonStr) {
      const rawMatch = content.match(/\{[\s\S]*"optimized_files"\s*:\s*\[[\s\S]*\]\s*\}/)
      if (rawMatch) {
        jsonStr = rawMatch[0]
      }
    }

    // Strategy 3: Try parsing the entire content as JSON (AI returned pure JSON)
    if (!jsonStr && content.trim().startsWith('{')) {
      jsonStr = content.trim()
    }

    if (!jsonStr) return null

    try {
      const parsed = JSON.parse(jsonStr)
      if (!parsed.optimized_files || !Array.isArray(parsed.optimized_files)) return null

      const optimizations: FileOptimization[] = parsed.optimized_files.map((f: { path: string; content: string }) => {
        // Flexible path matching: try exact match first, then normalize and compare
        let existing = actualFiles.find(ff => ff.relativePath === f.path)
        // Use the actual relativePath from folderFiles for saving (not AI's path)
        let matchedPath = f.path
        if (!existing) {
          // Try matching with/without leading slash, or case-insensitive
          const normalizedPath = f.path.replace(/^\/+/, '')
          existing = actualFiles.find(ff => {
            const normalizedRel = ff.relativePath.replace(/^\/+/, '')
            return normalizedRel === normalizedPath || normalizedRel.toLowerCase() === normalizedPath.toLowerCase()
          })
        }
        if (!existing) {
          // Try reference/references folder name swap
          const swapped = f.path.replace(/^references?\//, (m) =>
            m === 'reference/' ? 'references/' : 'reference/'
          )
          existing = actualFiles.find(ff => ff.relativePath === swapped)
          if (existing) matchedPath = existing.relativePath
        }
        if (existing && matchedPath === f.path) {
          matchedPath = existing.relativePath
        }
        return {
          relativePath: matchedPath,
          originalContent: existing?.content || '',
          draftContent: f.content,
          hasChanges: existing ? existing.content !== f.content : true,
          isNew: !existing,
        }
      })

      return optimizations.filter(o => o.hasChanges || o.isNew)
    } catch {
      return null
    }
  }, [folderFiles])

  // Start optimization: read folder contents and send first message
  const handleStartOptimize = useCallback(async () => {
    if (!selectedModelId) {
      toast.warning('请先选择一个模型')
      return
    }

    setStep('chat')
    setSending(true)
    setMessages([])

    try {
      // Read all files in the folder
      const data = await skillsApi.getFolderContents(dirPath)
      setFolderFiles(data.files)

      // Send first analysis request
      const firstUserMsg: ChatMessage = {
        role: 'user',
        content: '请分析这个技能文件夹中的所有文件，生成优化报告，并告诉我你的优化建议。',
      }
      setMessages([firstUserMsg])

      // Pass files directly to avoid stale closure
      const aiResponse = await callAI([firstUserMsg], data.files)
      if (!aiResponse.trim()) throw new Error('模型返回了空内容')

      // Check if AI already returned optimized files (pass data.files to avoid stale closure)
      const optimizations = tryParseOptimizedFiles(aiResponse, data.files)
      if (optimizations && optimizations.length > 0) {
        setFileOptimizations(optimizations)

        // Extract non-JSON text part for display as summary
        let displayContent = aiResponse
        displayContent = displayContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
        // If the entire response was pure JSON, generate a summary message
        if (!displayContent || displayContent.length < 10) {
          displayContent = `已完成优化分析，共生成 **${optimizations.length}** 个文件的优化结果：\n\n${optimizations.map(o => `- \`${o.relativePath}\`${o.isNew ? '（新增）' : '（修改）'}`).join('\n')}\n\n请点击下方「查看对比结果」按钮查看详细的前后对比。`
        } else {
          displayContent += `\n\n---\n\n✅ 已生成 ${optimizations.length} 个文件的优化结果，请点击下方「查看对比结果」按钮查看。`
        }

        const aiMsg: ChatMessage = { role: 'assistant', content: displayContent }
        setMessages(prev => [...prev, aiMsg])
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiResponse }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      toast.error(`分析失败: ${error instanceof Error ? error.message : '未知错误'}`)
      setStep('select-model')
    } finally {
      setSending(false)
    }
  }, [selectedModelId, dirPath, callAI, tryParseOptimizedFiles])

  // Send user message
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

      // Check if AI returned optimized files
      const optimizations = tryParseOptimizedFiles(aiResponse, folderFiles)
      if (optimizations && optimizations.length > 0) {
        setFileOptimizations(optimizations)
        setSelectedFileIndex(0)

        // Extract non-JSON text part for display as summary
        let displayContent = aiResponse
        // Remove ```json...``` block from display
        displayContent = displayContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
        // If the entire response was pure JSON (no text left), generate a summary message
        if (!displayContent || displayContent.length < 10) {
          displayContent = `已完成优化分析，共生成 **${optimizations.length}** 个文件的优化结果：\n\n${optimizations.map(o => `- \`${o.relativePath}\`${o.isNew ? '（新增）' : '（修改）'}`).join('\n')}\n\n请点击下方「查看对比结果」按钮查看详细的前后对比。`
        } else {
          displayContent += `\n\n---\n\n✅ 已生成 ${optimizations.length} 个文件的优化结果，请点击下方「查看对比结果」按钮查看。`
        }

        const aiMsg: ChatMessage = { role: 'assistant', content: displayContent }
        setMessages(prev => [...prev, aiMsg])
        // Stay on chat view, let user click "查看对比结果" banner
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiResponse }
        setMessages(prev => [...prev, aiMsg])
      }
    } catch (error) {
      toast.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSending(false)
    }
  }, [userInput, sending, messages, callAI, tryParseOptimizedFiles, folderFiles])

  // Confirm and save all optimized files
  const handleConfirm = useCallback(async () => {
    if (fileOptimizations.length === 0) return
    setSaving(true)
    try {
      // Auto-create version snapshot before applying optimizations
      try {
        await versionsApi.create(dirPath, 'auto', 'AI 优化前自动备份')
      } catch {
        // Non-blocking: version creation failure should not prevent optimization
        console.warn('Failed to create auto version before AI optimization')
      }

      for (const opt of fileOptimizations) {
        if (!opt.hasChanges && !opt.isNew) continue
        const fullPath = `${dirPath}/${opt.relativePath}`
        if (opt.isNew) {
          // Ensure parent directory exists
          const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))
          try {
            await skillsApi.createDirectory(parentDir)
          } catch {
            // Directory may already exist
          }
          await skillsApi.createFile({ path: fullPath, content: opt.draftContent })
        } else {
          await skillsApi.saveFile(fullPath, opt.draftContent)
        }
      }
      toast.success(`已应用 ${fileOptimizations.length} 个文件的优化`)
      // Analytics: record ai-optimize event (non-blocking)
      analyticsApi.recordEvent({ skillPath: dirPath, eventType: 'ai-optimize' }).catch(() => {})
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }, [fileOptimizations, dirPath, onSuccess])

  const handleClose = useCallback(() => {
    setStep('select-model')
    setSelectedModelId('')
    setMessages([])
    setUserInput('')
    setSending(false)
    setFolderFiles([])
    setFileOptimizations([])
    setSelectedFileIndex(0)
    setSaving(false)
    onOpenChange(false)
  }, [onOpenChange])

  // Update draft content when user edits in DiffEditor
  const handleDraftChange = useCallback((index: number, value: string | undefined) => {
    if (value === undefined) return
    setFileOptimizations(prev => prev.map((opt, i) =>
      i === index ? { ...opt, draftContent: value } : opt
    ))
  }, [])

  const selectedOpt = fileOptimizations[selectedFileIndex]

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* Step 1: Select Model */}
      {step === 'select-model' && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              AI 优化技能
            </DialogTitle>
            <DialogDescription>
              选择一个模型来优化 <span className="font-medium text-foreground">{folderName}</span> 的所有文件
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>取消</Button>
            <Button onClick={handleStartOptimize} disabled={!selectedModelId}>
              <Wand2 className="mr-2 h-4 w-4" />
              开始分析
            </Button>
          </DialogFooter>
        </DialogContent>
      )}

      {/* Step 2: Chat Dialog */}
      {step === 'chat' && (
        <DialogContent className="!max-w-[70vw] !w-[70vw] h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4 text-purple-600" />
              AI 优化 — {folderName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              AI 正在分析技能文件，请根据报告确认优化方案
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
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-background [&_pre]:border [&_pre]:text-xs [&_code]:text-xs">
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
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-sm text-muted-foreground">AI 正在思考...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Optimization Result Banner */}
          {fileOptimizations.length > 0 && (
            <div className="border-t bg-purple-50 dark:bg-purple-950/30 px-4 py-2 shrink-0 flex items-center justify-between">
              <span className="text-xs text-purple-700 dark:text-purple-300">
                已生成 {fileOptimizations.length} 个文件的优化结果
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900"
                onClick={() => { setSelectedFileIndex(0); setStep('compare') }}
              >
                <Check className="mr-1 h-3 w-3" />
                查看对比结果
              </Button>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                className="flex-1 min-h-[40px] max-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="输入你的回复..."
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
                取消优化
              </Button>
            </div>
          </div>
        </DialogContent>
      )}

      {/* Step 3: Multi-file Compare View */}
      {step === 'compare' && (
        <DialogContent className="!max-w-[92vw] !w-[92vw] h-[88vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4 text-purple-600" />
              对比优化结果 — {folderName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              左侧选择文件，右侧查看对比（草稿侧可编辑）。确认后将替换所有变更文件。
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 min-h-0">
            {/* File List */}
            <div className="w-56 border-r flex flex-col min-h-0 shrink-0">
              <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
                变更文件（{fileOptimizations.length}）
              </div>
              <div className="flex-1 overflow-y-auto">
                {fileOptimizations.map((opt, i) => (
                  <button
                    key={opt.relativePath}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-left text-xs hover:bg-accent transition-colors',
                      i === selectedFileIndex && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setSelectedFileIndex(i)}
                  >
                    {opt.isNew ? (
                      <FilePlus className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    ) : opt.hasChanges ? (
                      <FileCheck className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    ) : (
                      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{opt.relativePath}</span>
                    {opt.isNew && (
                      <span className="ml-auto text-[10px] text-green-600 shrink-0">新增</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* DiffEditor */}
            <div className="flex-1 min-h-0">
              {selectedOpt && (
                <DiffEditor
                  key={selectedOpt.relativePath}
                  height="100%"
                  language="markdown"
                  theme={isDark ? 'vs-dark' : 'vs'}
                  original={selectedOpt.originalContent}
                  modified={selectedOpt.draftContent}
                  onMount={(_editor) => {
                    const modifiedEditor = _editor.getModifiedEditor()
                    modifiedEditor.onDidChangeModelContent(() => {
                      const value = modifiedEditor.getValue()
                      handleDraftChange(selectedFileIndex, value)
                    })
                  }}
                  options={{
                    readOnly: false,
                    originalEditable: false,
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    renderSideBySide: true,
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
                取消（丢弃草稿）
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                确认替换（{fileOptimizations.filter(o => o.hasChanges || o.isNew).length} 个文件）
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
