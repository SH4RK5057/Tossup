import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type Auth,
} from 'firebase/auth';
import {
  Timestamp, addDoc, collection, deleteDoc, doc, endBefore, getDoc, getDocs, getFirestore, limit, orderBy, query,
  serverTimestamp, startAt, updateDoc, where, writeBatch, type DocumentData, type Firestore,
} from 'firebase/firestore';
import { questionSchema, type Question, type Status, type StoredReport } from '../core/types';
import type { AdminUser, AuthService, PoolRequest, QuestionRepository, QuestionVersion } from './repository';

/** Upper bound per question type per pool load; bounds Spark-tier reads. */
const POOL_LIMIT = 300;

const toIso = (v: unknown): string | null => {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return null;
};
const toTimestamp = (iso: string | null) => (iso ? Timestamp.fromDate(new Date(iso)) : null);

function fromDoc(id: string, data: DocumentData): Question | null {
  const parsed = questionSchema.safeParse({
    ...data,
    id,
    created_at: toIso(data.created_at) ?? new Date(0).toISOString(),
    updated_at: toIso(data.updated_at) ?? new Date(0).toISOString(),
    expires_at: toIso(data.expires_at),
  });
  if (!parsed.success) {
    console.warn(`Skipping malformed question ${id}`, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

function toDoc(q: Question, creating: boolean): DocumentData {
  return {
    ...q,
    expires_at: toTimestamp(q.expires_at),
    created_at: creating ? serverTimestamp() : toTimestamp(q.created_at),
    updated_at: serverTimestamp(),
  };
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function createFirebase(): { repo: QuestionRepository; auth: AuthService } {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  return { repo: new FirestoreRepository(db), auth: createFirebaseAuth(auth) };
}

function createFirebaseAuth(auth: Auth): AuthService {
  return {
    available: true,
    onChange(cb) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? ({ uid: u.uid, email: u.email, name: u.displayName } satisfies AdminUser) : null));
    },
    async signIn(email, password) { await signInWithEmailAndPassword(auth, email, password); },
    async signOut() { await fbSignOut(auth); },
  };
}

export class FirestoreRepository implements QuestionRepository {
  readonly kind = 'firestore' as const;
  constructor(private db: Firestore) {}

  private questions() { return collection(this.db, 'questions'); }

  /**
   * One filtered load per session. Random selection: every question has a `random`
   * number; we start at a random point in that ordering and wrap around.
   */
  async loadPool(req: PoolRequest): Promise<Question[]> {
    const start = Math.random();
    const out: Question[] = [];
    for (const type of ['tossup', 'bonus'] as const) {
      const base = [
        where('status', '==', 'active'),
        where('type', '==', type),
        where('rulesets', 'array-contains', req.rulesetId),
        where('level', 'in', req.levels),
      ];
      const first = await getDocs(query(this.questions(), ...base, orderBy('random'), startAt(start), limit(POOL_LIMIT)));
      const docs = [...first.docs];
      if (docs.length < POOL_LIMIT) {
        const wrap = await getDocs(
          query(this.questions(), ...base, orderBy('random'), endBefore(start), limit(POOL_LIMIT - docs.length)),
        );
        docs.push(...wrap.docs);
      }
      for (const d of docs) {
        const q = fromDoc(d.id, d.data());
        if (q) out.push(q);
      }
    }
    return out;
  }

  async createReport(input: { question_id: string; reason: StoredReport['reason']; typed_answer?: string; note?: string }) {
    const data: DocumentData = { question_id: input.question_id, reason: input.reason, created_at: serverTimestamp(), resolved: false };
    if (input.typed_answer) data.typed_answer = input.typed_answer.slice(0, 200);
    if (input.note) data.note = input.note.slice(0, 500);
    await addDoc(collection(this.db, 'reports'), data);
  }

  async isAdmin(uid: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(this.db, 'config', 'admin'));
      const uids: unknown = snap.data()?.uids;
      return Array.isArray(uids) && uids.includes(uid);
    } catch {
      return false; // rules deny the read for non-admins
    }
  }

  async listQuestions(): Promise<Question[]> {
    const snap = await getDocs(this.questions());
    return snap.docs.map((d) => fromDoc(d.id, d.data())).filter((q): q is Question => q !== null);
  }

  async getQuestion(id: string): Promise<Question | null> {
    const snap = await getDoc(doc(this.questions(), id));
    return snap.exists() ? fromDoc(snap.id, snap.data()) : null;
  }

  async saveQuestion(next: Question, editor: string): Promise<Question> {
    const ref = doc(this.questions(), next.id);
    const current = await getDoc(ref);
    const batch = writeBatch(this.db);
    if (current.exists()) {
      const snapshot = fromDoc(current.id, current.data());
      if (snapshot) {
        batch.set(doc(collection(ref, 'versions')), { editor, saved_at: serverTimestamp(), snapshot });
      }
    }
    batch.set(ref, toDoc(next, !current.exists()));
    await batch.commit();
    return { ...next, updated_at: new Date().toISOString() };
  }

  async setStatus(id: string, status: Status, editor: string): Promise<void> {
    const q = await this.getQuestion(id);
    if (q) await this.saveQuestion({ ...q, status }, editor);
  }

  async listVersions(id: string): Promise<QuestionVersion[]> {
    const snap = await getDocs(query(collection(doc(this.questions(), id), 'versions'), orderBy('saved_at', 'desc')));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        editor: String(data.editor ?? ''),
        saved_at: toIso(data.saved_at) ?? '',
        snapshot: questionSchema.parse(data.snapshot),
      };
    });
  }

  async revertToVersion(id: string, versionId: string, editor: string): Promise<Question> {
    const versions = await this.listVersions(id);
    const v = versions.find((x) => x.id === versionId);
    if (!v) throw new Error('Version not found');
    return this.saveQuestion(v.snapshot, editor);
  }

  async createQuestions(questions: Question[]): Promise<void> {
    for (let i = 0; i < questions.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const q of questions.slice(i, i + 400)) batch.set(doc(this.questions(), q.id), toDoc(q, true));
      await batch.commit();
    }
  }

  async deleteQuestions(ids: string[]): Promise<void> {
    for (const id of ids) {
      const ref = doc(this.questions(), id);
      const versions = await getDocs(collection(ref, 'versions'));
      for (let i = 0; i < versions.docs.length; i += 400) {
        const b = writeBatch(this.db);
        versions.docs.slice(i, i + 400).forEach((v) => b.delete(v.ref));
        await b.commit();
      }
      await deleteDoc(ref);
    }
  }

  async listReports(): Promise<StoredReport[]> {
    const snap = await getDocs(collection(this.db, 'reports'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        question_id: String(data.question_id),
        reason: data.reason,
        typed_answer: data.typed_answer,
        note: data.note,
        created_at: toIso(data.created_at) ?? '',
        resolved: Boolean(data.resolved),
      } as StoredReport;
    });
  }

  async resolveReport(id: string): Promise<void> {
    await updateDoc(doc(this.db, 'reports', id), { resolved: true });
  }

  async syncReportCounts(): Promise<void> {
    const reports = (await this.listReports()).filter((r) => !r.resolved);
    const counts = new Map<string, number>();
    for (const r of reports) counts.set(r.question_id, (counts.get(r.question_id) ?? 0) + 1);
    const stale = await getDocs(query(this.questions(), where('report_count', '>', 0)));
    const ids = new Set<string>([...counts.keys(), ...stale.docs.map((d) => d.id)]);
    const current = new Map(stale.docs.map((d) => [d.id, Number(d.data().report_count)]));
    await Promise.allSettled(
      [...ids]
        .filter((id) => (counts.get(id) ?? 0) !== (current.get(id) ?? -1))
        .map((id) => updateDoc(doc(this.questions(), id), { report_count: counts.get(id) ?? 0 })),
    );
  }
}
