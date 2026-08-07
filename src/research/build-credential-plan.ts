import type {
  CredentialPlan,
  PathClassification,
  ResolvedTarget,
} from "@/domain/credential-plan";

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
}

export interface CredentialPlanDependencies {
  research: ResearchProvider;
  planner: PlanningModel;
}

export async function buildCredentialPlan(
  query: string,
  dependencies: CredentialPlanDependencies,
): Promise<CredentialPlan> {
  const searchResults = await dependencies.research.search(
    `${query} official API developer documentation authentication credentials`,
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
  const officialSources = target.officialSourceUrls
    .filter((url) => resultUrls.has(url) && new URL(url).protocol === "https:")
    .slice(0, 3);

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

  const documents = await Promise.all(
    officialSources.map((url) => dependencies.research.fetch(url)),
  );
  const classification = await dependencies.planner.classifyPath({
    query,
    target,
    documents,
  });

  return {
    inputMode: target.inputMode,
    appName: target.appName,
    selectionReason: target.selectionReason,
    clarificationQuestion: target.clarificationQuestion,
    requiresConfirmation: target.inputMode === "discovery",
    ...classification,
    officialSources,
  };
}
