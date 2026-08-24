import type { CadModel } from '@da/cad-core';
import type { ChatRequest, ChatStreamClient, StreamEvent } from './types';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildReply(model: CadModel | null): string {
  if (model) {
    return [
      `已加载模型 **${model.name}**。`,
      '',
      '模型概况：',
      '',
      `- 几何元素：**${model.elements.length}** 个`,
      `- 标注：**${model.annotations.length}** 个`,
      `- 零件分组：**${model.parts.length}** 个`,
      '',
      '该 JSON 已作为附件加入对话上下文。3D 模型请上传 GLB 后在右侧画布查看。',
      '',
      '> 当前为 Mock 流式输出，接入真实后端后在此返回真实的 AI 回复。',
    ].join('\n');
  }
  return [
    '你好！我是 **Design Agent**。',
    '',
    '请上传零件 JSON（作为对话上下文）或 GLB（在右侧画布查看）；也可以直接向我提问。',
    '',
    '支持的几何元素：`line` / `polyline` / `circle` / `arc` / `rect` / `text`，以及 `dimension` 尺寸标注。',
  ].join('\n');
}

/** 本地 Mock 流式客户端：按协议产出事件，模拟真实 SSE 的分块节奏 */
export class MockChatStreamClient implements ChatStreamClient {
  async *stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const messageId = `mock-${Date.now()}`;
    yield { type: 'start', messageId };

    const reply = buildReply(req.model);
    // 按「词 + 空白」切块，模拟逐词输出
    const chunks = reply.match(/\S+|\s+/g) ?? [reply];

    for (const chunk of chunks) {
      if (signal.aborted) return;
      yield { type: 'delta', text: chunk };
      await delay(15 + Math.random() * 40);
    }
    if (signal.aborted) return;
    yield { type: 'done' };
  }

  async respond(): Promise<{ accepted: boolean; reason?: string }> {
    return { accepted: true };
  }
}
