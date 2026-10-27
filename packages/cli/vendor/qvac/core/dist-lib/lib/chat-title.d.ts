export declare function isDefaultChatTitle(title: string | null | undefined): boolean;
export declare function buildTitlePrompt(input: string): string;
export declare function normalizeModelTitle(raw: string): string | null;
export declare function parseTitleResponse(raw: string): string | null;
export declare function deriveChatTitle(content: string): string | null;
