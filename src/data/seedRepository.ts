import seedJson from '../../seed/questions.json';
import { questionSchema, type Question, type Status, type StoredReport } from '../core/types';
import {
  NotAuthorizedError,
  type AdminUser,
  type AuthService,
  type PoolRequest,
  type QuestionRepository,
  type QuestionVersion,
} from './repository';

const nowIso = () => new Date().toISOString();
let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * In-memory repository. Backs local development (no Firebase project needed).
 * Writes live only until the page reloads. Admin operations are exposed only
 * when `allowAdmin` is set (VITE_DEV_ADMIN in dev builds).
 */
export class SeedRepository implements QuestionRepository {
  readonly kind = 'seed' as const;
  private questions = new Map<string, Question>();
  private versions = new Map<string, QuestionVersion[]>();
  private reports: StoredReport[] = [];

  constructor(initial: Question[] = (seedJson as unknown[]).map((q) => questionSchema.parse(q)), private allowAdmin = false) {
    initial.forEach((q) => this.questions.set(q.id, q));
  }

  async loadPool(req: PoolRequest): Promise<Question[]> {
    return [...this.questions.values()].filter(
      (q) => q.status === 'active' && q.rulesets.includes(req.rulesetId) && req.levels.includes(q.level),
    );
  }

  async createReport(input: { question_id: string; reason: StoredReport['reason']; typed_answer?: string; note?: string }) {
    this.reports.push({ ...input, id: uid('report'), created_at: nowIso(), resolved: false });
  }

  private requireAdmin() {
    if (!this.allowAdmin) throw new NotAuthorizedError('Admin tools need a Firebase project. See the README.');
  }

  async isAdmin(): Promise<boolean> { return this.allowAdmin; }

  async listQuestions(): Promise<Question[]> {
    this.requireAdmin();
    return [...this.questions.values()];
  }

  async getQuestion(id: string): Promise<Question | null> {
    return this.questions.get(id) ?? null;
  }

  async saveQuestion(next: Question, editor: string): Promise<Question> {
    this.requireAdmin();
    const current = this.questions.get(next.id);
    if (current) {
      const list = this.versions.get(next.id) ?? [];
      this.versions.set(next.id, [{ id: uid('v'), editor, saved_at: nowIso(), snapshot: current }, ...list]);
    }
    const saved = { ...next, updated_at: nowIso() };
    this.questions.set(saved.id, saved);
    return saved;
  }

  async setStatus(id: string, status: Status, editor: string): Promise<void> {
    const q = await this.getQuestion(id);
    if (q) await this.saveQuestion({ ...q, status }, editor);
  }

  async listVersions(id: string): Promise<QuestionVersion[]> {
    this.requireAdmin();
    return this.versions.get(id) ?? [];
  }

  async revertToVersion(id: string, versionId: string, editor: string): Promise<Question> {
    const v = (this.versions.get(id) ?? []).find((x) => x.id === versionId);
    if (!v) throw new Error('Version not found');
    return this.saveQuestion(v.snapshot, editor);
  }

  async createQuestions(questions: Question[]): Promise<void> {
    this.requireAdmin();
    questions.forEach((q) => this.questions.set(q.id, q));
  }

  async deleteQuestions(ids: string[]): Promise<void> {
    this.requireAdmin();
    ids.forEach((id) => { this.questions.delete(id); this.versions.delete(id); });
  }

  async listReports(): Promise<StoredReport[]> {
    this.requireAdmin();
    return [...this.reports];
  }

  async resolveReport(id: string): Promise<void> {
    this.requireAdmin();
    this.reports = this.reports.map((r) => (r.id === id ? { ...r, resolved: true } : r));
  }

  async syncReportCounts(): Promise<void> {
    this.requireAdmin();
    for (const q of this.questions.values()) {
      const n = this.reports.filter((r) => r.question_id === q.id && !r.resolved).length;
      if (n !== q.report_count) this.questions.set(q.id, { ...q, report_count: n });
    }
  }
}

/** Fake admin sign-in for local development without Firebase (VITE_DEV_ADMIN=1). */
export function createDevAuth(): AuthService {
  let user: AdminUser | null = null;
  const listeners = new Set<(u: AdminUser | null) => void>();
  const emit = () => listeners.forEach((l) => l(user));
  return {
    available: true,
    onChange(cb) { listeners.add(cb); cb(user); return () => listeners.delete(cb); },
    async signIn(email) { user = { uid: 'dev-admin', email: email || 'dev@localhost', name: 'Dev Admin' }; emit(); },
    async signOut() { user = null; emit(); },
  };
}

export const noAuth: AuthService = {
  available: false,
  onChange(cb) { cb(null); return () => undefined; },
  async signIn() { throw new Error('Firebase is not configured'); },
  async signOut() { /* nothing */ },
};
