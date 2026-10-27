import type { Flow } from './flow.ts';
import type { Story } from './story.ts';
type Esc = (value: string) => string;
export declare function flowSvg(flow: Flow, esc: Esc): string;
export declare function storyChips(story: Story, esc: Esc): string;
export {};
