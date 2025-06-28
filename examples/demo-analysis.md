# Demo: Analyzing a Document with Multiple Gemma Instances

## Example 1: Search for Specific Information

In Claude, you can say:

```
Use the compare_models tool with:
- models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]
- message: "Search these document sections for information about AI challenges and limitations:

Section 1: 'The Evolution of Artificial Intelligence... Early pioneers like John McCarthy, Marvin Minsky, and Herbert Simon laid the theoretical foundations.'

Section 2: 'Chapter 3: Current Applications... Entertainment: Content recommendation, game AI, creative tools'

Section 3: 'Chapter 5: Challenges and Limitations... Ethical considerations and regulation'

Each model should analyze their assigned section and report findings about challenges."
- max_tokens: 500
```

## Example 2: Parallel Question Answering

```
Use the compare_models tool with:
- models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]
- message: "Based on this AI document, answer your assigned question:

Document: [First part of the document about AI evolution and current state]

Model 1: What are the key milestones in AI development?
Model 2: What are the current applications of AI?
Model 3: What are the main challenges facing AI?"
- max_tokens: 600
```

## Example 3: Document Summarization with Chunks

Step by step in Claude:

```
Step 1: "Use chat_with_model with google/gemma-3n-e4b-it to summarize this section:
'The Evolution of Artificial Intelligence... 2022: Large Language Models like GPT-3 achieve human-like text generation'"

Step 2: "Use chat_with_model with google/gemma-3n-e4b-it to summarize this section:
'Chapter 3: Current Applications... Chapter 4: Technical Foundations... Reinforcement Learning: Learning through trial and error'"

Step 3: "Use chat_with_model with google/gemma-3n-e4b-it to combine these summaries:
Summary 1: [result from step 1]
Summary 2: [result from step 2]
Create a cohesive overview of the document."
```

## Example 4: Extract Multiple Information Types

```
Use the compare_models tool with:
- models: ["google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it", "google/gemma-3n-e4b-it"]
- message: "Extract different types of information from this AI document:

[Include full document text]

Model 1: Extract all historical dates and milestones
Model 2: Extract all technical terms and technologies mentioned
Model 3: Extract all recommendations and future directions"
```

## Cost Example

For a 3,000 word document (~15,000 characters):
- Fits within single Gemma context (32K tokens)
- Cost per analysis: ~$0.00008 (at $0.00000002/token)
- Using 3 parallel instances: ~$0.00024 total
- Extremely cost-effective for comprehensive analysis!

## Tips for Claude Usage

1. **Direct MCP Tool Calls**: Ask Claude to "use the chat_with_model tool" or "use the compare_models tool"
2. **Chunk Management**: Gemma 3n handles up to 32K tokens (~25K characters) per call
3. **Parallel Processing**: compare_models runs up to 3-5 models simultaneously
4. **Result Synthesis**: Use a final model call to combine results from multiple analyses

This approach gives you the power of multiple AI instances working together to thoroughly analyze your documents!