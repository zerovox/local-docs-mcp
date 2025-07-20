Product Development Plan: local-docs-mcp
1. Project Overview
   Objective: Develop local-docs-mcp, a Node.js-based MCP server written in TypeScript that crawls local documentation, stores vector embeddings in a SQLite database using sqlite-vec, and provides search functionality over the documentation corpus with configurable context levels.
   Key Features:

Crawls local documentation files and folders.
Stores raw text and vector embeddings in a SQLite database using sqlite-vec.
Provides search functionality via MCP server, returning results with {docId, before, match, text}.
Supports configurable text chunking (with optional overlapping chunks).
Tracks indexed paths and last index times to optimize re-indexing.
Allows directory-constrained searches, indexing unindexed directories on demand.

Tech Stack:

Language: TypeScript
Runtime: Node.js
MCP Integration: modelcontextprotocol/typescript-sdk
Database: SQLite with sqlite-vec for vector embeddings
Documentation: https://alexgarcia.xyz/sqlite-vec/js.html

2. System Architecture
   2.1 Database Schema
   The SQLite database will store:

Paths Table: Tracks files and folders being indexed.
Columns: path (TEXT, PRIMARY KEY), is_directory (BOOLEAN), last_indexed (DATETIME)


Documents Table: Stores raw text and metadata.
Columns: docId (TEXT, PRIMARY KEY), path (TEXT), raw_text (TEXT), last_modified (DATETIME)


Chunks Table: Stores text chunks and their embeddings.
Columns: chunkId (TEXT, PRIMARY KEY), docId (TEXT), start_offset (INTEGER), end_offset (INTEGER), text (TEXT), embedding (VEC)


Constraints:
Foreign key: Chunks.docId references Documents.docId.
Foreign key: Documents.path references Paths.path.



2.2 Indexing Process

Crawler: Recursively scans specified directories for documentation files (e.g., .md, .txt, .pdf).
Text Extraction: Extracts raw text from files (using appropriate parsers for different file types).
Chunking: Splits raw text into configurable chunks (e.g., 500 characters, with optional overlap of 100 characters).
Embedding Generation: Uses MCP SDK to generate vector embeddings for each chunk.
Storage: Saves paths, documents, chunks, and embeddings in SQLite.

2.3 Search Process

Query Handling: Accepts search queries via MCP server.
Directory Constraint: Filters results by directory using SQL WHERE clause on Paths.path.
Vector Search: Uses sqlite-vec to perform similarity search on embeddings.
Result Formatting: Returns {docId, before, match, text} with configurable context (e.g., before includes N characters before the match).
On-Demand Indexing: If a requested directory is unindexed or outdated, triggers indexing before returning results.

2.4 MCP Server

Exposes endpoints for:
Indexing directories.
Searching documentation with optional directory constraints.
Configuring chunk size and overlap.


Integrates with typescript-sdk for MCP compliance.

3. Development Phases
   Phase 1: Setup and Core Infrastructure (2-3 weeks)

Goals:
Set up TypeScript/Node.js project with dependencies (sqlite-vec, MCP SDK).
Initialize SQLite database with schema.
Implement basic file crawler for common documentation formats.


Deliverables:
Project repository with package.json and TypeScript configuration.
SQLite database with Paths, Documents, and Chunks tables.
Basic crawler for .md and .txt files.


Tasks:
Install dependencies: npm install @modelcontextprotocol/typescript-sdk sqlite-vec.
Create SQLite database with sqlite-vec integration.
Write crawler using Node.js fs module to scan directories and files.



Phase 2: Indexing and Embedding (3-4 weeks)

Goals:
Implement text extraction and chunking logic.
Generate and store vector embeddings using MCP SDK and sqlite-vec.
Track indexing metadata (e.g., last index time).


Deliverables:
Text extraction for .md, .txt, and .pdf (using pdf-parse or similar).
Configurable chunking with overlap support.
Embedding generation and storage in Chunks table.


Tasks:
Implement chunking logic (e.g., 500-char chunks with 100-char overlap).
Use MCP SDK to generate embeddings for each chunk.
Store embeddings in sqlite-vec with proper indexing.



Phase 3: MCP Server and Search (3-4 weeks)

Goals:
Build MCP server with search and indexing endpoints.
Implement vector-based search with directory constraints.
Format search results with {docId, before, match, text}.


Deliverables:
MCP server with endpoints:
POST /index: Indexes a directory.
POST /search: Searches with query and optional directory.
GET /config: Retrieves chunking configuration.
PUT /config: Updates chunk size and overlap.


Search functionality with sqlite-vec similarity queries.


Tasks:
Set up MCP server using typescript-sdk.
Implement SQL queries for directory-constrained search.
Format search results with configurable context.



Phase 4: Testing and Optimization (2-3 weeks)

Goals:
Ensure robust indexing and search performance.
Handle edge cases (e.g., large files, missing directories).
Optimize embedding storage and query performance.


Deliverables:
Unit tests for crawler, chunking, and search.
Performance benchmarks for indexing and search.
Documentation for setup and usage.


Tasks:
Write tests using Jest or Mocha.
Optimize SQLite queries with indexes.
Document API endpoints and configuration options.



Phase 5: Deployment and Documentation (1-2 weeks)

Goals:
Package library for npm distribution.
Provide comprehensive documentation and examples.


Deliverables:
Published npm package.
README with setup, usage, and API documentation.
Example project demonstrating indexing and search.


Tasks:
Create README.md with installation and usage instructions.
Publish to npm with proper versioning.
Set up example project in repository.



4. Implementation Details
   4.1 Chunking Configuration

Default: 500-character chunks with 100-character overlap.
Configurable via:
API endpoint (PUT /config).
Environment variables or configuration file.


Why Overlap?: Overlapping chunks ensure embeddings capture contextual relationships across chunk boundaries, improving search relevance.

4.2 Indexing Logic

Check Paths table for last_indexed vs. file last_modified.
If outdated or unindexed, crawl directory, extract text, chunk, generate embeddings, and update database.
Use transactions to ensure atomic updates.

4.3 Search Logic

SQL Query Example:SELECT c.chunkId, c.docId, c.text, d.raw_text, p.path
FROM Chunks c
JOIN Documents d ON c.docId = d.docId
JOIN Paths p ON d.path = p.path
WHERE p.path LIKE ? AND vector_similarity(c.embedding, ?)
LIMIT 10;


Directory constraint: p.path LIKE 'directory/%'.
Context extraction: Use start_offset and end_offset to extract before and match from raw_text.

4.4 Error Handling

Handle missing files or directories.
Retry failed embeddings with exponential backoff.
Log indexing and search errors for debugging.

5. Risks and Mitigation

Risk: Large files slow down indexing.
Mitigation: Implement streaming for text extraction and chunking.


Risk: High memory usage for embeddings.
Mitigation: Batch embedding generation and optimize sqlite-vec storage.


Risk: MCP SDK compatibility issues.
Mitigation: Pin SDK version and test thoroughly.



6. Timeline

Total Duration: 11-16 weeks
Phase Breakdown:
Phase 1: 2-3 weeks
Phase 2: 3-4 weeks
Phase 3: 3-4 weeks
Phase 4: 2-3 weeks
Phase 5: 1-2 weeks



7. Success Metrics

Indexing completes for a 1GB documentation corpus in <5 minutes.
Search returns relevant results in <500ms for 90% of queries.
100% test coverage for core functionality.
Successful npm publication and example project execution.
