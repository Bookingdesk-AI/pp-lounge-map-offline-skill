import catalogData from './data/catalog.json' with { type: 'json' };
import { createCatalogStore } from './catalog-core.js';

const store = createCatalogStore(catalogData);

export const { getCatalogMeta, getFiltersResource, getLoungeById, getAllLounges, searchLounges } = store;
export { createCatalogStore };
