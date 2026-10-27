export declare const RAG_ACCEPT_EXTENSIONS: readonly ['.pdf', '.txt', '.md', '.markdown', '.rtf', '.html', '.htm', '.xhtml', '.log', '.json', '.jsonl', '.csv', '.tsv', '.xml', '.yaml', '.yml'];
export declare const EXEC_ATTACHABLE_EXTENSIONS: readonly ['.docx', '.xlsx', '.pptx'];
export declare const EXEC_ATTACHABLE_MIME_TYPES: readonly ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
export interface DocumentDescriptor {
    readonly fileName?: string;
    readonly mimeType?: string;
}
export declare function isExecAttachableDocument(input: DocumentDescriptor): boolean;
export declare function isKnownUnsupportedDocument(input: DocumentDescriptor): boolean;
