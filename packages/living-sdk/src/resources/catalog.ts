import type { HttpClient } from '../http';

export type CatalogKind = 'STAFF_ROLE' | 'VENDOR_CATEGORY';
export interface CatalogOption {
  /** null for a built-in default (not deletable); string for a tenant option. */
  id: string | null;
  name: string;
}

/** Tenant-managed option lists: staff roles, vendor categories. */
export class CatalogResource {
  constructor(private readonly http: HttpClient) {}

  list(kind: CatalogKind): Promise<CatalogOption[]> {
    return this.http.get('/catalog-options', { kind });
  }
  create(kind: CatalogKind, name: string): Promise<{ id: string; name: string }> {
    return this.http.post(`/catalog-options?kind=${kind}`, { name });
  }
  remove(id: string): Promise<unknown> {
    return this.http.delete(`/catalog-options/${id}`);
  }
}
