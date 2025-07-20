# Local-docs-mcp development plan

The local-docs-mcp server represents a sophisticated solution for intelligent local documentation search, combining vector embeddings with the Model Context Protocol to provide seamless AI-powered search capabilities. This development plan integrates cutting-edge research on text chunking, vector databases, and MCP architecture to deliver a production-ready TypeScript server that indexes local documentation and provides configurable search with rich contextual results.

## Phase 1: Foundation and architecture setup

The project foundation centers on a robust MCP server architecture using the official TypeScript SDK. **The server will implement a three-layer architecture**: the MCP interface layer handling protocol communication, the indexing engine managing document processing and storage, and the search layer providing vector similarity operations through sqlite-vec.

**Core project structure** follows established MCP patterns with TypeScript ES modules. The main entry point at `src/index.ts` initializes the MCP server with stdio transport, while modular components handle specific functionality. Key directories include `src/indexing/` for document processing, `src/search/` for vector operations, `src/database/` for sqlite-vec integration, and `src/types/` for TypeScript interfaces.

**Essential dependencies** include the @modelcontextprotocol/sdk for MCP functionality, sqlite-vec for vector storage, better-sqlite3 for database operations, chokidar for file system monitoring, and fdir for efficient directory traversal. Development dependencies encompass TypeScript configuration, testing frameworks, and build tools optimized for ES module output.

The **configuration system** supports environment variables and JSON configuration files, enabling flexible deployment across different documentation repositories. Configuration options include documentation paths, supported file extensions, embedding model selection, chunking parameters, and search behavior settings.

## Phase 2: Database schema and vector storage

**SQLite-vec integration** forms the core of the document storage system, leveraging its efficient vector search capabilities optimized for local deployment. The database schema implements a dual-table approach: a primary documents table storing metadata and file information, and a vector table managing embeddings with spatial indexing.

```sql
-- Primary document tracking table
CREATE TABLE documents (
    doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT UNIQUE NOT NULL,
    file_hash TEXT NOT NULL,
    last_modified INTEGER NOT NULL,
    indexed_at INTEGER DEFAULT (unixepoch()),
    file_size INTEGER,
    document_type TEXT,
    chunk_count INTEGER DEFAULT 0
);

-- Vector embeddings with metadata
CREATE VIRTUAL TABLE document_embeddings USING vec0(
    chunk_id INTEGER PRIMARY KEY,
    doc_id INTEGER,
    embedding FLOAT[384],           -- BGE-small dimensions
    chunk_index INTEGER,
    chunk_start INTEGER,
    chunk_end INTEGER,
    chunk_text TEXT,
    before_context TEXT,
    after_context TEXT
);
```

**Vector storage optimization** uses BGE-M3 or Stella-400M embeddings for optimal balance of accuracy and local deployment efficiency. The system supports **configurable embedding dimensions** from 256 to 1536, with dimension truncation for storage optimization when needed.

**Incremental indexing tracking** maintains modification timestamps and file hashes to detect changes efficiently. A separate index_status table tracks processing state and enables recovery from interrupted indexing operations. The schema supports **partition-based searches** using doc_id filtering for directory-constrained queries.

## Phase 3: Text chunking and preprocessing implementation

**Advanced chunking strategy** implements research-backed optimal chunk sizes of 300-500 tokens for technical documentation, with 20% overlap to preserve context boundaries. The chunking engine uses structure-aware splitting that respects document hierarchy, preserving code blocks, tables, and markdown formatting.

**Multi-strategy chunking approach** supports three primary methods: sentence-boundary chunking for natural language processing, semantic chunking using embedding similarity for coherent segments, and hierarchical chunking that maintains document structure relationships. Each chunk includes contextual information from surrounding sections to improve search relevance.

```typescript
interface ChunkingConfig {
    strategy: 'sentence' | 'semantic' | 'hierarchical';
    targetTokens: number;        // 300-500 optimal range
    overlapRatio: number;        // 0.2 for 20% overlap
    minChunkTokens: number;      // Minimum viable chunk size
    maxChunkTokens: number;      // Maximum chunk size
    preserveStructure: boolean;   // Maintain markdown/code formatting
}
```

**Document preprocessing pipeline** handles multiple formats including Markdown, plain text, code files, and PDFs. Markdown processing preserves hierarchical structure while extracting clean text for embedding. Code file processing maintains syntax highlighting markers and extracts documentation comments. The pipeline includes content cleaning to remove artifacts and normalize whitespace while preserving semantic meaning.

**Context enrichment** adds surrounding context to each chunk, including document title, section headers, and adjacent content snippets. This contextual information improves embedding quality and search relevance without significantly increasing storage requirements.

## Phase 4: File system monitoring and crawling

**High-performance crawling system** uses fdir for initial directory traversal, capable of processing hundreds of thousands of files in under a minute. The crawler implements **configurable filtering** supporting glob patterns, file size limits, and extension allowlists for security and performance optimization.

**Real-time file monitoring** leverages chokidar for cross-platform file system watching with proper event normalization. The monitoring system handles atomic writes, batch operations, and symbolic link traversal while avoiding duplicate processing. Configuration options include polling intervals, stability thresholds, and depth limits for recursive watching.

```typescript
interface CrawlerConfig {
    watchPaths: string[];
    allowedExtensions: string[];
    maxFileSize: number;           // 50MB default limit
    ignorePatterns: string[];      // Glob patterns to exclude
    concurrency: number;           // Processing concurrency
    batchSize: number;             // Database batch operations
    stabilityThreshold: number;    // File write completion detection
}
```

**Incremental indexing strategy** compares file modification times against stored timestamps, processing only changed files for efficiency. The system maintains **indexing bookmarks** to track processing state and enable resume functionality after interruption. Hash-based change detection provides additional verification for critical files.

**Queue management** implements concurrent processing with backpressure handling and exponential backoff for failed operations. The queuing system supports priority processing for recently accessed files and batch database operations for optimal performance.

## Phase 5: MCP server implementation

**MCP server architecture** follows established patterns from the TypeScript SDK, implementing the three core primitives: resources for document access, tools for search functionality, and prompts for common workflows. The server exposes both simple search tools and advanced filtering capabilities through the MCP protocol.

**Tool implementations** provide multiple search interfaces: basic similarity search, filtered search with metadata constraints, and contextual search returning structured results with before/match/after text segments. Each tool includes comprehensive input validation using Zod schemas and proper error handling with meaningful error messages.

```typescript
// Core search tool interface
const searchDocumentsSchema = z.object({
    query: z.string().min(1).describe("Search query text"),
    maxResults: z.number().int().min(1).max(50).default(10),
    directories: z.array(z.string()).optional(),
    fileTypes: z.array(z.string()).optional(),
    contextLevel: z.enum(['minimal', 'standard', 'extended']).default('standard')
});
```

**Resource implementations** expose the document index structure, indexing status, and configuration information through the MCP resource system. Resources provide both JSON and text formats, enabling LLM integration and human inspection of system state.

**Prompt implementations** offer templated workflows for common documentation tasks including document analysis, code exploration, and troubleshooting assistance. Prompts leverage the search capabilities to provide relevant context and guide effective documentation usage.

**Error handling and logging** implements structured error reporting through MCP error codes and maintains detailed logging for debugging and monitoring. The system includes health check endpoints and status reporting for production deployment scenarios.

## Phase 6: Search implementation and optimization

**Vector similarity search** implements efficient k-nearest neighbor queries through sqlite-vec's optimized brute-force search algorithm. The search engine supports **multiple similarity metrics** including cosine similarity, L2 distance, and inner product, with automatic normalization for optimal results.

**Hybrid search capability** combines vector similarity with keyword-based filtering for precise results. The system supports **metadata filtering** including file paths, modification dates, document types, and custom tags. Advanced filtering enables directory-constrained searches and temporal queries for finding recent changes.

**Result formatting** provides structured output matching the specified `{docId, before, match, text}` format with configurable context levels. The context system extracts surrounding paragraphs, section headers, and document structure to provide meaningful result context for LLM consumption.

```typescript
interface SearchResult {
    docId: number;
    before: string;      // Context before match
    match: string;       // Matching text segment
    after: string;       // Context after match
    filePath: string;
    distance: number;
    chunkIndex: number;
    metadata: {
        documentType: string;
        lastModified: Date;
        sectionTitle?: string;
    };
}
```

**Performance optimization** implements caching for frequently accessed embeddings, batch processing for multiple queries, and connection pooling for database operations. The system monitors query performance and automatically adjusts parameters for optimal response times.

**Auto-indexing functionality** triggers indexing for unprocessed directories on first search, with progress reporting and cancellation support. The indexing process runs asynchronously while serving existing search requests, ensuring responsive user experience.

## Phase 7: Configuration and deployment

**Flexible configuration system** supports JSON files, environment variables, and command-line arguments for diverse deployment scenarios. Configuration includes embedding model selection, chunking parameters, database paths, and performance tuning options. The system validates configuration on startup and provides clear error messages for invalid settings.

**Production deployment patterns** support both standalone executable and Docker containerization. The built server binary includes proper Unix signal handling for graceful shutdown and supports multiple transport protocols including stdio and HTTP for different integration scenarios.

**Integration patterns** provide examples for Claude Desktop, VS Code, and Cursor integration through MCP configuration files. The system includes templates for common deployment scenarios and troubleshooting guides for configuration issues.

**Monitoring and observability** implement structured logging with log levels, performance metrics collection, and health status reporting. The system exposes indexing progress, search performance statistics, and resource utilization through both logs and MCP resources.

## Technical specifications and performance targets

**Embedding model recommendations** prioritize BGE-M3 for multilingual support and comprehensive feature set, Stella-400M for optimal efficiency, or custom models for specialized domains. The system supports **model hot-swapping** for experiments and optimization without database recreation.

**Performance benchmarks** target sub-second search response times for typical queries, initial indexing of 10,000 documents within 60 seconds, and incremental updates processing within seconds of file changes. Memory usage remains under 512MB for typical documentation sets with efficient streaming for large files.

**Storage requirements** scale linearly with document corpus size, approximately 4MB per 1,000 typical documentation pages when using 384-dimension embeddings. Binary quantization options reduce storage by 75% with minimal accuracy impact for storage-constrained deployments.

**Scalability boundaries** optimize for documentation sets up to 100,000 files with sqlite-vec's current brute-force implementation. Future ANN index support will extend scalability to millions of documents while maintaining local deployment simplicity.

This comprehensive development plan provides the technical foundation for building a production-ready MCP server that delivers intelligent local documentation search with state-of-the-art performance and integration capabilities. The modular architecture enables incremental development while the research-backed technical decisions ensure optimal performance for the target use cases.