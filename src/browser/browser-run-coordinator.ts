import type { CredentialPlan } from "../domain/credential-plan";

export interface BrowserActionRequest {
  appName: string;
  planSummary: string;
  credentialTypes: string[];
  officialSources: string[];
}

export type BrowserObservationKind =
  | "completed"
  | "human_required"
  | "payment_required"
  | "blocked";

export interface BrowserObservation {
  kind: BrowserObservationKind;
  summary: string;
  currentUrl: string;
}

export interface BrowserSession {
  id: string;
  setAllowedDomains(domains: string[]): Promise<void>;
  navigate(url: string, signal: AbortSignal): Promise<void>;
  execute(
    request: BrowserActionRequest,
    signal: AbortSignal,
  ): Promise<BrowserObservation>;
  close(): Promise<void>;
}

export interface BrowserSessionFactory {
  create(signal: AbortSignal): Promise<BrowserSession>;
}

export type BrowserRunResult =
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

export class BrowserRunCoordinator {
  readonly #factory: BrowserSessionFactory;
  readonly #maxSessionStarts: number;
  readonly #maxRunDurationMs: number;
  readonly #minRunIntervalMs: number;
  readonly #now: () => number;
  #activeController: AbortController | null = null;
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
    if (!this.#activeController) {
      return false;
    }

    this.#activeController.abort({ code: "cancelled" });
    return true;
  }

  async run(plan: CredentialPlan): Promise<BrowserRunResult> {
    if (this.#activeController) {
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
    this.#activeController = controller;
    this.#sessionStarts += 1;
    this.#lastStartedAt = now;
    let session: BrowserSession | undefined;
    const timeout = setTimeout(() => {
      controller.abort({ code: "timeout" });
    }, this.#maxRunDurationMs);

    try {
      session = await this.#factory.create(controller.signal);
      await session.setAllowedDomains(allowedDomains);
      await session.navigate(plan.signupUrl, controller.signal);
      const observation = await session.execute(
        {
          appName: plan.appName,
          planSummary: plan.summary,
          credentialTypes: plan.credentialTypes,
          officialSources: plan.officialSources,
        },
        controller.signal,
      );

      if (
        observation.kind === "payment_required" ||
        observation.kind === "blocked"
      ) {
        return {
          status: "blocked",
          sessionId: session.id,
          reason: observation.summary,
          blocker:
            observation.kind === "payment_required"
              ? "payment_required"
              : "observed_blocker",
          currentUrl: observation.currentUrl,
        };
      }

      return {
        status: "completed",
        sessionId: session.id,
        message: observation.summary,
        currentUrl: observation.currentUrl,
      };
    } catch {
      const abortReason = controller.signal.reason as
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
        reason: "The browser session failed before the task completed.",
      };
    } finally {
      clearTimeout(timeout);
      try {
        await session?.close();
      } catch {
        // Stagehand close is already a force-close. There is no safer retry path.
      } finally {
        if (this.#activeController === controller) {
          this.#activeController = null;
        }
      }
    }
  }
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
