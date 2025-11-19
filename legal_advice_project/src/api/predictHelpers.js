import streamPredict from './predictClient.js';

/**
 * Collects streamed chunks from `streamPredict` and returns the last paragraph.
 * A paragraph is defined as a block separated by one or more blank lines.
 */
export async function getLastParagraph(prompt, has_contract = false, apiKey = null) {
  let fullText = '';

  try {
    for await (const chunk of streamPredict(prompt, has_contract, apiKey)) {
      if (!chunk) continue;

      if (typeof chunk === 'string') {
        fullText += chunk;
        continue;
      }

      // chunk is an object — try common fields that may contain text
      let piece = '';
      if (typeof chunk === 'object') {
        if (chunk.text) piece = chunk.text;
        else if (chunk.content) piece = chunk.content;
        else if (chunk.output_text) piece = chunk.output_text;
        else if (chunk.output && (chunk.output.text || chunk.output.content)) piece = chunk.output.text || chunk.output.content;
        else if (chunk.choices && Array.isArray(chunk.choices)) {
          for (const c of chunk.choices) {
            if (c.delta?.content) piece += c.delta.content;
            else if (c.text) piece += c.text;
            else if (c.message?.content) piece += c.message.content;
          }
        }
      }

      if (!piece) piece = JSON.stringify(chunk);
      fullText += piece;
    }
  } catch (err) {
    throw new Error(`Error while streaming predict response: ${err && err.message}`);
  }

  // Normalize line endings and split into paragraphs (one or more blank lines)
  return fullText.trim();
}

export default getLastParagraph;
