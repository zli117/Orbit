import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

/**
 * Render markdown to sanitized HTML, safe for use with {@html}.
 */
export function renderMarkdown(text: string): string {
	return DOMPurify.sanitize(marked.parse(text) as string);
}
