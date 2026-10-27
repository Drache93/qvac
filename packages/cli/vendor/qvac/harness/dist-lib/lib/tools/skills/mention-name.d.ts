export declare function skillMentionName(text: string): string | null;
export declare function isMentionHandle(value: string): boolean;
export interface MentionableSkill {
    readonly name: string;
    readonly displayName?: string | undefined;
}
export declare function skillMentionHandle(skill: MentionableSkill): string;
