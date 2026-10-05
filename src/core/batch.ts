export type PropertyValue = string | number | boolean;

export interface BatchAttribution {
  readonly referrer_host?: string;
  readonly utm?: {
    readonly source?: string;
    readonly medium?: string;
    readonly campaign?: string;
  };
  readonly from_ad_click: boolean;
}

export interface BatchEvent {
  readonly id: string;
  readonly name: string;
  readonly occurred_at: string;
  readonly session_id: string;
  readonly user_id?: string;
  readonly path: string;
  readonly attribution?: BatchAttribution;
  readonly properties?: Readonly<Record<string, PropertyValue>>;
}

export interface Batch {
  readonly key: string;
  readonly sent_at: string;
  readonly events: readonly BatchEvent[];
}

export function buildBatch(key: string, sentAt: number, events: readonly BatchEvent[]): Batch {
  return { key, sent_at: new Date(sentAt).toISOString(), events };
}

export function serializeBatch(batch: Batch): string {
  return JSON.stringify(batch);
}
