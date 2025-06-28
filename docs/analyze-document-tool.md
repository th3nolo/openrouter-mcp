# analyze_document Tool Documentation

The `analyze_document` tool provides production-grade parallel document analysis using multiple AI model instances. It's optimized for Google Gemma 3n-e4b-it by default but works with any OpenRouter model.

## Features

- **Parallel Processing**: Process multiple document chunks simultaneously (up to 5 instances)
- **Smart Chunking**: Automatic document splitting with configurable overlap
- **Multiple Analysis Types**: Search, summarize, extract, and Q&A
- **Cost Effective**: Uses Gemma 3n-e4b-it by default (~$0.00000002/token)
- **Production Ready**: Error handling, progress tracking, and result synthesis

## Tool Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `document` | string | required | The document content to analyze |
| `query` | string | optional | Query to focus the analysis (required for search/qa) |
| `chunk_size` | number | 25000 | Size of each chunk in characters |
| `overlap` | number | 2000 | Overlap between chunks in characters |
| `parallel_instances` | number | 3 | Number of parallel model instances (1-5) |
| `model` | string | "google/gemma-3n-e4b-it" | Model to use for analysis |
| `analysis_type` | enum | "summarize" | Type: "search", "summarize", "extract", or "qa" |
| `max_tokens` | number | 1000 | Maximum tokens per chunk analysis |
| `temperature` | number | 0.3 | Temperature for response generation |

## Analysis Types

### 1. Summarize (Default)
Creates a comprehensive summary of the document:
- Processes each chunk to create section summaries
- Combines summaries into a unified overview
- Optionally focuses on specific aspects via `query`

### 2. Search
Searches the document for specific information:
- Requires a `query` parameter
- Returns findings with section references
- Shows character positions for precise location

### 3. Extract
Extracts structured information from the document:
- Default: extracts facts, dates, names, and key info
- Use `query` to specify custom extraction targets
- Deduplicates findings across chunks

### 4. Q&A
Answers specific questions about the document:
- Requires questions in the `query` parameter
- Searches all chunks for relevant information
- Synthesizes comprehensive answers

## Usage Examples

### Basic Summarization
```json
{
  "name": "analyze_document",
  "arguments": {
    "document": "Your document content here...",
    "analysis_type": "summarize"
  }
}
```

### Focused Search
```json
{
  "name": "analyze_document", 
  "arguments": {
    "document": "Your document content here...",
    "query": "machine learning applications",
    "analysis_type": "search",
    "parallel_instances": 4
  }
}
```

### Information Extraction
```json
{
  "name": "analyze_document",
  "arguments": {
    "document": "Your document content here...",
    "query": "product features and pricing",
    "analysis_type": "extract",
    "temperature": 0.1
  }
}
```

### Multiple Questions
```json
{
  "name": "analyze_document",
  "arguments": {
    "document": "Your document content here...",
    "query": "1. What are the main findings?\n2. What methodology was used?\n3. What are the recommendations?",
    "analysis_type": "qa",
    "max_tokens": 1500
  }
}
```

## Performance Optimization

### Chunk Size Guidelines
- **25K characters** (default): Optimal for Gemma's 32K context
- **15K characters**: For documents with complex formatting
- **35K characters**: For simple text documents

### Parallel Instance Guidelines
- **1-2 instances**: Small documents (<50K chars)
- **3 instances** (default): Medium documents (50K-150K chars)
- **4-5 instances**: Large documents (>150K chars)

### Cost Optimization
- Gemma 3n-e4b-it: ~$0.00000002 per token
- Average cost per 100K character document: ~$0.0005
- Use lower `max_tokens` for cost reduction
- Set `temperature` to 0.1 for extraction tasks

## Error Handling

The tool handles various error scenarios:
- **API failures**: Continues with successful chunks
- **Token limits**: Automatically manages chunk sizes
- **Rate limiting**: Processes chunks in batches
- **Invalid input**: Validates parameters before processing

## Integration with Claude

When using with Claude Desktop:

```
Use the analyze_document tool to summarize this research paper focusing on methodology and results.
```

Claude will automatically call the tool with appropriate parameters.

## Advanced Usage

### Custom Chunk Processing
For documents with specific structure:
```json
{
  "chunk_size": 15000,
  "overlap": 3000,
  "parallel_instances": 5
}
```

### High-Precision Extraction
For accurate data extraction:
```json
{
  "analysis_type": "extract",
  "temperature": 0.1,
  "max_tokens": 2000
}
```

### Comprehensive Q&A
For detailed question answering:
```json
{
  "analysis_type": "qa",
  "parallel_instances": 4,
  "max_tokens": 2000,
  "temperature": 0.5
}
```

## Best Practices

1. **Choose the right analysis type** for your use case
2. **Adjust chunk size** based on document complexity
3. **Use overlap** to maintain context between chunks
4. **Set appropriate temperature** (lower for facts, higher for creative)
5. **Monitor costs** by checking token usage in results

## Troubleshooting

- **"Search analysis requires a query"**: Add a query parameter
- **Incomplete results**: Increase max_tokens or reduce chunk_size
- **High costs**: Reduce parallel_instances or max_tokens
- **Poor quality**: Adjust temperature or use a different model

This tool transforms the MCP server into a powerful document analysis system, making it easy to process large documents efficiently with parallel AI processing!