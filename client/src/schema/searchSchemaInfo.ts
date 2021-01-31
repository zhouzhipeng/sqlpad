import { ConnectionSchema, Schema, SchemaTable } from '../types';

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
 * @param connectionSchema
 * @param  search
 */
export default function searchSchemaInfo(
  connectionSchema: ConnectionSchema,
  search: string
) {
  if (!search.trim()) {
    return connectionSchema;
  }

  let filteredSchemas: Schema[] = [];
  const searchRegEx = new RegExp(search, 'i');

  if (connectionSchema.schemas) {
    filteredSchemas = searchDatabases(connectionSchema.schemas, searchRegEx);

    connectionSchema.schemas.forEach((schema) => {
      const filteredTables = searchTables(schema.tables, searchRegEx);
      const filteredSchema = { ...schema, tables: filteredTables };
      if (filteredTables.length) {
        filteredSchemas.push(filteredSchema);
      }
    });
    return { schemas: filteredSchemas } as ConnectionSchema;
  }

  if (connectionSchema.tables) {
    const filteredTables = searchTables(connectionSchema.tables, searchRegEx);
    return { tables: filteredTables } as ConnectionSchema;
  }

  return connectionSchema;
}
