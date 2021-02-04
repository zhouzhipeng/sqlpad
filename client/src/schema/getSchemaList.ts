import { ConnectionSchema } from '../types';
import { ExpandedMap } from '../stores/editor-store';

interface SchemaListItem {
  type: 'connection' | 'schema' | 'table' | 'column';
  name?: string;
  description?: string;
  id: string;
  // If a column item
  dataType?: string;
  level: number;
}

/**
 * To render this schema tree with react-window
 * we need to convert this tree structure into an indented list
 *
 * @param connectionSchemas
 * @param expanded - id -> bool map of items that are expanded
 */
export default function getSchemaList(
  connectionSchemas: ConnectionSchema[],
  expanded: ExpandedMap
) {
  const schemaList: SchemaListItem[] = [];
  for (let connectionSchema of connectionSchemas) {
    schemaList.push({
      type: 'connection',
      name: connectionSchema.connectionName,
      description: '',
      id: connectionSchema.connectionId,
      level: 0,
    });
    if (expanded[connectionSchema.connectionId] && connectionSchema?.schemas) {
      connectionSchema.schemas.forEach((schema) => {
        const schemaId = `${connectionSchema.connectionId}.${schema.name}`;
        schemaList.push({
          type: 'schema',
          name: schema.name,
          description: schema.description,
          id: schemaId,
          level: 1,
        });
        if (expanded[schemaId]) {
          schema.tables.forEach((table) => {
            const tableId = `${connectionSchema.connectionId}.${schema.name}.${table.name}`;
            schemaList.push({
              type: 'table',
              name: table.name,
              description: table.description,
              id: tableId,
              level: 2,
            });
            if (expanded[tableId]) {
              table.columns.forEach((column) => {
                const columnId = `${connectionSchema.connectionId}.${schema.name}.${table.name}.${column.name}`;
                schemaList.push({
                  type: 'column',
                  name: column.name,
                  description: column.description,
                  dataType: column.dataType,
                  id: columnId,
                  level: 3,
                });
              });
            }
          });
        }
      });
    }
  }

  return schemaList;
}
