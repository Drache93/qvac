import { z } from 'zod';
export declare const decisionStateSchema: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
export declare const decisionQuestionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
    instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"score">;
    criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
    instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"noul">;
    criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
    }, z.core.$strict>>>;
    labels: z.ZodOptional<z.ZodObject<{
        false: z.ZodString;
        true: z.ZodString;
    }, z.core.$strict>>;
    instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
}, z.core.$strict>], "type">;
export declare const decisionSingleRequestSchema: z.ZodObject<{
    state: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const decisionBatchRequestSchema: z.ZodObject<{
    states: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const decisionRequestSchema: z.ZodUnion<readonly [z.ZodObject<{
    state: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>, z.ZodObject<{
    states: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>]>;
export declare const decideParamsSchema: z.ZodUnion<readonly [z.ZodObject<{
    state: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    states: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodString;
}, z.core.$strict>]>;
export declare const decideRequestSchema: z.ZodUnion<readonly [z.ZodObject<{
    state: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"decide">;
    requestId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    states: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
    questions: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        criteria: z.ZodUnion<readonly [z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>]>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        criteria: z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        criteria: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            true: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
            false: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>>>;
        }, z.core.$strict>>>;
        labels: z.ZodOptional<z.ZodObject<{
            false: z.ZodString;
            true: z.ZodString;
        }, z.core.$strict>>;
        instructions: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodArray<z.ZodUnknown>]>;
        optionOrder: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strict>], "type">>;
    maxLen: z.ZodOptional<z.ZodNumber>;
    headMaxLen: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"decide">;
    requestId: z.ZodOptional<z.ZodString>;
    modelId: z.ZodString;
}, z.core.$strict>]>;
export declare const decisionAnswerSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
    probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
    answerConfidence: z.ZodNumber;
    confidence: z.ZodNumber;
    action: z.ZodObject<{
        actProbability: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"score">;
    score: z.ZodNumber;
    legend: z.ZodRecord<z.ZodString, z.ZodString>;
    probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
    answerConfidence: z.ZodNumber;
    confidence: z.ZodNumber;
    action: z.ZodObject<{
        actProbability: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"noul">;
    noul: z.ZodNumber;
    answerConfidence: z.ZodNumber;
    confidence: z.ZodNumber;
    action: z.ZodObject<{
        actProbability: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
export declare const decisionResultSchema: z.ZodObject<{
    model: z.ZodString;
    answers: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        score: z.ZodNumber;
        legend: z.ZodRecord<z.ZodString, z.ZodString>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        noul: z.ZodNumber;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        stateTokens: z.ZodNumber;
        stateTokensDropped: z.ZodNumber;
        truncated: z.ZodBoolean;
        truncatedQuestions: z.ZodArray<z.ZodString>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            total: z.ZodNumber;
            distinct: z.ZodNumber;
            tokensPerOption: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const decisionResponseSchema: z.ZodUnion<readonly [z.ZodObject<{
    model: z.ZodString;
    answers: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        score: z.ZodNumber;
        legend: z.ZodRecord<z.ZodString, z.ZodString>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        noul: z.ZodNumber;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        stateTokens: z.ZodNumber;
        stateTokensDropped: z.ZodNumber;
        truncated: z.ZodBoolean;
        truncatedQuestions: z.ZodArray<z.ZodString>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            total: z.ZodNumber;
            distinct: z.ZodNumber;
            tokensPerOption: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    model: z.ZodString;
    answers: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"score">;
        score: z.ZodNumber;
        legend: z.ZodRecord<z.ZodString, z.ZodString>;
        probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"noul">;
        noul: z.ZodNumber;
        answerConfidence: z.ZodNumber;
        confidence: z.ZodNumber;
        action: z.ZodObject<{
            actProbability: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>;
    usage: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        stateTokens: z.ZodNumber;
        stateTokensDropped: z.ZodNumber;
        truncated: z.ZodBoolean;
        truncatedQuestions: z.ZodArray<z.ZodString>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            total: z.ZodNumber;
            distinct: z.ZodNumber;
            tokensPerOption: z.ZodNullable<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>>]>;
export declare const decideResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"decide">;
    result: z.ZodUnion<readonly [z.ZodObject<{
        model: z.ZodString;
        answers: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"choice">;
            choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
            probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"score">;
            score: z.ZodNumber;
            legend: z.ZodRecord<z.ZodString, z.ZodString>;
            probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"noul">;
            noul: z.ZodNumber;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>], "type">>;
        usage: z.ZodObject<{
            inputTokens: z.ZodNumber;
            outputTokens: z.ZodNumber;
            stateTokens: z.ZodNumber;
            stateTokensDropped: z.ZodNumber;
            truncated: z.ZodBoolean;
            truncatedQuestions: z.ZodArray<z.ZodString>;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                total: z.ZodNumber;
                distinct: z.ZodNumber;
                tokensPerOption: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodArray<z.ZodObject<{
        model: z.ZodString;
        answers: z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<[z.ZodObject<{
            type: z.ZodLiteral<"choice">;
            choice: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
            probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"score">;
            score: z.ZodNumber;
            legend: z.ZodRecord<z.ZodString, z.ZodString>;
            probabilities: z.ZodRecord<z.ZodString, z.ZodNumber>;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"noul">;
            noul: z.ZodNumber;
            answerConfidence: z.ZodNumber;
            confidence: z.ZodNumber;
            action: z.ZodObject<{
                actProbability: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>], "type">>;
        usage: z.ZodObject<{
            inputTokens: z.ZodNumber;
            outputTokens: z.ZodNumber;
            stateTokens: z.ZodNumber;
            stateTokensDropped: z.ZodNumber;
            truncated: z.ZodBoolean;
            truncatedQuestions: z.ZodArray<z.ZodString>;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
                total: z.ZodNumber;
                distinct: z.ZodNumber;
                tokensPerOption: z.ZodNullable<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>>]>;
}, z.core.$strip>;
export declare const decisionConfigBaseSchema: z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
    }>>;
    gpu_layers: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    poll: z.ZodOptional<z.ZodNumber>;
    pollBatch: z.ZodOptional<z.ZodNumber>;
    threads: z.ZodOptional<z.ZodNumber>;
    'threads-batch': z.ZodOptional<z.ZodNumber>;
    flash_attn: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        on: "on";
        off: "off";
    }>>;
    verbosity: z.ZodOptional<z.ZodNumber>;
    'main-gpu': z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodEnum<{
        integrated: "integrated";
        dedicated: "dedicated";
    }>]>>;
    'split-mode': z.ZodOptional<z.ZodEnum<{
        none: "none";
        layer: "layer";
    }>>;
    'tensor-split': z.ZodOptional<z.ZodString>;
    openclCacheDir: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type DecisionConfigInput = z.infer<typeof decisionConfigBaseSchema>;
export declare const DECISION_CONFIG_DEFAULTS: {
    readonly device: "gpu";
};
export declare const decisionConfigSchema: z.ZodPipe<z.ZodObject<{
    device: z.ZodOptional<z.ZodEnum<{
        cpu: "cpu";
        gpu: "gpu";
    }>>;
    gpu_layers: z.ZodOptional<z.ZodNumber>;
    batch_size: z.ZodOptional<z.ZodNumber>;
    poll: z.ZodOptional<z.ZodNumber>;
    pollBatch: z.ZodOptional<z.ZodNumber>;
    threads: z.ZodOptional<z.ZodNumber>;
    'threads-batch': z.ZodOptional<z.ZodNumber>;
    flash_attn: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        on: "on";
        off: "off";
    }>>;
    verbosity: z.ZodOptional<z.ZodNumber>;
    'main-gpu': z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodEnum<{
        integrated: "integrated";
        dedicated: "dedicated";
    }>]>>;
    'split-mode': z.ZodOptional<z.ZodEnum<{
        none: "none";
        layer: "layer";
    }>>;
    'tensor-split': z.ZodOptional<z.ZodString>;
    openclCacheDir: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodTransform<{
    device: "cpu" | "gpu";
    gpu_layers?: number | undefined;
    batch_size?: number | undefined;
    poll?: number | undefined;
    pollBatch?: number | undefined;
    threads?: number | undefined;
    'threads-batch'?: number | undefined;
    flash_attn?: "auto" | "on" | "off" | undefined;
    verbosity?: number | undefined;
    'main-gpu'?: number | "integrated" | "dedicated" | undefined;
    'split-mode'?: "none" | "layer" | undefined;
    'tensor-split'?: string | undefined;
    openclCacheDir?: string | undefined;
}, {
    device?: "cpu" | "gpu" | undefined;
    gpu_layers?: number | undefined;
    batch_size?: number | undefined;
    poll?: number | undefined;
    pollBatch?: number | undefined;
    threads?: number | undefined;
    'threads-batch'?: number | undefined;
    flash_attn?: "auto" | "on" | "off" | undefined;
    verbosity?: number | undefined;
    'main-gpu'?: number | "integrated" | "dedicated" | undefined;
    'split-mode'?: "none" | "layer" | undefined;
    'tensor-split'?: string | undefined;
    openclCacheDir?: string | undefined;
}>>;
export type DecisionState = z.infer<typeof decisionStateSchema>;
export type DecisionQuestion = z.infer<typeof decisionQuestionSchema>;
export type DecisionAnswer = z.infer<typeof decisionAnswerSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;
export type DecisionRequest = z.infer<typeof decisionRequestSchema>;
type InferredDecideParams = z.infer<typeof decideParamsSchema>;
export type DecideParams = (Extract<InferredDecideParams, {
    state: unknown;
}> & {
    states?: never;
}) | (Extract<InferredDecideParams, {
    states: unknown;
}> & {
    state?: never;
});
export type DecideRequest = z.infer<typeof decideRequestSchema>;
export type DecisionConfig = z.infer<typeof decisionConfigSchema>;
export {};
