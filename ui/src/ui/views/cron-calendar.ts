import { html, nothing } from "lit";
import { formatCronSchedule } from "../presenter.ts";
import type { CronJob, CronRunLogEntry } from "../types.ts";

export type CronCalendarProps = {
  jobs: CronJob[];
  runs: CronRunLogEntry[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onRefresh: () => void;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function jobRunsOnDate(job: CronJob, date: string): boolean {
  if (!job.enabled) {
    return false;
  }
  const sched = job.schedule;
  const d = new Date(date + "T12:00:00");
  if (sched.kind === "at") {
    return dateKey(new Date(sched.at)) === date;
  }
  if (sched.kind === "every") {
    return true;
  }
  if (sched.kind === "cron") {
    const parts = sched.expr.trim().split(/\s+/);
    if (parts.length < 5) {
      return true;
    }
    const [, , dayOfMonth, month, dayOfWeek] = parts;
    if (month !== "*" && !month.split(",").includes(String(d.getMonth() + 1))) {
      return false;
    }
    if (dayOfMonth !== "*" && !dayOfMonth.split(",").includes(String(d.getDate()))) {
      return false;
    }
    if (dayOfWeek !== "*" && !dayOfWeek.split(",").includes(String(d.getDay()))) {
      return false;
    }
    return true;
  }
  return false;
}

function runsOnDate(runs: CronRunLogEntry[], date: string): CronRunLogEntry[] {
  return runs.filter((r) => dateKey(new Date(r.ts)) === date);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function renderCronCalendar(props: CronCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDow = new Date(year, month, 1).getDay();
  const todayKey = dateKey(now);

  const weeks: Array<Array<{ day: number | null; key: string | null }>> = [];
  let currentWeek: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < firstDow; i++) {
    currentWeek.push({ day: null, key: null });
  }
  for (let d = 1; d <= totalDays; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    currentWeek.push({ day: d, key });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ day: null, key: null });
    }
    weeks.push(currentWeek);
  }

  const selectedJobs = props.selectedDate
    ? props.jobs.filter((j) => jobRunsOnDate(j, props.selectedDate!))
    : [];
  const selectedRuns = props.selectedDate ? runsOnDate(props.runs, props.selectedDate) : [];
  const selectedDateObj = props.selectedDate ? new Date(props.selectedDate + "T12:00:00") : null;

  return html`
    <div style="display: grid; grid-template-columns: 1fr 300px; gap: 16px; min-height: 500px;">
      <!-- Calendar grid -->
      <div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div class="card-title" style="margin: 0;">${MONTH_NAMES[month]} ${year}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="muted" style="font-size: 12px;">Updated ${now.toLocaleTimeString()}</span>
            <button class="btn" style="padding: 4px 10px; font-size: 12px;" @click=${() => props.onRefresh()}>
              Refresh
            </button>
          </div>
        </div>

        <!-- Day headers -->
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border);">
          ${DAY_NAMES.map(
            (d) => html`
              <div style="padding: 8px 4px; text-align: center; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">
                ${d}
              </div>
            `,
          )}
        </div>

        <!-- Weeks -->
        ${weeks.map(
          (week) => html`
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--border-strong, var(--border));">
              ${week.map((cell) => {
                if (cell.day === null) {
                  return html`
                    <div style="min-height: 80px; border-right: 1px solid var(--border); background: var(--bg)"></div>
                  `;
                }
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === props.selectedDate;
                const jobsToday = props.jobs.filter((j) => jobRunsOnDate(j, cell.key!));
                const dayRuns = runsOnDate(props.runs, cell.key!);
                const hasError = dayRuns.some((r) => r.status === "error");

                return html`
                  <div
                    style="
                      min-height: 80px;
                      border-right: 1px solid var(--border);
                      padding: 4px 6px;
                      cursor: pointer;
                      background: ${isSelected ? "var(--accent-subtle)" : isToday ? "var(--bg-elevated)" : "var(--bg)"};
                      transition: background 0.15s ease;
                    "
                    @click=${() => props.onSelectDate(cell.key!)}
                  >
                    <div style="
                      font-size: 12px;
                      font-weight: ${isToday ? "700" : "500"};
                      color: ${isToday ? "var(--accent)" : "var(--text)"};
                      margin-bottom: 4px;
                    ">
                      ${cell.day}
                    </div>
                    ${jobsToday.slice(0, 3).map(
                      (job) => html`
                        <div style="
                          font-size: 10px;
                          padding: 2px 4px;
                          margin-bottom: 2px;
                          border-radius: var(--radius-sm);
                          background: ${hasError ? "var(--danger-subtle)" : "var(--accent-subtle)"};
                          color: ${hasError ? "var(--danger)" : "var(--accent)"};
                          white-space: nowrap;
                          overflow: hidden;
                          text-overflow: ellipsis;
                        ">
                          ${job.name}
                        </div>
                      `,
                    )}
                    ${
                      jobsToday.length > 3
                        ? html`<div style="font-size: 10px; color: var(--muted);">+${jobsToday.length - 3} more</div>`
                        : nothing
                    }
                  </div>
                `;
              })}
            </div>
          `,
        )}
      </div>

      <!-- Sidebar: selected day detail -->
      <div style="border-left: 1px solid var(--border); padding-left: 16px;">
        ${
          props.selectedDate && selectedDateObj
            ? html`
              <div style="margin-bottom: 16px;">
                <div class="muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">Selected Day</div>
                <div style="font-size: 18px; font-weight: 600; color: var(--text-strong); margin-top: 4px;">
                  ${DAY_NAMES[selectedDateObj.getDay()]}, ${MONTH_NAMES[selectedDateObj.getMonth()]} ${selectedDateObj.getDate()}
                </div>
              </div>

              ${
                selectedJobs.length > 0
                  ? selectedJobs.map(
                      (job) => html`
                      <div class="card" style="margin-bottom: 10px; padding: 12px;">
                        <div style="font-weight: 600; color: var(--accent); font-size: 13px; margin-bottom: 4px;">
                          ${job.name}
                        </div>
                        ${
                          job.description
                            ? html`<div class="muted" style="font-size: 12px; margin-bottom: 6px;">${job.description}</div>`
                            : nothing
                        }
                        <div class="mono" style="font-size: 11px; color: var(--muted);">
                          ${formatCronSchedule(job.schedule)}
                        </div>
                        <div style="margin-top: 6px; font-size: 11px;">
                          <span class="pill" style="
                            background: ${job.enabled ? "var(--ok-subtle)" : "var(--bg-muted)"};
                            color: ${job.enabled ? "var(--ok)" : "var(--muted)"};
                          ">${job.enabled ? "Enabled" : "Disabled"}</span>
                        </div>
                      </div>
                    `,
                    )
                  : html`
                      <div class="muted" style="font-size: 13px">No jobs scheduled for this day.</div>
                    `
              }

              ${
                selectedRuns.length > 0
                  ? html`
                    <div style="margin-top: 16px;">
                      <div class="muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                        Completed
                      </div>
                      ${selectedRuns.map(
                        (run) => html`
                          <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 6px 0;
                            border-bottom: 1px solid var(--border);
                            font-size: 12px;
                          ">
                            <span class="pill" style="
                              background: ${run.status === "ok" ? "var(--ok-subtle)" : run.status === "error" ? "var(--danger-subtle)" : "var(--bg-muted)"};
                              color: ${run.status === "ok" ? "var(--ok)" : run.status === "error" ? "var(--danger)" : "var(--muted)"};
                              font-size: 10px;
                            ">${run.status}</span>
                            <span class="mono muted">${new Date(run.ts).toLocaleTimeString()}</span>
                            ${run.durationMs != null ? html`<span class="muted">${run.durationMs}ms</span>` : nothing}
                          </div>
                        `,
                      )}
                    </div>
                  `
                  : nothing
              }
            `
            : html`
                <div class="muted" style="font-size: 13px; margin-top: 20px">
                  Click a day to see scheduled jobs and run history.
                </div>
              `
        }
      </div>
    </div>
  `;
}
