import { type DecideRequest } from '../../../../schemas/index.js';
export declare function decide(request: DecideRequest): Promise<{
    type: "decide";
    result: {
        model: string;
        answers: Record<string, {
            type: "choice";
            choice: string | number | boolean;
            probabilities: Record<string, number>;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        } | {
            type: "score";
            score: number;
            legend: Record<string, string>;
            probabilities: Record<string, number>;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        } | {
            type: "noul";
            noul: number;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        }>;
        usage: {
            inputTokens: number;
            outputTokens: number;
            stateTokens: number;
            stateTokensDropped: number;
            truncated: boolean;
            truncatedQuestions: string[];
            options?: Record<string, {
                total: number;
                distinct: number;
                tokensPerOption: number | null;
            }> | undefined;
        };
    } | {
        model: string;
        answers: Record<string, {
            type: "choice";
            choice: string | number | boolean;
            probabilities: Record<string, number>;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        } | {
            type: "score";
            score: number;
            legend: Record<string, string>;
            probabilities: Record<string, number>;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        } | {
            type: "noul";
            noul: number;
            answerConfidence: number;
            confidence: number;
            action: {
                actProbability: number;
            };
        }>;
        usage: {
            inputTokens: number;
            outputTokens: number;
            stateTokens: number;
            stateTokensDropped: number;
            truncated: boolean;
            truncatedQuestions: string[];
            options?: Record<string, {
                total: number;
                distinct: number;
                tokensPerOption: number | null;
            }> | undefined;
        };
    }[];
}>;
