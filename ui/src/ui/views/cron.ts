import { html, nothing } from "lit";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { pathForTab } from "../navigation.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type { CronFormState } from "../ui-types.ts";

export type CronProps = {
  basePath: string;
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  customScheduleOpen: boolean;
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
  onCustomScheduleOpen: () => void;
  onCustomScheduleClose: () => void;
};

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") {
    return "last";
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}

export function renderCron(props: CronProps) {
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const selectedRunTitle = selectedJob?.name ?? props.runsJobId ?? "(select a job)";
  const orderedRuns = props.runs.toSorted((a, b) => b.ts - a.ts);
  const supportsAnnounce =
    props.form.sessionTarget === "isolated" && props.form.payloadKind === "agentTurn";
  const selectedDeliveryMode =
    props.form.deliveryMode === "announce" && !supportsAnnounce ? "none" : props.form.deliveryMode;

  const presets = [
    {
      label: "Hourly check-in",
      name: "hourly-check",
      schedule: "every" as const,
      amount: "1",
      unit: "hours" as const,
      message: "Quick status update — what's new?",
    },
    {
      label: "Daily summary",
      name: "daily-summary",
      schedule: "every" as const,
      amount: "1",
      unit: "days" as const,
      message: "Give me a daily summary of what happened.",
    },
    {
      label: "Every 30 min",
      name: "30-min-pulse",
      schedule: "every" as const,
      amount: "30",
      unit: "minutes" as const,
      message: "",
    },
    {
      label: "Custom",
      name: "",
      schedule: "custom" as const,
      amount: "",
      unit: "minutes" as const,
      message: "",
    },
  ];

  const isCustomMode = !presets.slice(0, 3).some((p) => p.name && p.name === props.form.name);

  const applyPreset = (preset: (typeof presets)[0]) => {
    if (preset.schedule === "custom") {
      props.onFormChange({
        name: "",
        description: "",
        scheduleKind: "cron",
        cronExpr: props.form.cronExpr || "0 9 * * *",
        cronTz: "",
        payloadKind: "agentTurn",
        payloadText: "",
        enabled: true,
      });
      props.onCustomScheduleOpen();
      return;
    }
    props.onFormChange({
      name: preset.name,
      scheduleKind: "every",
      everyAmount: preset.amount,
      everyUnit: preset.unit,
      payloadKind: "agentTurn",
      payloadText: preset.message,
      sessionTarget: "isolated",
      deliveryMode: supportsAnnounce ? "announce" : "none",
      enabled: true,
    });
  };

  const schedulePreview = describeSchedule(props.form);

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Scheduler</div>
        <div class="card-sub">Gateway-owned cron scheduler status.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${props.status ? (props.status.enabled ? "Yes" : "No") : "n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${props.status?.jobs ?? "n/a"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Next wake</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Refreshing…" : "Refresh"}
          </button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">New Job</div>
        <div class="card-sub">Schedule the assistant to run automatically.</div>

        <!-- Quick presets -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 16px;">
          ${presets.map((preset) => {
            const active =
              preset.schedule === "custom"
                ? isCustomMode
                : props.form.name === preset.name && !!preset.name;
            return html`
                <button
                  class="btn ${active ? "primary" : ""}"
                  style="padding: 8px 6px; font-size: 12px; height: auto;"
                  @click=${() => applyPreset(preset)}
                >
                  ${preset.label}
                </button>
              `;
          })}
        </div>

        <!-- Step 1: What -->
        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
            1. What should it do?
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Job name</span>
              <input
                .value=${props.form.name}
                @input=${(e: Event) =>
                  props.onFormChange({ name: (e.target as HTMLInputElement).value })}
                placeholder="e.g. daily-summary"
              />
            </label>
            <label class="field">
              <span>Type</span>
              <select
                .value=${props.form.payloadKind}
                @change=${(e: Event) =>
                  props.onFormChange({
                    payloadKind: (e.target as HTMLSelectElement)
                      .value as CronFormState["payloadKind"],
                  })}
              >
                <option value="agentTurn">Ask the assistant (prompt)</option>
                <option value="systemEvent">System event (internal)</option>
              </select>
            </label>
          </div>
          <label class="field" style="margin-top: 8px;">
            <span>${props.form.payloadKind === "agentTurn" ? "What to ask" : "System text"}</span>
            <textarea
              .value=${props.form.payloadText}
              @input=${(e: Event) =>
                props.onFormChange({
                  payloadText: (e.target as HTMLTextAreaElement).value,
                })}
              rows="3"
              placeholder=${
                props.form.payloadKind === "agentTurn"
                  ? "e.g. Summarize today's news about AI"
                  : "e.g. scheduled-maintenance"
              }
            ></textarea>
          </label>
        </div>

        <!-- Step 2: When -->
        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
            2. When should it run?
          </div>

          ${
            isCustomMode
              ? html`
                <div style="display: flex; align-items: center; gap: 8px;">
                  ${
                    schedulePreview
                      ? html`<span style="font-size: 13px; color: var(--text);">${schedulePreview}</span>`
                      : html`
                          <span class="muted" style="font-size: 13px">No schedule set yet</span>
                        `
                  }
                  <button class="btn" style="font-size: 12px; padding: 5px 12px; margin-left: auto;"
                    @click=${() => props.onCustomScheduleOpen()}
                  >Edit schedule</button>
                </div>
              `
              : html`
                <div class="form-grid">
                  <label class="field">
                    <span>Schedule type</span>
                    <select
                      .value=${props.form.scheduleKind}
                      @change=${(e: Event) =>
                        props.onFormChange({
                          scheduleKind: (e.target as HTMLSelectElement)
                            .value as CronFormState["scheduleKind"],
                        })}
                    >
                      <option value="every">Repeating interval</option>
                      <option value="at">One-time (specific date/time)</option>
                      <option value="cron">Advanced (cron expression)</option>
                    </select>
                  </label>
                </div>
                ${renderScheduleFields(props)}
              `
          }

          ${
            !isCustomMode && schedulePreview
              ? html`
                <div style="
                  margin-top: 10px;
                  padding: 8px 12px;
                  background: var(--accent-subtle);
                  border-radius: var(--radius-md);
                  font-size: 12px;
                  color: var(--accent);
                ">
                  ${schedulePreview}
                </div>
              `
              : nothing
          }
        </div>

        <!-- Step 3: Where (delivery) — only for agent turns -->
        ${
          props.form.payloadKind === "agentTurn"
            ? html`
              <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px;">
                  3. Where to deliver the result?
                </div>
                <div class="form-grid">
                  <label class="field">
                    <span>Delivery</span>
                    <select
                      .value=${selectedDeliveryMode}
                      @change=${(e: Event) =>
                        props.onFormChange({
                          deliveryMode: (e.target as HTMLSelectElement)
                            .value as CronFormState["deliveryMode"],
                        })}
                    >
                      ${
                        supportsAnnounce
                          ? html`
                              <option value="announce">Send summary to a channel</option>
                            `
                          : nothing
                      }
                      <option value="webhook">POST to a webhook URL</option>
                      <option value="none">Keep internal (no delivery)</option>
                    </select>
                  </label>
                  ${
                    selectedDeliveryMode !== "none"
                      ? html`
                        <label class="field">
                          <span>${selectedDeliveryMode === "webhook" ? "Webhook URL" : "Channel"}</span>
                          ${
                            selectedDeliveryMode === "webhook"
                              ? html`
                                <input
                                  .value=${props.form.deliveryTo}
                                  @input=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryTo: (e.target as HTMLInputElement).value,
                                    })}
                                  placeholder="https://example.com/webhook"
                                />
                              `
                              : html`
                                <select
                                  .value=${props.form.deliveryChannel || "last"}
                                  @change=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryChannel: (e.target as HTMLSelectElement).value,
                                    })}
                                >
                                  ${channelOptions.map(
                                    (channel) =>
                                      html`<option value=${channel}>
                                        ${resolveChannelLabel(props, channel)}
                                      </option>`,
                                  )}
                                </select>
                              `
                          }
                        </label>
                        ${
                          selectedDeliveryMode === "announce"
                            ? html`
                              <label class="field">
                                <span>Send to (phone/chat ID)</span>
                                <input
                                  .value=${props.form.deliveryTo}
                                  @input=${(e: Event) =>
                                    props.onFormChange({
                                      deliveryTo: (e.target as HTMLInputElement).value,
                                    })}
                                  placeholder="+1555… or chat id"
                                />
                              </label>
                            `
                            : nothing
                        }
                      `
                      : nothing
                  }
                </div>
              </div>
            `
            : nothing
        }

        <!-- Advanced (collapsed by default) -->
        <details style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px;">
          <summary style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); cursor: pointer; user-select: none;">
            Advanced options
          </summary>
          <div class="form-grid" style="margin-top: 10px;">
            <label class="field">
              <span>Description</span>
              <input
                .value=${props.form.description}
                @input=${(e: Event) =>
                  props.onFormChange({ description: (e.target as HTMLInputElement).value })}
                placeholder="Optional note about this job"
              />
            </label>
            <label class="field">
              <span>Agent ID</span>
              <input
                .value=${props.form.agentId}
                @input=${(e: Event) =>
                  props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
                placeholder="default"
              />
            </label>
            <label class="field">
              <span>Session handling</span>
              <select
                .value=${props.form.sessionTarget}
                @change=${(e: Event) =>
                  props.onFormChange({
                    sessionTarget: (e.target as HTMLSelectElement)
                      .value as CronFormState["sessionTarget"],
                  })}
              >
                <option value="isolated">New session each run (isolated)</option>
                <option value="main">Use main session (shared context)</option>
              </select>
            </label>
            <label class="field">
              <span>Timing</span>
              <select
                .value=${props.form.wakeMode}
                @change=${(e: Event) =>
                  props.onFormChange({
                    wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                  })}
              >
                <option value="now">Run immediately when scheduled</option>
                <option value="next-heartbeat">Wait for next heartbeat</option>
              </select>
            </label>
            ${
              props.form.payloadKind === "agentTurn"
                ? html`
                  <label class="field">
                    <span>Timeout (seconds)</span>
                    <input
                      .value=${props.form.timeoutSeconds}
                      @input=${(e: Event) =>
                        props.onFormChange({
                          timeoutSeconds: (e.target as HTMLInputElement).value,
                        })}
                      placeholder="300"
                    />
                  </label>
                `
                : nothing
            }
            <label class="field checkbox">
              <span>Start enabled</span>
              <input
                type="checkbox"
                .checked=${props.form.enabled}
                @change=${(e: Event) =>
                  props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
              />
            </label>
          </div>
        </details>

        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${props.busy || !props.form.name.trim()} @click=${props.onAdd}>
            ${props.busy ? "Saving…" : "Add job"}
          </button>
          <span class="muted" style="font-size: 12px;">
            ${!props.form.name.trim() ? "Give it a name to continue" : ""}
          </span>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Jobs</div>
      <div class="card-sub">All scheduled jobs stored in the gateway.</div>
      ${
        props.jobs.length === 0
          ? html`
              <div class="muted" style="margin-top: 12px">No jobs yet.</div>
            `
          : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props))}
            </div>
          `
      }
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Run history</div>
      <div class="card-sub">Latest runs for ${selectedRunTitle}.</div>
      ${
        props.runsJobId == null
          ? html`
              <div class="muted" style="margin-top: 12px">Select a job to inspect run history.</div>
            `
          : orderedRuns.length === 0
            ? html`
                <div class="muted" style="margin-top: 12px">No runs yet.</div>
              `
            : html`
              <div class="list" style="margin-top: 12px;">
                ${orderedRuns.map((entry) => renderRun(entry, props.basePath))}
              </div>
            `
      }
    </section>

    ${props.customScheduleOpen ? renderScheduleModal(props) : nothing}
  `;
}

function renderScheduleModal(props: CronProps) {
  const form = props.form;
  const preview = describeSchedule(form);

  return html`
    <div
      class="exec-approval-overlay"
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) {
          props.onCustomScheduleClose();
        }
      }}
    >
      <div style="
        width: min(520px, 95vw);
        max-height: 90vh;
        overflow-y: auto;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 24px;
        animation: scale-in 0.2s var(--ease-out);
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--text-strong);">Schedule builder</div>
            <div class="muted" style="font-size: 12px; margin-top: 2px;">Pick when this job should run.</div>
          </div>
          <button class="btn" style="padding: 4px 10px; font-size: 18px; line-height: 1;"
            @click=${() => props.onCustomScheduleClose()}
          >&times;</button>
        </div>

        ${renderCustomScheduleBuilder(props)}

        ${
          preview
            ? html`
              <div style="
                margin-top: 14px;
                padding: 10px 14px;
                background: var(--accent-subtle);
                border-radius: var(--radius-md);
                font-size: 13px;
                font-weight: 500;
                color: var(--accent);
                text-align: center;
              ">
                ${preview}
              </div>
            `
            : nothing
        }

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border);">
          <button class="btn" @click=${() => props.onCustomScheduleClose()}>Cancel</button>
          <button class="btn primary" @click=${() => props.onCustomScheduleClose()}>
            Done
          </button>
        </div>
      </div>
    </div>
  `;
}

const DAYS_OF_WEEK = [
  { short: "Sun", value: "0" },
  { short: "Mon", value: "1" },
  { short: "Tue", value: "2" },
  { short: "Wed", value: "3" },
  { short: "Thu", value: "4" },
  { short: "Fri", value: "5" },
  { short: "Sat", value: "6" },
];

const QUICK_TIMES = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];

function parseCronDays(expr: string): Set<string> {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts[4] === "*") {
    return new Set();
  }
  return new Set(parts[4].split(","));
}

function parseCronHourMinute(expr: string): { hour: string; minute: string } {
  const parts = expr.trim().split(/\s+/);
  return {
    minute: parts[0] ?? "0",
    hour: parts[1] ?? "9",
  };
}

function buildCronFromDaysAndTime(selectedDays: Set<string>, hour: string, minute: string): string {
  const dow =
    selectedDays.size === 0 || selectedDays.size === 7
      ? "*"
      : [...selectedDays].toSorted().join(",");
  return `${minute} ${hour} * * ${dow}`;
}

function renderCustomScheduleBuilder(props: CronProps) {
  const form = props.form;

  const isAtMode = form.scheduleKind === "at";
  const isEveryMode = form.scheduleKind === "every";
  const isCronMode = form.scheduleKind === "cron";

  const selectedDays = isCronMode ? parseCronDays(form.cronExpr || "0 9 * * *") : new Set<string>();
  const { hour, minute } = isCronMode
    ? parseCronHourMinute(form.cronExpr || "0 9 * * *")
    : { hour: "9", minute: "0" };

  const toggleDay = (dayValue: string) => {
    const next = new Set(selectedDays);
    if (next.has(dayValue)) {
      next.delete(dayValue);
    } else {
      next.add(dayValue);
    }
    props.onFormChange({
      scheduleKind: "cron",
      cronExpr: buildCronFromDaysAndTime(next, hour, minute),
    });
  };

  const setTime = (h: string, m: string) => {
    props.onFormChange({
      scheduleKind: "cron",
      cronExpr: buildCronFromDaysAndTime(selectedDays, h, m),
    });
  };

  return html`
    <!-- Mode tabs -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;">
      <button
        class="btn ${isEveryMode ? "primary" : ""}"
        style="font-size: 12px; padding: 6px;"
        @click=${() => props.onFormChange({ scheduleKind: "every", everyAmount: "1", everyUnit: "hours" })}
      >Interval</button>
      <button
        class="btn ${isCronMode ? "primary" : ""}"
        style="font-size: 12px; padding: 6px;"
        @click=${() => props.onFormChange({ scheduleKind: "cron", cronExpr: form.cronExpr || "0 9 * * *" })}
      >Days + Time</button>
      <button
        class="btn ${isAtMode ? "primary" : ""}"
        style="font-size: 12px; padding: 6px;"
        @click=${() => props.onFormChange({ scheduleKind: "at" })}
      >One-time</button>
    </div>

    ${isEveryMode ? renderScheduleFields(props) : nothing}
    ${isAtMode ? renderScheduleFields(props) : nothing}

    ${
      isCronMode
        ? html`
      <!-- Day picker -->
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 6px;">Pick days (leave empty for every day)</div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
          ${DAYS_OF_WEEK.map(
            (day) => html`
              <button
                class="btn ${selectedDays.has(day.value) ? "primary" : ""}"
                style="padding: 8px 0; font-size: 12px; font-weight: 600;"
                @click=${() => toggleDay(day.value)}
              >
                ${day.short}
              </button>
            `,
          )}
        </div>
        <div style="display: flex; gap: 4px; margin-top: 6px;">
          <button class="btn" style="font-size: 11px; padding: 3px 8px;"
            @click=${() => props.onFormChange({ scheduleKind: "cron", cronExpr: buildCronFromDaysAndTime(new Set(["1", "2", "3", "4", "5"]), hour, minute) })}
          >Weekdays</button>
          <button class="btn" style="font-size: 11px; padding: 3px 8px;"
            @click=${() => props.onFormChange({ scheduleKind: "cron", cronExpr: buildCronFromDaysAndTime(new Set(["0", "6"]), hour, minute) })}
          >Weekends</button>
          <button class="btn" style="font-size: 11px; padding: 3px 8px;"
            @click=${() => props.onFormChange({ scheduleKind: "cron", cronExpr: buildCronFromDaysAndTime(new Set(), hour, minute) })}
          >Every day</button>
        </div>
      </div>

      <!-- Time picker -->
      <div>
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 6px;">Pick time</div>
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-bottom: 8px;">
          ${QUICK_TIMES.map((t) => {
            const [h, m] = t.split(":");
            const active = hour === h && minute === m;
            const label =
              parseInt(h, 10) >= 12
                ? `${parseInt(h, 10) === 12 ? 12 : parseInt(h, 10) - 12}${m === "00" ? "" : `:${m}`}pm`
                : `${parseInt(h, 10) === 0 ? 12 : h}${m === "00" ? "" : `:${m}`}am`;
            return html`
                <button
                  class="btn ${active ? "primary" : ""}"
                  style="font-size: 11px; padding: 6px 0;"
                  @click=${() => setTime(h, m)}
                >
                  ${label}
                </button>
              `;
          })}
        </div>
        <div class="form-grid">
          <label class="field">
            <span>Hour (0-23)</span>
            <input
              type="number" min="0" max="23"
              .value=${hour}
              @input=${(e: Event) => setTime((e.target as HTMLInputElement).value, minute)}
            />
          </label>
          <label class="field">
            <span>Minute (0-59)</span>
            <input
              type="number" min="0" max="59"
              .value=${minute}
              @input=${(e: Event) => setTime(hour, (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      </div>

      <!-- Raw expression (editable) -->
      <label class="field" style="margin-top: 10px;">
        <span>Cron expression (editable)</span>
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) => props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
          style="font-family: var(--mono); font-size: 13px;"
        />
      </label>
      <label class="field" style="margin-top: 4px;">
        <span>Timezone</span>
        <input
          .value=${form.cronTz}
          @input=${(e: Event) => props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
          placeholder="America/New_York (optional)"
        />
      </label>
    `
        : nothing
    }
  `;
}

function describeSchedule(form: CronFormState): string | null {
  if (form.scheduleKind === "every") {
    const n = parseInt(form.everyAmount, 10);
    if (!n || n <= 0) {
      return null;
    }
    const unit =
      form.everyUnit === "minutes" ? "minute" : form.everyUnit === "hours" ? "hour" : "day";
    return n === 1 ? `Runs every ${unit}` : `Runs every ${n} ${unit}s`;
  }
  if (form.scheduleKind === "at") {
    if (!form.scheduleAt) {
      return null;
    }
    try {
      const d = new Date(form.scheduleAt);
      return `Runs once on ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return null;
    }
  }
  if (form.scheduleKind === "cron" && form.cronExpr.trim()) {
    return `Cron: ${form.cronExpr.trim()}${form.cronTz ? ` (${form.cronTz})` : ""}`;
  }
  return null;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field" style="margin-top: 8px;">
        <span>Date and time</span>
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid" style="margin-top: 8px;">
        <label class="field">
          <span>Run every</span>
          <input
            type="number"
            min="1"
            .value=${form.everyAmount}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
            placeholder="1"
          />
        </label>
        <label class="field">
          <span>Unit</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 8px;">
      <label class="field">
        <span>Cron expression</span>
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
          placeholder="0 9 * * 1-5  (weekdays at 9am)"
        />
      </label>
      <label class="field">
        <span>Timezone</span>
        <input
          .value=${form.cronTz}
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
          placeholder="America/New_York (optional)"
        />
      </label>
    </div>
  `;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable cron-job${isSelected ? " list-item-selected" : ""}`;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        ${renderJobPayload(job)}
        ${job.agentId ? html`<div class="muted cron-job-agent">Agent: ${job.agentId}</div>` : nothing}
      </div>
      <div class="list-meta">
        ${renderJobState(job)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? "enabled" : "disabled"}
          </span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? "Disable" : "Enable"}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            Run
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            History
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">System</span>
      <span class="muted cron-job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  const delivery = job.delivery;
  const deliveryTarget =
    delivery?.mode === "webhook"
      ? delivery.to
        ? ` (${delivery.to})`
        : ""
      : delivery?.channel || delivery?.to
        ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">Prompt</span>
      <span class="muted cron-job-detail-value">${job.payload.message}</span>
    </div>
    ${
      delivery
        ? html`<div class="cron-job-detail">
            <span class="cron-job-detail-label">Delivery</span>
            <span class="muted cron-job-detail-value">${delivery.mode}${deliveryTarget}</span>
          </div>`
        : nothing
    }
  `;
}

function formatStateRelative(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "n/a";
  }
  return formatRelativeTimestamp(ms);
}

function renderJobState(job: CronJob) {
  const status = job.state?.lastStatus ?? "n/a";
  const statusClass =
    status === "ok"
      ? "cron-job-status-ok"
      : status === "error"
        ? "cron-job-status-error"
        : status === "skipped"
          ? "cron-job-status-skipped"
          : "cron-job-status-na";
  const nextRunAtMs = job.state?.nextRunAtMs;
  const lastRunAtMs = job.state?.lastRunAtMs;

  return html`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Status</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${status}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Next</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Last</span>
        <span class="cron-job-state-value" title=${formatMs(lastRunAtMs)}>
          ${formatStateRelative(lastRunAtMs)}
        </span>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry, basePath: string) {
  const chatUrl =
    typeof entry.sessionKey === "string" && entry.sessionKey.trim().length > 0
      ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(entry.sessionKey)}`
      : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ""}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${
          chatUrl
            ? html`<div><a class="session-link" href=${chatUrl}>Open run chat</a></div>`
            : nothing
        }
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
