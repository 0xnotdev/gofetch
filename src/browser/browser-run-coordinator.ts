import type { CredentialPlan } from "../domain/credential-plan";
import type {
  HumanInterventionRequest,
  SuccessResult,
} from "../domain/run";
import {
  createCredentialResult,
  type CredentialEvidence,
} from "../credential/credential-result";

export interface BrowserActionRequest {
  appName: string;
  planSummary: string;
  credentialTypes: string[];
  officialSources: string[];
}

export interface HumanHandback {
  interventionId: string;
  value?: string;
}

export interface PrivateBrowserInput {
  value: string;
  description: string;
}

export type BrowserObservationKind =
  | "completed"
  | "credential_obtained"
  | "human_required"
  | "payment_required"
  | "blocked";

export interface BrowserObservation {
  kind: BrowserObservationKind;
  summary: string;
  currentUrl: string;
  intervention?: Omit<HumanInterventionRequest, "id">;
  credential?: CredentialEvidence;
}

export interface BrowserSession {
  id: string;
  liveViewUrl: string;
  setAllowedDomains(domains: string[]): Promise<void>;
  navigate(url: string, signal: AbortSignal): Promise<void>;
  execute(
    request: BrowserActionRequest,
    signal: AbortSignal,
    privateInput?: PrivateBrowserInput,
  ): Promise<BrowserObservation>;
  close(): Promise<void>;
}

export interface BrowserSessionFactory {
  create(signal: AbortSignal): Promise<BrowserSession>;
}

export type BrowserRunResult =
  | (SuccessResult & {
      sessionId: string;
      currentUrl: string;
    })
  | {
      status: "completed";
      sessionId: string;
      message: string;
      currentUrl: string;
    }
  | {
      status: "blocked";
      sessionId: string;
      reason: string;
      blocker: "payment_required" | "observed_blocker";
      currentUrl: string;
    }
  | {
      status: "awaiting_human";
      sessionId: string;
      liveViewUrl: string;
      currentUrl: string;
      intervention: HumanInterventionRequest;
    }
  | {
      status: "technical_failure";
      reason: string;
    }
  | {
      status: "cancelled" | "timed_out";
      reason: string;
    };

export interface BrowserRunCoordinatorOptions {
  factory: BrowserSessionFactory;
  maxSessionStarts?: number;
  maxRunDurationMs?: number;
  minRunIntervalMs?: number;
  now?: () => number;
}

interface ActiveBrowserRun {
  plan: CredentialPlan;
  controller: AbortController;
  request: BrowserActionRequest;
  session?: BrowserSession;
  phase: "starting" | "agent" | "human";
  timeout: ReturnType<typeof setTimeout>;
  closePromise?: Promise<void>;
  intervention?: HumanInterventionRequest;
}

export class BrowserRunCoordinator {
  readonly #factory: BrowserSessionFactory;
  readonly #maxSessionStarts: number;
  readonly #maxRunDurationMs: number;
  readonly #minRunIntervalMs: number;
  readonly #now: () => number;
  #activeRun: ActiveBrowserRun | null = null;
  #sessionStarts = 0;
  #lastStartedAt: number | null = null;

  constructor(options: BrowserRunCoordinatorOptions) {
    this.#factory = options.factory;
    this.#maxSessionStarts = options.maxSessionStarts ?? 3;
    this.#maxRunDurationMs = options.maxRunDurationMs ?? 12 * 60 * 1_000;
    this.#minRunIntervalMs = options.minRunIntervalMs ?? 1_000;
    this.#now = options.now ?? Date.now;
  }

  cancel(): boolean {
    if (!this.#activeRun) {
      return false;
    }

    const active = this.#activeRun;
    active.controller.abort({ code: "cancelled" });
    void this.#finish(active);
    return true;
  }

  async resume(
    sessionId: string,
    handback?: HumanHandback,
  ): Promise<BrowserRunResult> {
    const active = this.#activeRun;
    if (!active || !active.session || active.session.id !== sessionId) {
      return {
        status: "technical_failure",
        reason: "No matching paused browser session is available.",
      };
    }

    if (active.phase !== "human") {
      return {
        status: "technical_failure",
        reason: "The browser agent already has control of this session.",
      };
    }

    if (
      handback &&
      active.intervention &&
      handback.interventionId !== active.intervention.id
    ) {
      return {
        status: "technical_failure",
        reason: "The human-intervention request is no longer active.",
      };
    }

    active.phase = "agent";
    const privateInput = handback?.value
      ? {
          value: handback.value,
          description: active.intervention?.prompt ?? "Human-provided input",
        }
      : undefined;
    active.intervention = undefined;
    return this.#execute(active, privateInput);
  }

  async run(plan: CredentialPlan): Promise<BrowserRunResult> {
    if (this.#activeRun) {
      return {
        status: "technical_failure",
        reason: "Another browser run is already active.",
      };
    }

    if (this.#sessionStarts >= this.#maxSessionStarts) {
      return {
        status: "technical_failure",
        reason: "The configured browser-session quota is exhausted.",
      };
    }

    const now = this.#now();
    if (
      this.#lastStartedAt !== null &&
      now - this.#lastStartedAt < this.#minRunIntervalMs
    ) {
      return {
        status: "technical_failure",
        reason:
          "A new browser session was requested too soon after the previous run.",
      };
    }

    if (!plan.appName || !plan.signupUrl || plan.path !== "signup_required") {
      throw new Error("A signup browser run requires a resolved signup plan.");
    }

    const allowedDomains = buildAllowedDomains([
      ...plan.officialSources,
      plan.signupUrl,
    ]);
    const controller = new AbortController();
    this.#sessionStarts += 1;
    this.#lastStartedAt = now;
    const request: BrowserActionRequest = {
      appName: plan.appName,
      planSummary: plan.summary,
      credentialTypes: plan.credentialTypes,
      officialSources: plan.officialSources,
    };
    const active = {} as ActiveBrowserRun;
    active.controller = controller;
    active.plan = plan;
    active.request = request;
    active.phase = "starting";
    active.timeout = setTimeout(() => {
      controller.abort({ code: "timeout" });
      void this.#finish(active);
    }, this.#maxRunDurationMs);
    this.#activeRun = active;

    try {
      active.session = await this.#factory.create(controller.signal);
      await active.session.setAllowedDomains(allowedDomains);
      await active.session.navigate(plan.signupUrl, controller.signal);
      active.phase = "agent";
      return await this.#execute(active);
    } catch (error) {
      const result = this.#failureFor(active, error);
      await this.#finish(active);
      return result;
    }
  }

  async #execute(
    active: ActiveBrowserRun,
    privateInput?: PrivateBrowserInput,
  ): Promise<BrowserRunResult> {
    const session = active.session;
    if (!session) {
      return {
        status: "technical_failure",
        reason: "The browser session failed before the task completed.",
      };
    }

    let observation: BrowserObservation;
    try {
      observation = privateInput
        ? await session.execute(
            active.request,
            active.controller.signal,
            privateInput,
          )
        : await session.execute(active.request, active.controller.signal);
    } catch (firstError) {
      if (!active.controller.signal.aborted) {
        try {
          observation = await session.execute(
            active.request,
            active.controller.signal,
          );
        } catch (retryError) {
          const result = this.#failureFor(active, retryError);
          await this.#finish(active);
          return result;
        }
      } else {
        const result = this.#failureFor(active, firstError);
        await this.#finish(active);
        return result;
      }
    }

    if (observation.kind === "human_required") {
      active.phase = "human";
      const intervention: HumanInterventionRequest = {
        id: crypto.randomUUID(),
        kind: observation.intervention?.kind ?? "browser_takeover",
        prompt:
          observation.intervention?.prompt ??
          "Complete the requested step in the live browser, then hand control back.",
        reason: observation.intervention?.reason ?? observation.summary,
        sensitive: observation.intervention?.sensitive ?? true,
      };
      active.intervention = intervention;
      return {
        status: "awaiting_human",
        sessionId: session.id,
        liveViewUrl: session.liveViewUrl,
        currentUrl: observation.currentUrl,
        intervention,
      };
    }

    if (observation.kind === "credential_obtained") {
      let credentialResult: SuccessResult;
      try {
        if (!observation.credential) {
          throw new Error("Credential evidence is missing.");
        }
        credentialResult = createCredentialResult(
          active.plan,
          observation.credential,
        );
      } catch {
        await this.#finish(active);
        return {
          status: "technical_failure",
          reason:
            "The browser returned credential data that failed safety validation.",
        };
      }

      await this.#finish(active);
      return {
        ...credentialResult,
        sessionId: session.id,
        currentUrl: observation.currentUrl,
      };
    }

    let result: BrowserRunResult;
    if (
      observation.kind === "payment_required" ||
      observation.kind === "blocked"
    ) {
      result = {
        status: "blocked",
        sessionId: session.id,
        reason: observation.summary,
        blocker:
          observation.kind === "payment_required"
            ? "payment_required"
            : "observed_blocker",
        currentUrl: observation.currentUrl,
      };
    } else {
      result = {
        status: "completed",
        sessionId: session.id,
        message: observation.summary,
        currentUrl: observation.currentUrl,
      };
    }

    await this.#finish(active);
    return result;
  }

  #failureFor(active: ActiveBrowserRun, error?: unknown): BrowserRunResult {
    const abortReason = active.controller.signal.reason as
      | { code?: string }
      | undefined;
    if (abortReason?.code === "timeout") {
      return {
        status: "timed_out",
        reason: "The browser run exceeded its 12-minute safety limit.",
      };
    }
    if (abortReason?.code === "cancelled") {
      return {
        status: "cancelled",
        reason: "The browser run was cancelled by the user.",
      };
    }
    return {
      status: "technical_failure",
      reason: browserFailureReason(error),
    };
  }

  async #finish(active: ActiveBrowserRun): Promise<void> {
    clearTimeout(active.timeout);
    if (!active.closePromise) {
      active.closePromise = (async () => {
        try {
          await active.session?.close();
        } catch {
          // Stagehand close is already a force-close. There is no safer retry path.
        }
      })();
    }
    await active.closePromise;
    if (this.#activeRun === active) {
      this.#activeRun = null;
    }
  }
}

function browserFailureReason(error: unknown): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return "The browser session failed before the task completed.";
  }

  const message = error.message
    .replace(/(?:bb_live_|sk-|ak_)[A-Za-z0-9_-]+/g, "<redacted>")
    .slice(0, 300);
  return `The browser could not continue after a retry: ${message}`;
}

export function buildAllowedDomains(urls: string[]): string[] {
  const domains = urls.map((value) => {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new Error(
        "Only secure official URLs may enter the browser domain policy.",
      );
    }

    return url.hostname;
  });

  return [...new Set(domains)].sort();
}
