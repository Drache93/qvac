import { z } from 'zod';
export declare const GmailEnvelopeSchema: z.ZodObject<{
    to: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    cc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    bcc: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    subject: z.ZodString;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    replyTo: z.ZodOptional<z.ZodString>;
    inReplyTo: z.ZodOptional<z.ZodString>;
    references: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GmailEnvelope = z.infer<typeof GmailEnvelopeSchema>;
export declare function buildGmailMessage(envelope: GmailEnvelope): string;
