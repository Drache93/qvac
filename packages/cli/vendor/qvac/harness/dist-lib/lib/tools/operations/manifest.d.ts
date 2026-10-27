import { z } from 'zod';
import type { ToolParameters } from '../../contract/index.ts';
declare const ResponseSchema: z.ZodUnion<readonly [z.ZodObject<{
    pick: z.ZodArray<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    decode: z.ZodEnum<{
        "gmail-message": "gmail-message";
    }>;
}, z.core.$strict>]>;
declare const OperationSchema: z.ZodObject<{
    tool: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodType<ToolParameters, unknown, z.core.$ZodTypeInternals<ToolParameters, unknown>>;
    request: z.ZodUnion<readonly [z.ZodObject<{
        transport: z.ZodLiteral<"mcp">;
        method: z.ZodString;
        url: z.ZodString;
        builder: z.ZodEnum<{
            "calendar-add-meet": "calendar-add-meet";
            "calendar-meet-event": "calendar-meet-event";
            "docs-append-text": "docs-append-text";
            "docs-create": "docs-create";
            "drive-create-folder": "drive-create-folder";
            "drive-trash": "drive-trash";
            "gmail-draft": "gmail-draft";
            "gmail-get": "gmail-get";
            "gmail-send": "gmail-send";
            "notion-create-page": "notion-create-page";
            "notion-insert-content": "notion-insert-content";
            "sheets-append-values": "sheets-append-values";
            "sheets-create": "sheets-create";
            "sheets-write-values": "sheets-write-values";
        }>;
    }, z.core.$strip>, z.ZodObject<{
        transport: z.ZodOptional<z.ZodLiteral<"http">>;
        method: z.ZodEnum<{
            DELETE: "DELETE";
            GET: "GET";
            PATCH: "PATCH";
            POST: "POST";
            PUT: "PUT";
        }>;
        url: z.ZodString;
        query: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
        urlDefaults: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        builder: z.ZodEnum<{
            "calendar-add-meet": "calendar-add-meet";
            "calendar-meet-event": "calendar-meet-event";
            "docs-append-text": "docs-append-text";
            "docs-create": "docs-create";
            "drive-create-folder": "drive-create-folder";
            "drive-trash": "drive-trash";
            "gmail-draft": "gmail-draft";
            "gmail-get": "gmail-get";
            "gmail-send": "gmail-send";
            "notion-create-page": "notion-create-page";
            "notion-insert-content": "notion-insert-content";
            "sheets-append-values": "sheets-append-values";
            "sheets-create": "sheets-create";
            "sheets-write-values": "sheets-write-values";
        }>;
    }, z.core.$strip>]>;
    response: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        pick: z.ZodArray<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        decode: z.ZodEnum<{
            "gmail-message": "gmail-message";
        }>;
    }, z.core.$strict>]>>;
}, z.core.$strip>;
export type OperationSpec = z.infer<typeof OperationSchema>;
export type OperationResponse = z.infer<typeof ResponseSchema>;
export declare function parseOperationsManifest(json: string): OperationSpec[] | null;
export {};
