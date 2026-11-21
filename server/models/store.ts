import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.ts';
import { MongooseModels } from './mongoose.ts';
import type {
  AnalysisDTO,
  BugFindingDTO,
  ConversationDTO,
  DocType,
  DocumentationDTO,
  MessageDTO,
  RepositoryDTO,
} from '../../shared/types.ts';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  roleTitle?: string;
  authProvider: 'local' | 'github' | 'hybrid';
  githubId?: string;
  githubAccessToken?: string;
  githubUsername?: string;
  githubAvatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface StoredFileChunk {
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  embedding?: number[];
}

export interface StoredRepositoryFile {
  id: string;
  repositoryId: string;
  path: string;
  language: string;
  size: number;
  lines: number;
  complexityScore: number;
  isImportant: boolean;
  summary?: string;
  chunks: StoredFileChunk[];
}

interface LocalDatabase {
  users: StoredUser[];
  repositories: RepositoryDTO[];
  repositoryFiles: StoredRepositoryFile[];
  analyses: AnalysisDTO[];
  conversations: ConversationDTO[];
  messages: MessageDTO[];
  documentations: DocumentationDTO[];
  bugReports: BugFindingDTO[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

let useMongo = false;
let localCache: LocalDatabase | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function loadLocalStore(): LocalDatabase {
  if (localCache) return localCache;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      localCache = JSON.parse(raw) as LocalDatabase;
      return localCache;
    } catch {
      console.warn('[RepoMind] Failed to parse existing store.json; initializing fresh store.');
    }
  }
  localCache = {
    users: [],
    repositories: [],
    repositoryFiles: [],
    analyses: [],
    conversations: [],
    messages: [],
    documentations: [],
    bugReports: [],
  };
  persistLocalStoreSync();
  return localCache;
}

function persistLocalStoreSync(): void {
  if (!localCache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(localCache, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function schedulePersist(): Promise<void> {
  writeQueue = writeQueue.then(() => {
    persistLocalStoreSync();
  });
  return writeQueue;
}

export async function initDatabase(): Promise<{ mode: 'mongodb' | 'local' }> {
  if (env.mongodbUri) {
    try {
      await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
      useMongo = true;
      console.log('[RepoMind] Connected to MongoDB via Mongoose.');
      return { mode: 'mongodb' };
    } catch (err) {
      console.warn(
        '[RepoMind] MongoDB connection failed, falling back to local atomic persistence:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }
  loadLocalStore();
  console.log('[RepoMind] Using local atomic persistence store at ./data/store.json');
  return { mode: 'local' };
}

export function newId(): string {
  return crypto.randomUUID();
}

function mapDoc<T>(doc: unknown): T {
  const obj = typeof (doc as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (doc as { toObject: () => Record<string, unknown> }).toObject()
    : (doc as Record<string, unknown>);
  const { _id, __v, ...rest } = obj;
  return {
    id: String(_id ?? rest.id ?? ''),
    ...rest,
    createdAt: rest.createdAt ? new Date(String(rest.createdAt)).toISOString() : undefined,
    updatedAt: rest.updatedAt ? new Date(String(rest.updatedAt)).toISOString() : undefined,
  } as unknown as T;
}

export const db = {
  // Users
  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const normalized = email.trim().toLowerCase();
    if (useMongo) {
      const doc = await MongooseModels.User.findOne({ email: normalized }).lean();
      return doc ? mapDoc<StoredUser>(doc) : null;
    }
    const store = loadLocalStore();
    return store.users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  async findUserById(id: string): Promise<StoredUser | null> {
    if (useMongo) {
      const doc = await MongooseModels.User.findById(id).lean();
      return doc ? mapDoc<StoredUser>(doc) : null;
    }
    const store = loadLocalStore();
    return store.users.find((u) => u.id === id) || null;
  },

  async findUserByGitHubId(githubId: string): Promise<StoredUser | null> {
    if (!githubId) return null;
    if (useMongo) {
      const doc = await MongooseModels.User.findOne({ githubId: String(githubId) }).lean();
      return doc ? mapDoc<StoredUser>(doc) : null;
    }
    const store = loadLocalStore();
    return store.users.find((u) => u.githubId === String(githubId)) || null;
  },

  async createUser(user: Omit<StoredUser, 'id' | 'createdAt'>): Promise<StoredUser> {
    const record: StoredUser = {
      ...user,
      authProvider: user.authProvider || (user.githubId ? 'github' : 'local'),
      id: newId(),
      email: user.email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };
    if (useMongo) {
      await MongooseModels.User.create({ _id: record.id, ...record });
      return record;
    }
    const store = loadLocalStore();
    store.users.push(record);
    await schedulePersist();
    return record;
  },

  async updateUser(id: string, patch: Partial<StoredUser>): Promise<StoredUser | null> {
    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, 1> = {};
    for (const [key, val] of Object.entries(patch)) {
      if (val === undefined) {
        unsetFields[key] = 1;
      } else {
        setFields[key] = val;
      }
    }

    if (useMongo) {
      const updateOps: Record<string, unknown> = {};
      if (Object.keys(setFields).length > 0) updateOps.$set = setFields;
      if (Object.keys(unsetFields).length > 0) updateOps.$unset = unsetFields;
      const doc = await MongooseModels.User.findByIdAndUpdate(id, updateOps, { new: true }).lean();
      return doc ? mapDoc<StoredUser>(doc) : null;
    }

    const store = loadLocalStore();
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const nextUser = { ...store.users[idx], ...setFields } as Record<string, unknown>;
    for (const key of Object.keys(unsetFields)) {
      delete nextUser[key];
    }
    store.users[idx] = nextUser as unknown as StoredUser;
    await schedulePersist();
    return store.users[idx];
  },

  // Repositories
  async listRepositoriesByUser(userId: string): Promise<RepositoryDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.Repository.find({ userId }).sort({ updatedAt: -1 }).lean();
      return docs.map((d) => mapDoc<RepositoryDTO>(d));
    }
    const store = loadLocalStore();
    return store.repositories
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async findRepositoryById(id: string): Promise<RepositoryDTO | null> {
    if (useMongo) {
      const doc = await MongooseModels.Repository.findById(id).lean();
      return doc ? mapDoc<RepositoryDTO>(doc) : null;
    }
    const store = loadLocalStore();
    return store.repositories.find((r) => r.id === id) || null;
  },

  async createRepository(
    repo: Omit<RepositoryDTO, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RepositoryDTO> {
    const now = new Date().toISOString();
    const record: RepositoryDTO = {
      ...repo,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    if (useMongo) {
      await MongooseModels.Repository.create({ _id: record.id, ...record });
      return record;
    }
    const store = loadLocalStore();
    store.repositories.push(record);
    await schedulePersist();
    return record;
  },

  async updateRepository(id: string, patch: Partial<RepositoryDTO>): Promise<RepositoryDTO | null> {
    const updatedAt = new Date().toISOString();
    if (useMongo) {
      const doc = await MongooseModels.Repository.findByIdAndUpdate(
        id,
        { $set: { ...patch, updatedAt } },
        { new: true }
      ).lean();
      return doc ? mapDoc<RepositoryDTO>(doc) : null;
    }
    const store = loadLocalStore();
    const idx = store.repositories.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    store.repositories[idx] = { ...store.repositories[idx], ...patch, updatedAt };
    await schedulePersist();
    return store.repositories[idx];
  },

  async deleteRepositoryCascade(repositoryId: string): Promise<void> {
    if (useMongo) {
      const convs = await MongooseModels.Conversation.find({ repositoryId }).select('_id').lean();
      const convIds = convs.map((c) => String(c._id));
      await Promise.all([
        MongooseModels.Repository.deleteOne({ _id: repositoryId }),
        MongooseModels.RepositoryFile.deleteMany({ repositoryId }),
        MongooseModels.Analysis.deleteMany({ repositoryId }),
        MongooseModels.Documentation.deleteMany({ repositoryId }),
        MongooseModels.BugReport.deleteMany({ repositoryId }),
        MongooseModels.Conversation.deleteMany({ repositoryId }),
        convIds.length ? MongooseModels.Message.deleteMany({ conversationId: { $in: convIds } }) : Promise.resolve(),
      ]);
      return;
    }
    const store = loadLocalStore();
    const convIds = new Set(
      store.conversations.filter((c) => c.repositoryId === repositoryId).map((c) => c.id)
    );
    store.repositories = store.repositories.filter((r) => r.id !== repositoryId);
    store.repositoryFiles = store.repositoryFiles.filter((f) => f.repositoryId !== repositoryId);
    store.analyses = store.analyses.filter((a) => a.repositoryId !== repositoryId);
    store.documentations = store.documentations.filter((d) => d.repositoryId !== repositoryId);
    store.bugReports = store.bugReports.filter((b) => b.repositoryId !== repositoryId);
    store.conversations = store.conversations.filter((c) => c.repositoryId !== repositoryId);
    store.messages = store.messages.filter((m) => !convIds.has(m.conversationId));
    await schedulePersist();
  },

  // Repository Files & Chunks
  async replaceRepositoryFiles(
    repositoryId: string,
    files: Omit<StoredRepositoryFile, 'id'>[]
  ): Promise<StoredRepositoryFile[]> {
    const records: StoredRepositoryFile[] = files.map((f) => ({
      ...f,
      id: newId(),
    }));
    if (useMongo) {
      await MongooseModels.RepositoryFile.deleteMany({ repositoryId });
      if (records.length > 0) {
        await MongooseModels.RepositoryFile.insertMany(
          records.map((r) => ({ _id: r.id, ...r }))
        );
      }
      return records;
    }
    const store = loadLocalStore();
    store.repositoryFiles = store.repositoryFiles.filter((f) => f.repositoryId !== repositoryId);
    store.repositoryFiles.push(...records);
    await schedulePersist();
    return records;
  },

  async listRepositoryFiles(repositoryId: string): Promise<StoredRepositoryFile[]> {
    if (useMongo) {
      const docs = await MongooseModels.RepositoryFile.find({ repositoryId }).lean();
      return docs.map((d) => mapDoc<StoredRepositoryFile>(d));
    }
    const store = loadLocalStore();
    return store.repositoryFiles.filter((f) => f.repositoryId === repositoryId);
  },

  async countUserFiles(userId: string): Promise<number> {
    const repos = await this.listRepositoriesByUser(userId);
    return repos.reduce((sum, r) => sum + (r.fileCount || 0), 0);
  },

  // Analysis
  async upsertAnalysis(
    repositoryId: string,
    data: Omit<AnalysisDTO, 'id' | 'repositoryId' | 'createdAt'>
  ): Promise<AnalysisDTO> {
    const record: AnalysisDTO = {
      ...data,
      id: newId(),
      repositoryId,
      createdAt: new Date().toISOString(),
    };
    if (useMongo) {
      const existing = await MongooseModels.Analysis.findOne({ repositoryId }).lean();
      if (existing) {
        const updated = await MongooseModels.Analysis.findOneAndUpdate(
          { repositoryId },
          { $set: { ...data } },
          { new: true }
        ).lean();
        return mapDoc<AnalysisDTO>(updated);
      }
      await MongooseModels.Analysis.create({ _id: record.id, ...record });
      return record;
    }
    const store = loadLocalStore();
    const idx = store.analyses.findIndex((a) => a.repositoryId === repositoryId);
    if (idx !== -1) {
      store.analyses[idx] = { ...record, id: store.analyses[idx].id };
      await schedulePersist();
      return store.analyses[idx];
    }
    store.analyses.push(record);
    await schedulePersist();
    return record;
  },

  async findAnalysisByRepo(repositoryId: string): Promise<AnalysisDTO | null> {
    if (useMongo) {
      const doc = await MongooseModels.Analysis.findOne({ repositoryId }).lean();
      return doc ? mapDoc<AnalysisDTO>(doc) : null;
    }
    const store = loadLocalStore();
    return store.analyses.find((a) => a.repositoryId === repositoryId) || null;
  },

  // Conversations & Messages
  async listConversationsByRepo(repositoryId: string, userId: string): Promise<ConversationDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.Conversation.find({ repositoryId, userId })
        .sort({ updatedAt: -1 })
        .lean();
      return docs.map((d) => mapDoc<ConversationDTO>(d));
    }
    const store = loadLocalStore();
    return store.conversations
      .filter((c) => c.repositoryId === repositoryId && c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async listRecentConversationsByUser(userId: string, limit = 6): Promise<ConversationDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.Conversation.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
      return docs.map((d) => mapDoc<ConversationDTO>(d));
    }
    const store = loadLocalStore();
    return store.conversations
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  },

  async findConversationById(id: string): Promise<ConversationDTO | null> {
    if (useMongo) {
      const doc = await MongooseModels.Conversation.findById(id).lean();
      return doc ? mapDoc<ConversationDTO>(doc) : null;
    }
    const store = loadLocalStore();
    return store.conversations.find((c) => c.id === id) || null;
  },

  async createConversation(data: {
    repositoryId: string;
    userId: string;
    title: string;
  }): Promise<ConversationDTO> {
    const now = new Date().toISOString();
    const record: ConversationDTO = {
      id: newId(),
      repositoryId: data.repositoryId,
      userId: data.userId,
      title: data.title,
      createdAt: now,
      updatedAt: now,
    };
    if (useMongo) {
      await MongooseModels.Conversation.create({ _id: record.id, ...record });
      return record;
    }
    const store = loadLocalStore();
    store.conversations.push(record);
    await schedulePersist();
    return record;
  },

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const now = new Date().toISOString();
    if (useMongo) {
      await MongooseModels.Conversation.updateOne(
        { _id: conversationId },
        { $set: { title, updatedAt: now } }
      );
      return;
    }
    const store = loadLocalStore();
    const conv = store.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.title = title;
      conv.updatedAt = now;
      await schedulePersist();
    }
  },

  async deleteConversation(conversationId: string): Promise<void> {
    if (useMongo) {
      await Promise.all([
        MongooseModels.Conversation.deleteOne({ _id: conversationId }),
        MongooseModels.Message.deleteMany({ conversationId }),
      ]);
      return;
    }
    const store = loadLocalStore();
    store.conversations = store.conversations.filter((c) => c.id !== conversationId);
    store.messages = store.messages.filter((m) => m.conversationId !== conversationId);
    await schedulePersist();
  },

  async listMessages(conversationId: string): Promise<MessageDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .lean();
      return docs.map((d) => mapDoc<MessageDTO>(d));
    }
    const store = loadLocalStore();
    return store.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createMessage(
    msg: Omit<MessageDTO, 'id' | 'createdAt'>
  ): Promise<MessageDTO> {
    const now = new Date().toISOString();
    const record: MessageDTO = {
      ...msg,
      id: newId(),
      createdAt: now,
    };
    if (useMongo) {
      await MongooseModels.Message.create({ _id: record.id, ...record });
      await MongooseModels.Conversation.updateOne(
        { _id: msg.conversationId },
        { $set: { updatedAt: now } }
      );
      return record;
    }
    const store = loadLocalStore();
    store.messages.push(record);
    const cIdx = store.conversations.findIndex((c) => c.id === msg.conversationId);
    if (cIdx !== -1) {
      store.conversations[cIdx].updatedAt = now;
    }
    await schedulePersist();
    return record;
  },

  // Bug Reports
  async replaceBugReports(
    repositoryId: string,
    findings: Omit<BugFindingDTO, 'id' | 'repositoryId' | 'createdAt'>[]
  ): Promise<BugFindingDTO[]> {
    const now = new Date().toISOString();
    const records: BugFindingDTO[] = findings.map((f) => ({
      ...f,
      id: newId(),
      repositoryId,
      createdAt: now,
    }));
    if (useMongo) {
      await MongooseModels.BugReport.deleteMany({ repositoryId });
      if (records.length > 0) {
        await MongooseModels.BugReport.insertMany(records.map((r) => ({ _id: r.id, ...r })));
      }
      return records;
    }
    const store = loadLocalStore();
    store.bugReports = store.bugReports.filter((b) => b.repositoryId !== repositoryId);
    store.bugReports.push(...records);
    await schedulePersist();
    return records;
  },

  async listBugReports(repositoryId: string): Promise<BugFindingDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.BugReport.find({ repositoryId }).lean();
      return docs.map((d) => mapDoc<BugFindingDTO>(d));
    }
    const store = loadLocalStore();
    return store.bugReports.filter((b) => b.repositoryId === repositoryId);
  },

  // Documentation
  async upsertDocumentation(
    repositoryId: string,
    type: DocType,
    title: string,
    content: string
  ): Promise<DocumentationDTO> {
    const now = new Date().toISOString();
    if (useMongo) {
      const existing = await MongooseModels.Documentation.findOne({ repositoryId, type }).lean();
      if (existing) {
        const updated = await MongooseModels.Documentation.findOneAndUpdate(
          { repositoryId, type },
          { $set: { title, content, updatedAt: now } },
          { new: true }
        ).lean();
        return mapDoc<DocumentationDTO>(updated);
      }
      const record: DocumentationDTO = {
        id: newId(),
        repositoryId,
        type,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
      await MongooseModels.Documentation.create({ _id: record.id, ...record });
      return record;
    }
    const store = loadLocalStore();
    const idx = store.documentations.findIndex(
      (d) => d.repositoryId === repositoryId && d.type === type
    );
    if (idx !== -1) {
      store.documentations[idx] = {
        ...store.documentations[idx],
        title,
        content,
        updatedAt: now,
      };
      await schedulePersist();
      return store.documentations[idx];
    }
    const record: DocumentationDTO = {
      id: newId(),
      repositoryId,
      type,
      title,
      content,
      createdAt: now,
      updatedAt: now,
    };
    store.documentations.push(record);
    await schedulePersist();
    return record;
  },

  async listDocumentation(repositoryId: string): Promise<DocumentationDTO[]> {
    if (useMongo) {
      const docs = await MongooseModels.Documentation.find({ repositoryId }).lean();
      return docs.map((d) => mapDoc<DocumentationDTO>(d));
    }
    const store = loadLocalStore();
    return store.documentations.filter((d) => d.repositoryId === repositoryId);
  },
};
