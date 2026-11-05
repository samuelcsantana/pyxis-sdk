import { bareHost } from './attribution.js';
import type { PropertyValue } from './batch.js';
import { MAX_PROPERTY_STRING_LENGTH } from './event-input.js';
import { cutToWholeSegments, templatePath } from './path-template.js';

export const OUTBOUND_LINK_EVENT = 'outbound_link_clicked';
export const FILE_DOWNLOAD_EVENT = 'file_downloaded';
export const FORM_SUBMIT_EVENT = 'form_submitted';

export const DEFAULT_DOWNLOAD_EXTENSIONS: readonly string[] = [
  '7z',
  'apk',
  'avi',
  'csv',
  'dmg',
  'doc',
  'docx',
  'epub',
  'exe',
  'gz',
  'iso',
  'key',
  'mov',
  'mp3',
  'mp4',
  'msi',
  'odp',
  'ods',
  'odt',
  'pdf',
  'pkg',
  'ppt',
  'pptx',
  'rar',
  'rtf',
  'tar',
  'txt',
  'wav',
  'xls',
  'xlsx',
  'zip',
];

const WEB_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const EXTENSION_PATTERN = /^[a-z0-9]{1,10}$/;
const LEADING_DOTS = /^\.+/;

export interface AutoEventsOptions {
  readonly outboundLinks?: boolean;
  readonly fileDownloads?: boolean;
  readonly downloadExtensions?: readonly string[];
  readonly formSubmits?: boolean;
  readonly debug?: boolean;
}

export interface ResolvedAutoEvents {
  readonly outboundLinks: boolean;
  readonly fileDownloads: boolean;
  readonly downloadExtensions: ReadonlySet<string>;
  readonly formSubmits: boolean;
}

export interface AutoEvent {
  readonly name: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
}

export interface LinkClick {
  readonly href: string;
  readonly baseUrl: string;
  readonly ownHost: string;
  readonly hasDownloadAttribute: boolean;
}

export interface SubmittedForm {
  readonly id: string | null;
  readonly name: string | null;
}

function normalizedExtension(extension: string): string {
  return extension.trim().toLowerCase().replace(LEADING_DOTS, '');
}

export function resolveAutoEvents(options: AutoEventsOptions): ResolvedAutoEvents {
  const extensions = options.downloadExtensions ?? DEFAULT_DOWNLOAD_EXTENSIONS;
  return {
    outboundLinks: options.outboundLinks === true,
    fileDownloads: options.fileDownloads === true,
    downloadExtensions: new Set(
      extensions.map(normalizedExtension).filter((extension) => EXTENSION_PATTERN.test(extension)),
    ),
    formSubmits: options.formSubmits === true,
  };
}

export function watchesLinks(options: ResolvedAutoEvents): boolean {
  return options.outboundLinks || options.fileDownloads;
}

function webUrlOf(href: string, baseUrl: string): URL | undefined {
  try {
    const url = new URL(href, baseUrl);
    return WEB_PROTOCOLS.includes(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

function extensionOf(pathname: string): string | undefined {
  const fileName = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = fileName.lastIndexOf('.');
  const extension = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  return EXTENSION_PATTERN.test(extension) ? extension : undefined;
}

function downloadOf(
  url: URL,
  hasDownloadAttribute: boolean,
  extensions: ReadonlySet<string>,
): AutoEvent | undefined {
  const extension = extensionOf(url.pathname);
  const isListed = extension !== undefined && extensions.has(extension);
  if (!isListed && !hasDownloadAttribute) {
    return undefined;
  }
  const filePath = cutToWholeSegments(templatePath(url.pathname, []), MAX_PROPERTY_STRING_LENGTH);
  return {
    name: FILE_DOWNLOAD_EVENT,
    properties:
      extension === undefined ? { file_path: filePath } : { extension, file_path: filePath },
  };
}

function outboundOf(url: URL, ownHost: string): AutoEvent | undefined {
  const domain = bareHost(url.hostname);
  const isOutbound = domain.length <= MAX_PROPERTY_STRING_LENGTH && domain !== bareHost(ownHost);
  return isOutbound ? { name: OUTBOUND_LINK_EVENT, properties: { domain } } : undefined;
}

export function linkEventOf(click: LinkClick, options: ResolvedAutoEvents): AutoEvent | undefined {
  const url = webUrlOf(click.href, click.baseUrl);
  if (url === undefined) {
    return undefined;
  }
  const download = options.fileDownloads
    ? downloadOf(url, click.hasDownloadAttribute, options.downloadExtensions)
    : undefined;
  if (download !== undefined) {
    return download;
  }
  return options.outboundLinks ? outboundOf(url, click.ownHost) : undefined;
}

function formLabel(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= MAX_PROPERTY_STRING_LENGTH ? trimmed : undefined;
}

export function formEventOf(form: SubmittedForm): AutoEvent {
  const label = formLabel(form.id) ?? formLabel(form.name);
  return {
    name: FORM_SUBMIT_EVENT,
    properties: label === undefined ? {} : { form: label },
  };
}
