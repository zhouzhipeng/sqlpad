require('../typedefs');
const router = require('express').Router();
const mustHaveConnectionAccess = require('../middleware/must-have-connection-access.js');
const ConnectionClient = require('../lib/connection-client');
const wrap = require('../lib/wrap');
const mustBeAuthenticated = require('../middleware/must-be-authenticated');

/**
 * @param {Req} req
 * @param {Res} res
 */
async function getConnectionSchema(req, res) {
  const { models, user } = req;
  const { connectionId } = req.params;
  const reload = req.query.reload === 'true';

  const conn = await models.connections.findOneById(connectionId);

  if (!conn) {
    return res.utils.notFound();
  }

  const connectionClient = new ConnectionClient(conn, user);
  const schemaCacheId = connectionClient.getSchemaCacheId(2);

  let schemaInfo = await models.schemaInfo.getSchemaInfo(schemaCacheId);

  if (schemaInfo && !reload) {
    return res.utils.data(schemaInfo);
  }

  try {
    schemaInfo = await connectionClient.getSchema();
  } catch (error) {
    // Assumption is that error is due to user configuration
    // letting it bubble up results in 500, but it should be 400
    return res.utils.error(error);
  }

  if (Object.keys(schemaInfo).length) {
    schemaInfo.connectionId = connectionId;
    await models.schemaInfo.saveSchemaInfo(schemaCacheId, schemaInfo);
  }
  return res.utils.data(schemaInfo);
}

/**
 * get all schemas
 * @param {Req} req
 * @param {Res} res
 */
async function getAllSchemas(req, res) {
  const { models } = req;

  const docs = await models.schemaInfo.getAllSchemas();

  let arr = [];
  for (let doc of docs) {
    let schema = doc.data;
    // query conenction
    // eslint-disable-next-line no-await-in-loop
    let conn = await models.connections.findOneById(schema.connectionId);
    schema.connectionName = conn.name;
    arr.push(schema);
  }

  return res.utils.data(arr);
}

router.get(
  '/api/connections/:connectionId/schema',
  mustHaveConnectionAccess,
  wrap(getConnectionSchema)
);

router.get('/api/all-schemas', mustBeAuthenticated, wrap(getAllSchemas));

module.exports = router;
