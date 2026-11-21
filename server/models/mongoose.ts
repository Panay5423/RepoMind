import mongoose, { Schema, Model } from 'mongoose';

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: false, default: undefined },
    roleTitle: { type: String, default: undefined, trim: true },
    authProvider: {
      type: String,
      enum: ['local', 'github', 'hybrid'],
      default: 'local',
    },
    githubId: { type: String, index: true, sparse: true, default: undefined },
    githubAccessToken: { type: String, default: undefined },
    githubUsername: { type: String, default: undefined },
    githubAvatarUrl: { type: String, default: undefined },
    lastLoginAt: { type: String, default: undefined },
  },
  { timestamps: true }
);

const RepositorySchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    description: { type: String, default: '' },
    sourceType: { type: String, enum: ['github', 'zip'], required: true },
    githubUrl: { type: String },
    defaultBranch: { type: String },
    languages: { type: Schema.Types.Mixed, default: [] },
    primaryLanguage: { type: String, default: 'Unknown' },
    fileCount: { type: Number, default: 0 },
    totalLines: { type: Number, default: 0 },
    totalBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'indexing', 'analyzing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    progress: { type: Number, default: 0 },
    progressStage: { type: String, default: 'Queued' },
    errorMessage: { type: String },
    healthScore: { type: Number },
    lastAnalyzedAt: { type: String },
  },
  { timestamps: true }
);
RepositorySchema.index({ userId: 1, updatedAt: -1 });

const FileChunkSchema = new Schema(
  {
    chunkIndex: { type: Number, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    content: { type: String, default: '' },
    embedding: { type: [Number], default: undefined },
  },
  { _id: false }
);

const RepositoryFileSchema = new Schema(
  {
    _id: { type: String, required: true },
    repositoryId: { type: String, required: true, index: true },
    path: { type: String, required: true },
    language: { type: String, required: true },
    size: { type: Number, required: true },
    lines: { type: Number, required: true },
    complexityScore: { type: Number, default: 1 },
    isImportant: { type: Boolean, default: false },
    summary: { type: String },
    chunks: { type: [FileChunkSchema], default: [] },
  },
  { timestamps: true }
);
RepositoryFileSchema.index({ repositoryId: 1, path: 1 }, { unique: true });

const AnalysisSchema = new Schema(
  {
    _id: { type: String, required: true },
    repositoryId: { type: String, required: true, unique: true, index: true },
    projectOverview: { type: String, default: '' },
    architectureOverview: { type: String, default: '' },
    technologyStack: { type: [String], default: [] },
    frameworks: { type: [String], default: [] },
    importantFiles: { type: Schema.Types.Mixed, default: [] },
    importantModules: { type: Schema.Types.Mixed, default: [] },
    dependencies: { type: Schema.Types.Mixed, default: [] },
    complexityIndicators: { type: Schema.Types.Mixed, default: {} },
    architectureGraph: { type: Schema.Types.Mixed, default: { nodes: [], edges: [] } },
    healthReport: { type: Schema.Types.Mixed, default: {} },
    directoryTree: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

const ConversationSchema = new Schema(
  {
    _id: { type: String, required: true },
    repositoryId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
  },
  { timestamps: true }
);
ConversationSchema.index({ repositoryId: 1, userId: 1, updatedAt: -1 });

const MessageSchema = new Schema(
  {
    _id: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    citations: { type: Schema.Types.Mixed, default: [] },
    suggestedFollowUps: { type: [String], default: [] },
  },
  { timestamps: true }
);

const DocumentationSchema = new Schema(
  {
    _id: { type: String, required: true },
    repositoryId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['readme', 'architecture', 'api', 'installation', 'environment', 'modules'],
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);
DocumentationSchema.index({ repositoryId: 1, type: 1 }, { unique: true });

const BugReportSchema = new Schema(
  {
    _id: { type: String, required: true },
    repositoryId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['bug', 'security', 'duplication', 'quality', 'dependency'],
      required: true,
    },
    origin: {
      type: String,
      enum: ['verified_static_check', 'ai_potential_issue'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      required: true,
    },
    filePath: { type: String, required: true },
    startLine: { type: Number },
    endLine: { type: Number },
    explanation: { type: String, default: '' },
    suggestedFix: { type: String, default: '' },
  },
  { timestamps: true }
);

function getModel<T>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

export const MongooseModels = {
  User: getModel('User', UserSchema),
  Repository: getModel('Repository', RepositorySchema),
  RepositoryFile: getModel('RepositoryFile', RepositoryFileSchema),
  Analysis: getModel('Analysis', AnalysisSchema),
  Conversation: getModel('Conversation', ConversationSchema),
  Message: getModel('Message', MessageSchema),
  Documentation: getModel('Documentation', DocumentationSchema),
  BugReport: getModel('BugReport', BugReportSchema),
};
