import { z } from 'zod';
import { parse, parseDocument, isMap } from 'yaml';
/** Star state lives in portable Markdown frontmatter, not a server-only index. */
export function isStarred(content: string): boolean { return metadata(content).properties.starred === true; }
export function setStarred(content: string, starred: boolean): string {
 const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(content);
 if (!match) return starred ? `---\nstarred: true\n---\n${content}` : content;
 const doc = parseDocument(match[1]);
 if (doc.errors.length || !isMap(doc.contents)) throw new Error('Fix invalid YAML frontmatter before starring this note.');
 if (starred) doc.set('starred', true); else doc.delete('starred');
 return `---\n${doc.toString()}---${match[2]}${content.slice(match[0].length)}`;
}
export function setProperty(content: string, key: 'description'|'hero'|'tags', value: string|string[]): string {
 const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(content);
 const doc = parseDocument(match?.[1] ?? '');
 if (doc.errors.length || (doc.contents && !isMap(doc.contents))) throw new Error('Fix invalid YAML frontmatter before editing note details.');
 if (value === '' || Array.isArray(value) && !value.length) doc.delete(key);
 else doc.set(key,value);
 if (!doc.contents || isMap(doc.contents) && !doc.contents.items.length) return match ? content.slice(match[0].length) : content;
 return `---\n${doc.toString()}---\n${match ? content.slice(match[0].length) : content}`;
}
export const safePath = z.string().min(1).max(240).refine(p => !/[\\\x00-\x1f<>:"|?*%]/.test(p) && !p.startsWith('/') && p.split('/').every(s => s && s !== '.' && s !== '..' && !s.startsWith('.') && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s)), 'Use a relative portable path without hidden or parent segments');
export const mutationSchema = z.object({ op: z.string().uuid(), id: z.string().uuid(), base: z.number().int().nonnegative(), path: safePath.refine(p => p.endsWith('.md'), 'Notes must end in .md'), content: z.string().max(1_000_000), deleted: z.boolean().default(false) });
export type Mutation = z.infer<typeof mutationSchema>;
export type Revision = { rev: number; path: string; content: string; deleted: boolean; time: string };
export type Note = Revision & { id: string; history: Revision[] };
export type Conflict = { id: string; mutation: Mutation; current: number; time: string };
export type Attachment = { path: string; data: string };
export type State = { version: 1; seq: number; notes: Record<string, Note>; folders?: string[]; purged?: string[]; conflicts: Conflict[]; events: { seq: number; id: string; rev: number; device: string; time: string }[]; operations: Record<string, { id: string; rev: number }>; attachments: Attachment[] };
export const emptyState = (): State => ({ version: 1, seq: 0, notes: {}, folders: [], purged: [], conflicts: [], events: [], operations: {}, attachments: [] });
export function metadata(content: string): { properties: Record<string, unknown>; aliases: string[]; tags: string[]; body: string; error?: string } {
 const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content); let properties: Record<string, unknown> = {}; let error: string | undefined;
 if (match) { try { const value = parse(match[1], { maxAliasCount: 20 }); if (value && typeof value === 'object' && !Array.isArray(value)) properties = value; else error = 'Frontmatter must be a mapping'; } catch { error = 'Invalid YAML; source preserved'; } }
 const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter((x): x is string => typeof x === 'string');
 return { properties, aliases: list(properties.aliases), tags: [...new Set([...list(properties.tags), ...Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu), m => m[1])])], body: match ? content.slice(match[0].length) : content, error };
}
export type Link = { raw: string; target: string; heading: string; label: string; wiki: boolean; start: number; end: number };
export function links(content: string): Link[] {
 // Keep source offsets; do not refactor fenced or inline code examples.
 const masked = content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, s => ' '.repeat(s.length));
 const out: Link[] = []; const re = /\[\[([^\]\n]+)\]\]|\[([^\]\n]*)\]\(([^)\s]+)\)/g; let m;
 while ((m = re.exec(masked))) { const wiki = m[1] !== undefined; const [dest, label] = wiki ? m[1].split('|') : [m[3], m[2]]; if (/^[a-z]+:/i.test(dest) || dest.startsWith('//')) continue; let decoded = dest; try { decoded = decodeURIComponent(dest); } catch {} const [target, ...heading] = decoded.split('#'); out.push({ raw: content.slice(m.index, re.lastIndex), target, heading: heading.join('#'), label: label ?? target, wiki, start: m.index, end: re.lastIndex }); }
 return out;
}
const stem = (p: string) => p.replace(/\.md$/i, '');
function relative(from: string, to: string) { const parts = from.split('/').slice(0, -1); for (const p of to.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); } return parts.join('/'); }
export function resolveLink(link: Link, source: Note, notes: Note[]): Note | undefined {
 if (!link.target) return source;
 const target = stem(link.target).toLowerCase(); const active = notes.filter(n => !n.deleted);
 const exact = active.find(n => stem(n.path).toLowerCase() === stem(relative(source.path, link.target)).toLowerCase()) ?? active.find(n => stem(n.path).toLowerCase() === target);
 if (exact) return exact;
 const candidates = active.filter(n => stem(n.path.split('/').at(-1)!).toLowerCase() === target || metadata(n.content).aliases.some(a => a.toLowerCase() === target));
 return candidates.length === 1 ? candidates[0] : undefined;
}
export function refactor(source: Note, notes: Note[], targetId: string, newPath: string): string {
 let text = source.content;
 for (const l of links(text).reverse()) if (resolveLink(l, source, notes)?.id === targetId && l.target) {
  const heading = l.heading ? `#${l.heading}` : '';
  const newTarget = l.wiki ? stem(newPath) : (() => { const a = source.path.split('/').slice(0,-1), b = newPath.split('/'); while(a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); } return '../'.repeat(a.length) + b.join('/'); })();
  const replacement = l.wiki ? `[[${newTarget}${heading}${l.raw.includes('|') ? `|${l.label}` : ''}]]` : `[${l.label}](${encodeURI(newTarget + heading)})`;
  text = text.slice(0,l.start) + replacement + text.slice(l.end);
 }
 return text;
}
