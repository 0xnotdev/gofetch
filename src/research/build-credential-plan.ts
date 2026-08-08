import type {
  CredentialPlan,
  PathClassification,
  ResolvedTarget,
} from "@/domain/credential-plan";
import { getDomain } from "tldts";

export type {
  CredentialPlan,
  PathClassification,
  ResolvedTarget,
} from "@/domain/credential-plan";

export interface SearchResult {
  title: string;
  url: string;
}

export interface SourceDocument {
  url: string;
  content: string;
}

export interface ResearchProvider {
  search(query: string): Promise<SearchResult[]>;
  fetch(url: string): Promise<SourceDocument>;
}

export interface PlanningModel {
  resolveTarget(input: {
    query: string;
    searchResults: SearchResult[];
  }): Promise<ResolvedTarget>;
  classifyPath(input: {
    query: string;
    target: ResolvedTarget;
    documents: SourceDocument[];
  }): Promise<PathClassification>;
  dispose?(): Promise<void>;
}

export interface CredentialPlanDependencies {
  research: ResearchProvider;
  planner: PlanningModel;
}

export async function buildCredentialPlan(
  query: string,
  dependencies: CredentialPlanDependencies,
): Promise<CredentialPlan> {
  try {
    return await buildCredentialPlanWithoutCleanup(query, dependencies);
  } finally {
    await dependencies.planner.dispose?.();
  }
}

async function buildCredentialPlanWithoutCleanup(
  query: string,
  dependencies: CredentialPlanDependencies,
): Promise<CredentialPlan> {
  let searchResults = await dependencies.research.search(
    `${query} official API developer documentation authentication credentials signup login dashboard`,
  );
  const target = await dependencies.planner.resolveTarget({ query, searchResults });

  if (target.inputMode === "ambiguous" || !target.appName) {
    return {
      inputMode: "ambiguous",
      appName: null,
      selectionReason: target.selectionReason,
      clarificationQuestion: target.clarificationQuestion,
      requiresConfirmation: false,
      path: "insufficient_evidence",
      credentialTypes: [],
      summary: "More detail is needed before GoFetch can select an app.",
      signupUrl: null,
      blocker: null,
      officialSources: [],
    };
  }

  const resultUrls = new Set(searchResults.map((result) => result.url));
  const selectedOfficialSources = target.officialSourceUrls
    .filter((url) => resultUrls.has(url) && new URL(url).protocol === "https:")
    .slice(0, 3);
  let relatedAccountRoutes = relatedOfficialAccountRoutes(
    searchResults,
    selectedOfficialSources,
  );
  if (relatedAccountRoutes.length === 0) {
    try {
      const focusedAccountResults = await dependencies.research.search(
        `${target.appName} official account login signup developer dashboard API keys`,
      );
      searchResults = mergeSearchResults(searchResults, focusedAccountResults);
      relatedAccountRoutes = relatedOfficialAccountRoutes(
        searchResults,
        selectedOfficialSources,
      );
    } catch {
      // Preserve the verified documentation path when the optional focused
      // account-route search is temporarily unavailable.
    }
  }
  const officialSources = [
    ...new Set([
      ...selectedOfficialSources.slice(0, 1),
      ...relatedAccountRoutes.slice(0, 1),
      ...selectedOfficialSources.slice(1),
    ]),
  ].slice(0, 3);

  if (officialSources.length === 0) {
    return {
      inputMode: target.inputMode,
      appName: target.appName,
      selectionReason: target.selectionReason,
      clarificationQuestion: target.clarificationQuestion,
      requiresConfirmation: target.inputMode === "discovery",
      path: "insufficient_evidence",
      credentialTypes: [],
      summary: "No verified official API source was found for this target.",
      signupUrl: null,
      blocker: "The credential path could not be verified from an official source.",
      officialSources: [],
    };
  }

  const fetchResults = await Promise.allSettled(
    officialSources.map((url) => dependencies.research.fetch(url)),
  );
  const documents = fetchResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (documents.length === 0) {
    return {
      inputMode: target.inputMode,
      appName: target.appName,
      selectionReason: target.selectionReason,
      clarificationQuestion: target.clarificationQuestion,
      requiresConfirmation: target.inputMode === "discovery",
      path: "insufficient_evidence",
      credentialTypes: [],
      summary: "The located official API sources could not be retrieved safely.",
      signupUrl: null,
      blocker: "No official source returned usable credential-path evidence.",
      officialSources,
    };
  }
  const fetchedOfficialSources = documents.map((document) => document.url);
  const classification = await dependencies.planner.classifyPath({
    query,
    target,
    documents,
  });

  if (classification.path === "public_credential") {
    const publicCredential = classification.publicCredential;
    const hasVerbatimOfficialEvidence =
      publicCredential &&
      classification.credentialTypes.includes(publicCredential.credentialType) &&
      documents.some(
        (document) =>
          document.url === publicCredential.sourceUrl &&
          document.content.includes(publicCredential.credential),
      );

    if (!hasVerbatimOfficialEvidence) {
      return {
        inputMode: target.inputMode,
        appName: target.appName,
        selectionReason: target.selectionReason,
        clarificationQuestion: target.clarificationQuestion,
        requiresConfirmation: target.inputMode === "discovery",
        path: "insufficient_evidence",
        credentialTypes: [],
        summary:
          "The public credential could not be verified verbatim in an official source.",
        signupUrl: null,
        blocker: "No verified public credential was found.",
        publicCredential: null,
        officialSources: fetchedOfficialSources,
      };
    }
  }

  return {
    inputMode: target.inputMode,
    appName: target.appName,
    selectionReason: target.selectionReason,
    clarificationQuestion: target.clarificationQuestion,
    requiresConfirmation: target.inputMode === "discovery",
    ...classification,
    officialSources: fetchedOfficialSources,
  };
}

function relatedOfficialAccountRoutes(
  searchResults: SearchResult[],
  selectedOfficialSources: string[],
): string[] {
  const selectedRoots = selectedOfficialSources.map((url) => siteRoot(url));

  return searchResults
    .map((result) => ({ ...result, url: secureUrl(result.url) }))
    .filter(
      (result): result is SearchResult & { url: string } =>
        result.url !== null &&
        !selectedOfficialSources.includes(result.url) &&
        selectedRoots.includes(siteRoot(result.url)) &&
        accountRouteEvidenceScore(result) > 0,
    )
    .map((result) => result.url);
}

function mergeSearchResults(
  current: SearchResult[],
  additional: SearchResult[],
): SearchResult[] {
  const byUrl = new Map(current.map((result) => [result.url, result]));
  for (const result of additional) {
    if (!byUrl.has(result.url)) byUrl.set(result.url, result);
  }
  return [...byUrl.values()];
}

function accountRouteEvidenceScore(result: {
  title: string;
  url: string | null;
}): number {
  if (!result.url) return 0;
  try {
    const url = new URL(result.url);
    if (
      /(?:^|\/)(?:signup|sign-up|register|login|log-in|auth|dashboard|console|account)(?:\/|$)/i.test(
        url.pathname,
      )
    ) {
      return 3;
    }
    if (
      /^(?:app|dashboard|console|account|accounts|auth|login)\./i.test(
        url.hostname,
      )
    ) {
      return 2;
    }
    if (
      /\b(?:sign up|signup|register|log in|login|account portal|dashboard|developer console)\b/i.test(
        result.title,
      )
    ) {
      return 1;
    }
  } catch {
    // Malformed results are discarded by secureUrl before this scorer runs.
  }
  return 0;
}

function secureUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function siteRoot(value: string): string {
  const hostname = new URL(value).hostname;
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}
