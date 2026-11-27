/** AI Core: coordinates conversation, context, prompt, provider and response processing. No provider performs real inference in this stage. */
import { ConversationManager } from "./conversation-manager.js";
import { buildContext } from "./context-builder.js";
import { PromptManager } from "./prompt-manager.js";
import { ProviderManager } from "./provider-manager.js";
import { AISettings } from "./ai-settings.js";
import { processResponse } from "./response-processor.js";
import { MockProvider } from "./providers/mock-provider.js";

export class AICore {
  constructor({ conversations = new ConversationManager(), prompts = new PromptManager(), providers = new ProviderManager(), settings = new AISettings() } = {}) {
    Object.assign(this, { conversations, prompts, providers, settings });
  }
  static withMock() { const c = new AICore(); c.providers.register(new MockProvider()); return c; }

  /** Context preview: exactly what would be sent, plus the include/exclude report. Does not call any provider. */
  previewContext({ dataset, analysis, objective }) { return buildContext({ dataset, analysis, objective, settings: this.settings.value }); }

  async send(text, { dataset = null, analysis = null, signal } = {}) {
    const s = this.settings.value, provider = this.providers.active;
    if (!this.conversations.current) await this.conversations.start({ datasetId: dataset?.id ?? null });
    await this.conversations.add("user", text);
    const { context, report } = buildContext({ dataset, analysis, objective: text, settings: s });
    const system = this.prompts.render("system.scientific-assistant/v0", { language: s.language });
    const messages = [{ role: "system", content: system }, ...this.conversations.current.messages.map(m => ({ role: m.role, content: m.content }))];
    const raw = await provider.generate({ messages, context, settings: s, signal });
    const out = processResponse(raw, { expectedProvider: provider.id });
    await this.conversations.add("assistant", out.text, { provider: out.provider, model: out.model, isMock: out.isMock, contextChars: report.chars });
    return { response: out, contextReport: report };
  }
}
