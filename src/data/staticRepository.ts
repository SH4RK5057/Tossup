import { questionSchema, type Question, type Status } from '../core/types';
import type { PoolRequest, QuestionRepository } from './repository';

/**
 * Serves practice questions from the baked-in bank (public/bank/<ruleset>-<level>.json, served by the
 * site itself), so playing makes no database reads and every question can be drawn at random.
 * Everything else (reports, admin tools) goes to the wrapped repository. If a file cannot be loaded
 * the wrapped repository's pool is used instead.
 */
export class StaticPoolRepository implements QuestionRepository {
  readonly kind: 'seed' | 'firestore';
  private files = new Map<string, Promise<Question[]>>();

  constructor(private inner: QuestionRepository, private base: string = import.meta.env.BASE_URL) {
    this.kind = inner.kind;
  }

  private load(ruleset: string, level: string): Promise<Question[]> {
    const key = `${ruleset}-${level}`;
    let p = this.files.get(key);
    if (!p) {
      p = fetch(`${this.base}bank/${key}.json`)
        .then((r) => { if (!r.ok) throw new Error(`bank file ${key}: HTTP ${r.status}`); return r.json() as Promise<unknown[]>; })
        .then((rows) => rows.map((x) => questionSchema.safeParse(x)).filter((x) => x.success).map((x) => x.data as Question));
      this.files.set(key, p);
      p.catch(() => this.files.delete(key)); // retry next time
    }
    return p;
  }

  async loadPool(req: PoolRequest): Promise<Question[]> {
    try {
      const lists = await Promise.all(req.levels.map((l) => this.load(req.rulesetId, l)));
      const pool = lists.flat();
      if (pool.length) return pool;
    } catch (e) {
      console.warn('Baked question bank unavailable, falling back:', e);
    }
    return this.inner.loadPool(req);
  }

  createReport: QuestionRepository['createReport'] = (r) => this.inner.createReport(r);
  isAdmin: QuestionRepository['isAdmin'] = (uid) => this.inner.isAdmin(uid);
  listQuestions: QuestionRepository['listQuestions'] = () => this.inner.listQuestions();
  getQuestion: QuestionRepository['getQuestion'] = (id) => this.inner.getQuestion(id);
  saveQuestion: QuestionRepository['saveQuestion'] = (q, e) => this.inner.saveQuestion(q, e);
  setStatus = (id: string, status: Status, editor: string) => this.inner.setStatus(id, status, editor);
  listVersions: QuestionRepository['listVersions'] = (id) => this.inner.listVersions(id);
  revertToVersion: QuestionRepository['revertToVersion'] = (id, v, e) => this.inner.revertToVersion(id, v, e);
  createQuestions: QuestionRepository['createQuestions'] = (qs) => this.inner.createQuestions(qs);
  deleteQuestions: QuestionRepository['deleteQuestions'] = (ids) => this.inner.deleteQuestions(ids);
  listReports: QuestionRepository['listReports'] = () => this.inner.listReports();
  resolveReport: QuestionRepository['resolveReport'] = (id) => this.inner.resolveReport(id);
  syncReportCounts: QuestionRepository['syncReportCounts'] = () => this.inner.syncReportCounts();
}
