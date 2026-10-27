import { randomBytes } from 'crypto';
import b4a from 'b4a';
import { z } from 'zod';
import { buildGmailMessage, GmailEnvelopeSchema } from './gmail-message.js';
export const BUILDER_POLICY_VERSION = 1;
export const BUILDER_NAMES = [
    'gmail-send',
    'gmail-draft',
    'gmail-get',
    'calendar-meet-event',
    'calendar-add-meet',
    'docs-create',
    'docs-append-text',
    'sheets-create',
    'sheets-write-values',
    'sheets-append-values',
    'drive-create-folder',
    'drive-trash',
    'notion-create-page',
    'notion-insert-content'
];
function builder(schema, build) {
    return {
        build(args) {
            const parsed = schema.safeParse(args);
            if (!parsed.success) {
                return { error: parsed.error.issues[0]?.message ?? 'invalid arguments' };
            }
            return { request: build(parsed.data) };
        }
    };
}
const GmailMessageSchema = z
    .object({ ...GmailEnvelopeSchema.shape, threadId: z.string().optional() })
    .refine((value) => !!value.text?.length || !!value.html?.length, {
    message: 'either text or html is required'
});
const gmailSend = builder(GmailMessageSchema, (args) => ({
    body: { raw: buildGmailMessage(args), threadId: args.threadId },
    encode: { raw: 'base64url' }
}));
const gmailDraft = builder(GmailMessageSchema, (args) => ({
    body: { message: { raw: buildGmailMessage(args), threadId: args.threadId } },
    encode: { 'message.raw': 'base64url' }
}));
const GmailGetSchema = z.object({
    id: z.string().min(1),
    format: z.enum(['metadata', 'full']).optional()
});
const gmailGet = builder(GmailGetSchema, (args) => ({
    query: { format: args.format ?? 'metadata' }
}));
function createRequest() {
    return {
        createRequest: {
            requestId: b4a.toHex(randomBytes(16)),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
    };
}
const MeetEventSchema = z.object({
    summary: z.string(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    timeZone: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(z.string()).optional(),
    calendarId: z.string().optional()
});
const calendarMeetEvent = builder(MeetEventSchema, (args) => ({
    body: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: { dateTime: args.start, timeZone: args.timeZone },
        end: { dateTime: args.end, timeZone: args.timeZone },
        attendees: args.attendees?.map((email) => ({ email })),
        conferenceData: createRequest()
    },
    query: { conferenceDataVersion: 1 }
}));
const AddMeetSchema = z.object({
    eventId: z.string(),
    calendarId: z.string().optional()
});
const calendarAddMeet = builder(AddMeetSchema, () => ({
    body: { conferenceData: createRequest() },
    query: { conferenceDataVersion: 1 }
}));
const docsCreate = builder(z.object({ title: z.string().min(1) }), (args) => ({
    body: { title: args.title }
}));
const DocsAppendSchema = z.object({
    documentId: z.string().min(1),
    text: z.string().min(1),
    pageBreak: z.boolean().optional()
});
const docsAppendText = builder(DocsAppendSchema, (args) => {
    const requests = [
        { insertText: { endOfSegmentLocation: {}, text: args.text } }
    ];
    if (args.pageBreak) {
        requests.push({ insertPageBreak: { endOfSegmentLocation: {} } });
    }
    return { body: { requests } };
});
const sheetsCreate = builder(z.object({ name: z.string().min(1) }), (args) => ({
    body: { name: args.name, mimeType: 'application/vnd.google-apps.spreadsheet' }
}));
const Cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const SheetsValuesSchema = z.object({
    spreadsheetId: z.string().min(1),
    range: z.string().min(1),
    values: z.array(z.array(Cell)).min(1),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']).optional()
});
const sheetsWriteValues = builder(SheetsValuesSchema, (args) => ({
    body: { range: args.range, values: args.values },
    query: { valueInputOption: args.valueInputOption ?? 'USER_ENTERED' }
}));
const sheetsAppendValues = builder(SheetsValuesSchema, (args) => ({
    body: { values: args.values },
    query: { valueInputOption: args.valueInputOption ?? 'USER_ENTERED' }
}));
const DriveFolderSchema = z.object({
    name: z.string().min(1),
    parentId: z.string().optional()
});
const driveCreateFolder = builder(DriveFolderSchema, (args) => ({
    body: {
        name: args.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: args.parentId ? [args.parentId] : undefined
    }
}));
const driveTrash = builder(z.object({ fileId: z.string().min(1) }), () => ({
    body: { trashed: true }
}));
const NotionCreatePageSchema = z
    .object({
    title: z.string().min(1),
    content: z.string().optional(),
    parentPageId: z.string().optional(),
    parentDatabaseId: z.string().optional()
})
    .refine((value) => !(value.parentPageId && value.parentDatabaseId), {
    message: 'pass parentPageId or parentDatabaseId, not both'
});
function notionParent(args) {
    if (args.parentPageId) {
        return { page_id: args.parentPageId };
    }
    if (args.parentDatabaseId) {
        return { database_id: args.parentDatabaseId };
    }
    return undefined;
}
const notionCreatePage = builder(NotionCreatePageSchema, (args) => ({
    params: {
        parent: notionParent(args),
        pages: [{ properties: { title: args.title }, content: args.content }]
    }
}));
const NotionInsertSchema = z.object({
    pageId: z.string().min(1),
    content: z.string().min(1),
    position: z.enum(['start', 'end']).optional()
});
const notionInsertContent = builder(NotionInsertSchema, (args) => ({
    params: {
        page_id: args.pageId,
        command: 'insert_content',
        content: args.content,
        position: args.position === 'start' ? { type: 'start' } : undefined
    }
}));
export const BUILDERS = {
    'gmail-send': gmailSend,
    'gmail-draft': gmailDraft,
    'gmail-get': gmailGet,
    'calendar-meet-event': calendarMeetEvent,
    'calendar-add-meet': calendarAddMeet,
    'docs-create': docsCreate,
    'docs-append-text': docsAppendText,
    'sheets-create': sheetsCreate,
    'sheets-write-values': sheetsWriteValues,
    'sheets-append-values': sheetsAppendValues,
    'drive-create-folder': driveCreateFolder,
    'drive-trash': driveTrash,
    'notion-create-page': notionCreatePage,
    'notion-insert-content': notionInsertContent
};
