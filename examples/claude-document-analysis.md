# Using OpenRouter MCP for Document Analysis in Claude

This guide shows how to use multiple Gemma instances to analyze large documents efficiently through Claude.

## Strategy: Parallel Chunk Processing

Since Gemma 3n has a 32K token context window (~25K characters), we can:
1. Split documents into chunks
2. Process multiple chunks in parallel
3. Combine results for comprehensive analysis

## Example Commands in Claude

### 1. Search a Document for Specific Information

Split your document and search each part:

```
Use the compare_models tool with models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]

Message: "Search for information about [YOUR QUERY] in these document sections:

Section 1: [First 25K characters]
Section 2: [Next 25K characters]  
Section 3: [Next 25K characters]

For each section, report any relevant findings about [YOUR QUERY]."
```

### 2. Summarize a Large Document

Process chunks and combine summaries:

```
Step 1: Use chat_with_model with google/gemma-3n-e4b-it:
"Summarize this section of a larger document: [First 25K characters]"

Step 2: Use chat_with_model with google/gemma-3n-e4b-it:
"Summarize this section of a larger document: [Next 25K characters]"

Step 3: Use chat_with_model with google/gemma-3n-e4b-it:
"Combine these section summaries into a comprehensive overview:
Summary 1: [result from step 1]
Summary 2: [result from step 2]"
```

### 3. Extract Specific Information

Use multiple instances to extract different types of information:

```
Use compare_models with models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]

Message: "Analyze this document and extract:
1. Key findings and conclusions
2. Methodology and approach
3. Recommendations and next steps

Document: [Your document text up to 25K characters]"
```

### 4. Q&A Over Large Documents

Process questions in parallel:

```
Use compare_models with models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]

Message: "Answer these questions based on the document:
Q1: [Your first question]
Q2: [Your second question]
Q3: [Your third question]

Document section: [Relevant portion up to 25K characters]"
```

## Tips for Efficient Processing

1. **Chunk Size**: Keep chunks under 25K characters to leave room for prompts
2. **Overlap**: Include 1-2K character overlap between chunks for continuity
3. **Parallel Processing**: Use compare_models to process 3-5 chunks simultaneously
4. **Context Preservation**: Include chunk numbers and document structure in prompts
5. **Result Aggregation**: Use a final Gemma call to synthesize results from all chunks

## Example: Analyzing a 100K Character Document

```
# Split into 4 chunks of 25K each
Chunk 1: Characters 0-25,000
Chunk 2: Characters 23,000-48,000 (2K overlap)
Chunk 3: Characters 46,000-71,000 (2K overlap)
Chunk 4: Characters 69,000-100,000 (2K overlap)

# Process chunks 1-3 in parallel
Use compare_models with models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]
Message: "Search for [query] in your assigned section:
Model 1: [Chunk 1]
Model 2: [Chunk 2]
Model 3: [Chunk 3]"

# Process chunk 4 separately
Use chat_with_model with google/gemma-3n-e4b-it:
"Search for [query] in this section: [Chunk 4]"

# Combine results
Use chat_with_model with google/gemma-3n-e4b-it:
"Synthesize these findings into a comprehensive answer:
Finding 1: [Result from chunk 1]
Finding 2: [Result from chunk 2]
Finding 3: [Result from chunk 3]
Finding 4: [Result from chunk 4]"
```

## Cost Optimization

- Gemma 3n costs only $0.00000002 per prompt token
- A 25K character chunk ≈ 6K tokens ≈ $0.00012 per analysis
- Processing a 100K character document ≈ $0.0005 total

This approach maximizes Gemma's context window while maintaining low costs!