import { ConnectionSchema, Schema, SchemaTable } from '../types';
import { ExpandedMap } from '../stores/editor-store';

function searchTables(tables: SchemaTable[], searchRegEx: RegExp) {
  const res: SchemaTable[] = [];
  tables.forEach((table) => {
    if (
      searchRegEx.test(table.name) ||
      table.columns.some((col) => searchRegEx.test(col.name))
    ) {
      res.push(table);
    }
  });
  return res;
}

function searchDatabases(databases: Schema[], searchRegEx: RegExp) {
  const res: Schema[] = [];
  databases.forEach((db) => {
    if (searchRegEx.test(db.name)) {
      res.push(db);
    }
  });
  return res;
}

/**
 * Search connectionSchema (the hierarchy object storage of schema data) for the search string passed in
 * @param connectionSchemas
 * @param  search
 * @param expanded
 */
export default function searchSchemaInfo(
  connectionSchemas: ConnectionSchema[],
  search: string,
  expanded: ExpandedMap
) {
  if (!search.trim()) {
    return connectionSchemas;
  }

  let resultConnectionSchemas = [];

  const searchRegEx = new RegExp(search, 'i');
  for (let connectionSchema of connectionSchemas) {
    if (connectionSchema.schemas) {
      let filteredSchemas: Schema[] = [];
      connectionSchema.schemas.forEach((schema) => {
        const filteredTables = searchTables(schema.tables, searchRegEx);
        if (filteredTables.length) {
          expanded[`${connectionSchema.connectionName},${schema.name}`] = true;
          for (let table of filteredTables) {
            expanded[
              `${connectionSchema.connectionName},${schema.name},${table.name}`
            ] = true;
          }

          filteredSchemas.push({
            ...schema,
            tables: filteredTables,
          });
        }
      });

      if (filteredSchemas.length > 0) {
        expanded[connectionSchema.connectionName] = true;
        resultConnectionSchemas.push({
          ...connectionSchema,
          schemas: filteredSchemas,
        } as ConnectionSchema);
      }
    }
  }

  return resultConnectionSchemas;
}
