# DeepSeek Harness 人工处理（HITL）接入

**Date:** 2026-08-22  
**Status:** Draft for review  
**Scope:** 在 Design Agent 对话里完成 DeepSeek Harness 的工具批准与向用户提问，不再跳转到 `http://127.0.0.1:3080`。

## 目标

当 Harness 在一轮 `session.prompt` 中发出 `approval/requested` 或 `question/requested` 时，本应用在输入框上方展示卡片，用户处理后通过 `POST /dsh/api/respond` 回写，同一轮 assistant 消息继续流式输出。

## 非目标

- 不嵌入或跳转 Harness Web UI。
- 不在聊天记录中留下「已允许 / 已拒绝 / 已回答」回执。
- 不改 Harness 权限预设（沿用 `session.create` 的默认权限，例如 workspace-write）。
- 不实现 `plan-review` 专用排版：若题目带 `intent.kind === 'plan-review'`，仍按普通单选/多选渲染。
- 不把待处理 HITL 状态写入 localStorage。

## 已确认的产品决策

| 决策 | 选择 |
| --- | --- |
| 覆盖类型 | 工具批准 + 向用户提问 |
| 卡片位置 | 贴在输入框上方（`HitlDock`），不插进气泡、不用模态 |
| 处理后 | 卡片消失，对话里不留痕迹 |
| 流式语义 | 同一轮暂停再继续，不新开 `session.prompt` |

## 架构

整轮对话期间 Mux WebSocket 保持订阅。HITL 是流上的可回答帧，不是错误。

1. `DeepSeekHarnessChatStreamClient.stream()` 在收到 `approval/requested` / `question/requested` 时 **yield 事件且不结束 generator**（不得再 `finished = true` 并 yield `error`）。
2. UI 回答后调用客户端 `respond(...)`，向 `POST ${dshHttpBase()}/api/respond` 发送 `client-response`，**echo 服务端 `rpcId`，不新造 id**。
3. Harness 继续本轮；客户端继续从已有 Mux 订阅收取 `session/event` delta，直到 `turn/end`。
4. 一轮内可多次 HITL；同一时刻 UI 只展示一张卡（最新 `rpcId`）。

刷新：`pendingHitl` 不落盘。重连 Mux 后若 Harness 重放未处理帧，再展示卡片；若本轮已丢，用户重新发送。

## 协议

现有 unary RPC（`session.create` / `session.prompt` / `session.cancel`）不变。新增：

### 入站（Mux `server-request`）

信封：`{ type: 'server-request', rpcId, method, payload }`。`method` 与 `payload.type` 均为下列字面量。

**批准**

```ts
{
  type: 'approval/requested';
  sessionId: string;
  approvalId: string;
  toolName: string;
  callId?: string;
  reason?: string;
}
```

**提问**

```ts
{
  type: 'question/requested';
  sessionId: string;
  questions: Array<{
    id: string;
    question: string;
    detail?: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
}
```

**已在他处处理（用于清卡）**

- `approval/resolved`：`{ sessionId, approvalId, outcome }`
- `question/resolved`：`{ sessionId, questionRpcId, outcome: 'answered' | 'cancelled' }`

### 出站（`POST /dsh/api/respond`）

**批准**

```json
{
  "type": "client-response",
  "rpcId": "<echo approval/requested rpcId>",
  "result": {
    "ok": true,
    "value": {
      "sessionId": "<dsh sessionId>",
      "approvalId": "<approvalId>",
      "outcome": "allowed-once"
    }
  }
}
```

`outcome` 只允许 `"allowed-once"` 或 `"rejected"`。客户端不得发送 `cancelled` / `unavailable`。

**提问（整组一次，不得拆条）**

```json
{
  "type": "client-response",
  "rpcId": "<echo question/requested rpcId>",
  "result": {
    "ok": true,
    "value": {
      "sessionId": "<dsh sessionId>",
      "answer": {
        "answers": [
          { "id": "<question.id>", "selected": ["<option.label>"] }
        ]
      }
    }
  }
}
```

校验（发请求前本地做，失败只提示不提交）：

- `answers.length === questions.length`，且按相同顺序、`id` 一一对应。
- `selected` 无重复；每个 label 必须来自该题 `options`。
- 单选：`selected.length <= 1`；若填写 `custom`（非空 trim），则 `selected` 必须为空。
- 多选：`custom` 可与 `selected` 同时存在。
- `custom` 若出现，trim 后不得为空字符串。

**用户停止本轮（已有 Abort → `session.cancel`）**

若当时有未回答提问，额外对提问 `rpcId` 发一次：

```json
{
  "type": "client-response",
  "rpcId": "<question rpcId>",
  "result": { "ok": false, "error": { "code": "cancelled" } }
}
```

批准等待中停止：只 `session.cancel`，不发批准 `respond`（主机侧会把批准收成 cancelled）。

HTTP 成功体为 receipt：`{ accepted: true }` 或 `{ accepted: false, reason: 'not-pending' | 'bad-response' }`。

## 类型与状态

### `StreamEvent` 扩展

`hitl-resolved` 用于在 Harness 网页先处理时清卡：

- 批准：Mux `approval/resolved.approvalId` 与 `pendingHitl.approvalId` 相同则清卡。
- 提问：Mux `question/resolved.questionRpcId` 与 `pendingHitl.rpcId` 相同则清卡。

```ts
| { type: 'approval'; rpcId: string; sessionId: string; approvalId: string; toolName: string; callId?: string; reason?: string }
| { type: 'question'; rpcId: string; sessionId: string; questions: AskUserQuestionItem[] }
| { type: 'hitl-resolved'; kind: 'approval'; approvalId: string }
| { type: 'hitl-resolved'; kind: 'question'; rpcId: string }
```

`error` 不再用于 HITL。

### chat store

新增瞬时字段（`partialize` 排除，与 `assistantStatus` 一样不持久化）：

```ts
type AssistantStatus = 'idle' | 'streaming' | 'awaiting-hitl' | 'error';

type PendingHitl =
  | { kind: 'approval'; rpcId: string; sessionId: string; approvalId: string; toolName: string; callId?: string; reason?: string; error?: string }
  | { kind: 'question'; rpcId: string; sessionId: string; questions: AskUserQuestionItem[]; error?: string };

pendingHitlBySession: Record<string, PendingHitl | null>
```

- 收到 `approval` / `question`：写入 `pendingHitlBySession[sessionId]`（覆盖旧卡），`assistantStatus = 'awaiting-hitl'`。
- `respond` 成功或收到匹配的 `hitl-resolved`：该 session 的 pending 置 `null`，`assistantStatus = 'streaming'`（本轮仍未 `turn/end`）。
- `finishMessage` / `markMessageError` / `session.cancel`：pending 置 `null`。
- `sendMessage`：若 status 为 `streaming` **或** `awaiting-hitl`，返回 `null`（禁止并行新消息）。

## UI

- 新组件 `apps/design-agent/src/chat/HitlDock.tsx`，由 `ChatInput` 放在输入卡片上方。
- 有 `pendingHitl` 时：禁用 textarea、发送、上传；展示对应卡。
- 批准卡：标题「需要批准」、`toolName`、可选 `reason`；按钮「允许一次」「拒绝」。无「始终允许」。
- 提问卡：按 `questions` 顺序渲染 `header` / `question` / `detail` / options；多选为多选控件；无 options 或需要「其他」时提供可选文本框。一个「提交」按钮提交整组。
- 处理后卡片立即卸下，不往 `messagesBySession` 插入回执。
- 等待 HITL 时 assistant 占位消息保持 `streaming: true`，光标文案为「等待你确认…」（不是历史回执）。
- 流式或 `awaiting-hitl` 时，发送按钮改为「停止」，触发现有 abort / `session.cancel`。

## 数据流

```
session.prompt
  → mux: assistant/chunk → delta → 同一 assistant 消息
  → mux: approval/requested → pendingHitl + awaiting-hitl + HitlDock
  → 用户点击 → POST /api/respond
  → mux: 继续 chunk 或下一次 HITL 或 turn/end
  → turn/end → finishMessage，输入恢复
```

`useChatStream` 返回 `{ send, stop, respondHitl }`：

- `for await` 遇到 `approval` / `question` **不 return**，写入 store。
- `respondHitl` 调客户端单例的 `respond`；成功则清 pending 并回到 `streaming`。
- `stop`：abort → `session.cancel`；若 pending 为 question 再发 `cancelled` respond；清 pending。

`HitlDock` 只通过 `ChatInput` 拿到 `respondHitl` / `stop`，不直接 import 客户端。客户端单例仍在 `useChatStream.ts`。

## 出错处理

| 情况 | 行为 |
| --- | --- |
| `respond` 网络失败或 HTTP 非 2xx | 卡片保留，`pendingHitl.error` 提示，可重试 |
| receipt `accepted: false` 且 `not-pending` | 清卡，继续听 Mux；由后续 `delta` / `turn/end` / `stream/error` 决定本轮命运，不另设超时 |
| receipt `bad-response` | 卡片保留，提示答案不合法，可改后重试 |
| 本地校验失败 | 只在卡片提示，不发请求 |
| `stream/error` | 清卡，`markMessageError`，结束本轮 |
| 刷新 | pending 丢失；Mux 重放则再出现；否则用户重发 |
| 同时两张 | 只保留最新 `rpcId` |
| 双端处理 | 先到的 `respond` 生效；后到的 `not-pending` 清卡 |

## 测试

自动化（纯函数 / 客户端逻辑，不启动真实 dsh）：

1. `approval/requested` 映射为 `StreamEvent.approval`，generator 不结束。
2. 批准 `respond` 体为 `allowed-once` / `rejected` 且 echo `rpcId`。
3. 提问 `respond` 体为整组 `answers`，顺序与 id 对齐。
4. yield HITL 之后再 yield `delta` 再 `done`（模拟 Mux 后续帧）。
5. `awaiting-hitl` 时 `sendMessage` 返回 `null`。

手动：

1. 触发一次工具批准：输入禁用，允许后同一条消息继续出字。
2. 触发一次提问：提交后继续出字。
3. 等待时点停止：卡片消失，本轮结束。
4. 拒绝批准：模型收到拒绝后继续或结束，前端不崩溃。

## 主要改动文件

- `apps/design-agent/src/sse/types.ts` — 事件类型
- `apps/design-agent/src/sse/DeepSeekHarnessChatStreamClient.ts` — 不再把 HITL 当错误；实现 `respond`
- `apps/design-agent/src/stores/chatStore.ts` — `pendingHitl` / `awaiting-hitl`
- `apps/design-agent/src/chat/useChatStream.ts` — 转发 HITL、暴露 respond/stop
- `apps/design-agent/src/chat/HitlDock.tsx` — 新建
- `apps/design-agent/src/chat/ChatInput.tsx` — 挂载 Dock、等待时禁用输入
- `apps/design-agent/src/sse/hitl.test.ts` — 协议与 store 行为（为 `apps/design-agent` 增加 Vitest，与 `packages/cad-core` 一样由 `pnpm test` 跑）
- `MockChatStreamClient` 不发 HITL 事件；`ChatStreamClient` 增加可选 `respond()` 时 Mock 实现为空操作

`ChatStreamClient` 扩展为：

```ts
type HitlRespondPayload =
  | {
      kind: 'approval';
      rpcId: string;
      sessionId: string;
      approvalId: string;
      outcome: 'allowed-once' | 'rejected';
    }
  | {
      kind: 'question';
      rpcId: string;
      sessionId: string;
      answer: { answers: Array<{ id: string; selected: string[]; custom?: string }> };
    }
  | { kind: 'question-cancel'; rpcId: string };

interface ChatStreamClient {
  stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamEvent>;
  respond?(payload: HitlRespondPayload): Promise<{ accepted: boolean; reason?: string }>;
}
```

Harness 客户端必须实现 `respond`。Hook 在 HITL 时若 `respond` 不存在则提示「当前客户端不支持人工处理」。
