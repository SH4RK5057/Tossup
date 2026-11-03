import type { Level, Question, Report, ReportReason, RulesetId, Status, StoredReport } from '../core/types';

export interface PoolRequest {
  rulesetId: RulesetId;
  level: Level;
  /** Levels to load: the requested level plus lower levels for cumulative pools. */
  levels: Level[];
}

export interface QuestionVersion {
  id: string;
  editor: string;
  saved_at: string;
  /** Full snapshot of the question before the edit. */
  snapshot: Question;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  name: string | null;
}

export interface AuthService {
  /** False when Firebase is not configured (seed-file mode). */
  readonly available: boolean;
  onChange(cb: (user: AdminUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

/** All data access goes through this interface (seed file or Firestore). */
export interface QuestionRepository {
  readonly kind: 'seed' | 'firestore';

  /**
   * Loads the active question pool for a session once. Never fetches per question.
   * Callers hold the result in memory for the whole session.
   */
  loadPool(req: PoolRequest): Promise<Question[]>;

  // --- reports (anyone can create) ---
  createReport(input: { question_id: string; reason: ReportReason; typed_answer?: string; note?: string }): Promise<void>;

  // --- admin only below; implementations reject for non-admins ---
  isAdmin(uid: string): Promise<boolean>;
  listQuestions(): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | null>;
  /** Writes the current version to versions, then updates the question. */
  saveQuestion(next: Question, editor: string): Promise<Question>;
  setStatus(id: string, status: Status, editor: string): Promise<void>;
  listVersions(id: string): Promise<QuestionVersion[]>;
  revertToVersion(id: string, versionId: string, editor: string): Promise<Question>;
  /** Creates new questions (the importer saves them as pending). */
  createQuestions(questions: Question[]): Promise<void>;
  listReports(): Promise<StoredReport[]>;
  resolveReport(id: string): Promise<void>;
  /** Recomputes questions' report_count from unresolved reports. */
  syncReportCounts(): Promise<void>;
}

export class NotAuthorizedError extends Error {
  constructor(message = 'Admin access required') { super(message); }
}

export type { Report };
