import { html, nothing } from "lit";
import { t, i18n, type Locale } from "../../i18n/index.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "../gateway.ts";
import { formatNextRun } from "../presenter.ts";
import type { UiSettings } from "../storage.ts";

export type AiMode = "local" | "cloud" | "orchestrator";

export type OllamaSetupState = {
  status: "unknown" | "checking" | "not-configured" | "configured" | "saving" | "error";
  baseUrl: string;
  model: string;
  cloudModel: string;
  aiMode: AiMode;
  errorMessage: string | null;
  availableModels: string[];
};

export type OverviewProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  lastChannelsRefresh: number | null;
  client: GatewayBrowserClient | null;
  ollamaSetup: OllamaSetupState;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onConnect: () => void;
  onRefresh: () => void;
  onOllamaCheck: () => void;
  onOllamaBaseUrlChange: (url: string) => void;
  onOllamaModelChange: (model: string) => void;
  onOllamaCloudModelChange: (model: string) => void;
  onAiModeChange: (mode: AiMode) => void;
  onOllamaEnable: () => void;
};

export function renderOverview(props: OverviewProps) {
  const snapshot = props.hello?.snapshot as
    | {
        uptimeMs?: number;
        policy?: { tickIntervalMs?: number };
        authMode?: "none" | "token" | "password" | "trusted-proxy";
      }
    | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : t("common.na");
  const tick = snapshot?.policy?.tickIntervalMs
    ? `${snapshot.policy.tickIntervalMs}ms`
    : t("common.na");
  const authMode = snapshot?.authMode;
  const isTrustedProxy = authMode === "trusted-proxy";

  const authHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    const authFailed = lower.includes("unauthorized") || lower.includes("connect failed");
    if (!authFailed) {
      return null;
    }
    const hasToken = Boolean(props.settings.token.trim());
    const hasPassword = Boolean(props.password.trim());
    if (!hasToken && !hasPassword) {
      return html`
        <div class="muted" style="margin-top: 8px">
          ${t("overview.auth.required")}
          <div style="margin-top: 6px">
            <span class="mono">openclaw dashboard --no-open</span> → tokenized URL<br />
            <span class="mono">openclaw doctor --generate-gateway-token</span> → set token
          </div>
          <div style="margin-top: 6px">
            <a
              class="session-link"
              href="https://docs.openclaw.ai/web/dashboard"
              target="_blank"
              rel="noreferrer"
              title="Control UI auth docs (opens in new tab)"
              >Docs: Control UI auth</a
            >
          </div>
        </div>
      `;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.auth.failed", { command: "openclaw dashboard --no-open" })}
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/dashboard"
            target="_blank"
            rel="noreferrer"
            title="Control UI auth docs (opens in new tab)"
            >Docs: Control UI auth</a
          >
        </div>
      </div>
    `;
  })();

  const insecureContextHint = (() => {
    if (props.connected || !props.lastError) {
      return null;
    }
    const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
    if (isSecureContext) {
      return null;
    }
    const lower = props.lastError.toLowerCase();
    if (!lower.includes("secure context") && !lower.includes("device identity required")) {
      return null;
    }
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.insecure.hint", { url: "http://127.0.0.1:18789" })}
        <div style="margin-top: 6px">
          ${t("overview.insecure.stayHttp", { config: "gateway.controlUi.allowInsecureAuth: true" })}
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.openclaw.ai/gateway/tailscale"
            target="_blank"
            rel="noreferrer"
            title="Tailscale Serve docs (opens in new tab)"
            >Docs: Tailscale Serve</a
          >
          <span class="muted"> · </span>
          <a
            class="session-link"
            href="https://docs.openclaw.ai/web/control-ui#insecure-http"
            target="_blank"
            rel="noreferrer"
            title="Insecure HTTP docs (opens in new tab)"
            >Docs: Insecure HTTP</a
          >
        </div>
      </div>
    `;
  })();

  const currentLocale = i18n.getLocale();

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${t("overview.access.title")}</div>
        <div class="card-sub">${t("overview.access.subtitle")}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${t("overview.access.wsUrl")}</span>
            <input
              .value=${props.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSettingsChange({ ...props.settings, gatewayUrl: v });
              }}
              placeholder="ws://100.x.y.z:18789"
            />
          </label>
          ${
            isTrustedProxy
              ? ""
              : html`
                <label class="field">
                  <span>${t("overview.access.token")}</span>
                  <input
                    .value=${props.settings.token}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, token: v });
                    }}
                    placeholder="OPENCLAW_GATEWAY_TOKEN"
                  />
                </label>
                <label class="field">
                  <span>${t("overview.access.password")}</span>
                  <input
                    type="password"
                    .value=${props.password}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onPasswordChange(v);
                    }}
                    placeholder="system or shared password"
                  />
                </label>
              `
          }
          <label class="field">
            <span>${t("overview.access.sessionKey")}</span>
            <input
              .value=${props.settings.sessionKey}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                props.onSessionKeyChange(v);
              }}
            />
          </label>
          <label class="field">
            <span>${t("overview.access.language")}</span>
            <select
              .value=${currentLocale}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value as Locale;
                void i18n.setLocale(v);
                props.onSettingsChange({ ...props.settings, locale: v });
              }}
            >
              <option value="en">${t("languages.en")}</option>
              <option value="zh-CN">${t("languages.zhCN")}</option>
              <option value="zh-TW">${t("languages.zhTW")}</option>
              <option value="pt-BR">${t("languages.ptBR")}</option>
            </select>
          </label>
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${() => props.onConnect()}>${t("common.connect")}</button>
          <button class="btn" @click=${() => props.onRefresh()}>${t("common.refresh")}</button>
          <span class="muted">${
            isTrustedProxy ? t("overview.access.trustedProxy") : t("overview.access.connectHint")
          }</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${t("overview.snapshot.title")}</div>
        <div class="card-sub">${t("overview.snapshot.subtitle")}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.status")}</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? t("common.ok") : t("common.offline")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.uptime")}</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.tickInterval")}</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("overview.snapshot.lastChannelsRefresh")}</div>
            <div class="stat-value">
              ${props.lastChannelsRefresh ? formatRelativeTimestamp(props.lastChannelsRefresh) : t("common.na")}
            </div>
          </div>
        </div>
        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
              ${authHint ?? ""}
              ${insecureContextHint ?? ""}
            </div>`
            : html`
                <div class="callout" style="margin-top: 14px">
                  ${t("overview.snapshot.channelsHint")}
                </div>
              `
        }
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">${t("overview.stats.instances")}</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">${t("overview.stats.instancesHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.stats.sessions")}</div>
        <div class="stat-value">${props.sessionsCount ?? t("common.na")}</div>
        <div class="muted">${t("overview.stats.sessionsHint")}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">${t("overview.stats.cron")}</div>
        <div class="stat-value">
          ${props.cronEnabled == null ? t("common.na") : props.cronEnabled ? t("common.enabled") : t("common.disabled")}
        </div>
        <div class="muted">${t("overview.stats.cronNext", { time: formatNextRun(props.cronNext) })}</div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${t("overview.notes.title")}</div>
      <div class="card-sub">${t("overview.notes.subtitle")}</div>
      <div class="note-grid" style="margin-top: 14px;">
        <div>
          <div class="note-title">${t("overview.notes.tailscaleTitle")}</div>
          <div class="muted">
            ${t("overview.notes.tailscaleText")}
          </div>
        </div>
        <div>
          <div class="note-title">${t("overview.notes.sessionTitle")}</div>
          <div class="muted">${t("overview.notes.sessionText")}</div>
        </div>
        <div>
          <div class="note-title">${t("overview.notes.cronTitle")}</div>
          <div class="muted">${t("overview.notes.cronText")}</div>
        </div>
      </div>
    </section>

    ${props.connected ? renderOllamaCard(props) : nothing}
  `;
}

const MODE_INFO: Record<AiMode, { label: string; desc: string }> = {
  local: {
    label: "Purely Local",
    desc: "All inference stays on your machine via Ollama. Private, free, no cloud calls.",
  },
  cloud: {
    label: "Cloud (Default)",
    desc: "Uses your configured cloud provider (Anthropic, OpenAI, etc.) as the primary model.",
  },
  orchestrator: {
    label: "Orchestrator",
    desc: "Cloud primary with local fallback. Fast cloud answers, automatic failover to Ollama when cloud is down or rate-limited.",
  },
};

function renderOllamaCard(props: OverviewProps) {
  const s = props.ollamaSetup;

  const statusBadge = (() => {
    switch (s.status) {
      case "configured":
        return html`
          <span class="pill" style="background: var(--ok-subtle); color: var(--ok)">Connected</span>
        `;
      case "not-configured":
        return html`
          <span class="pill" style="background: var(--warn-subtle); color: var(--warn)">Not configured</span>
        `;
      case "checking":
      case "saving":
        return html`<span class="pill" style="background: var(--accent-subtle); color: var(--accent);">${s.status === "checking" ? "Checking..." : "Saving..."}</span>`;
      case "error":
        return html`
          <span class="pill" style="background: var(--danger-subtle); color: var(--danger)">Error</span>
        `;
      default:
        return html`
          <span class="pill" style="background: var(--bg-muted); color: var(--muted)">Unknown</span>
        `;
    }
  })();

  const isBusy = s.status === "checking" || s.status === "saving";
  const needsLocal = s.aiMode === "local" || s.aiMode === "orchestrator";
  const needsCloud = s.aiMode === "cloud" || s.aiMode === "orchestrator";

  return html`
    <section class="card" style="margin-top: 18px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="card-title" style="margin: 0;">AI Model Setup</div>
        ${statusBadge}
      </div>
      <div class="card-sub">Choose how your assistant picks models: fully local, cloud, or smart switching between both.</div>

      <!-- Mode selector -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px;">
        ${(["local", "cloud", "orchestrator"] as AiMode[]).map(
          (mode) => html`
            <button
              class="btn ${s.aiMode === mode ? "primary" : ""}"
              style="flex-direction: column; align-items: flex-start; padding: 12px; height: auto; text-align: left; gap: 4px;"
              @click=${() => props.onAiModeChange(mode)}
              ?disabled=${isBusy}
            >
              <strong style="font-size: 13px;">${MODE_INFO[mode].label}</strong>
              <span style="font-size: 11px; opacity: 0.7; line-height: 1.3;">${MODE_INFO[mode].desc}</span>
            </button>
          `,
        )}
      </div>

      <!-- Config fields -->
      <div class="form-grid" style="margin-top: 14px;">
        ${
          needsLocal
            ? html`
              <label class="field">
                <span>Ollama URL</span>
                <input
                  .value=${s.baseUrl}
                  @input=${(e: Event) => props.onOllamaBaseUrlChange((e.target as HTMLInputElement).value)}
                  placeholder="http://127.0.0.1:11434"
                  ?disabled=${isBusy}
                />
              </label>
              <label class="field">
                <span>Local Model</span>
                ${
                  s.availableModels.length > 0
                    ? html`
                      <select
                        .value=${s.model}
                        @change=${(e: Event) => props.onOllamaModelChange((e.target as HTMLSelectElement).value)}
                        ?disabled=${isBusy}
                      >
                        ${s.availableModels.map(
                          (m) => html`<option value=${m} ?selected=${m === s.model}>${m}</option>`,
                        )}
                      </select>
                    `
                    : html`
                      <input
                        .value=${s.model}
                        @input=${(e: Event) => props.onOllamaModelChange((e.target as HTMLInputElement).value)}
                        placeholder="llama3.3"
                        ?disabled=${isBusy}
                      />
                    `
                }
              </label>
            `
            : nothing
        }
        ${
          needsCloud
            ? html`
              <label class="field">
                <span>Cloud Model</span>
                <input
                  .value=${s.cloudModel}
                  @input=${(e: Event) => props.onOllamaCloudModelChange((e.target as HTMLInputElement).value)}
                  placeholder="anthropic/claude-sonnet-4-20250514"
                  ?disabled=${isBusy}
                />
              </label>
            `
            : nothing
        }
      </div>

      ${s.errorMessage ? html`<div class="callout danger" style="margin-top: 10px;">${s.errorMessage}</div>` : nothing}

      <div class="row" style="margin-top: 14px; gap: 8px;">
        ${
          needsLocal
            ? html`
              <button class="btn" @click=${() => props.onOllamaCheck()} ?disabled=${isBusy}>
                ${s.status === "checking" ? "Checking..." : "Check Ollama"}
              </button>
            `
            : nothing
        }
        <button
          class="btn primary"
          @click=${() => props.onOllamaEnable()}
          ?disabled=${isBusy || (needsLocal && !s.model.trim()) || (needsCloud && !s.cloudModel.trim())}
        >
          ${s.status === "saving" ? "Saving..." : "Apply"}
        </button>
        <a
          class="session-link"
          href="https://docs.openclaw.ai/providers/ollama"
          target="_blank"
          rel="noreferrer"
          style="margin-left: auto;"
        >Docs</a>
      </div>
    </section>
  `;
}
