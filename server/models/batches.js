const sqlLimiter = require('sql-limiter');
const ensureJson = require('./ensure-json');

class Batches {
  /**
   * @param {import('../sequelize-db')} sequelizeDb
   * @param {import('../lib/config')} config
   */
  constructor(sequelizeDb, config) {
    this.sequelizeDb = sequelizeDb;
    this.config = config;
  }

  async findOneById(id) {
    let batch = await this.sequelizeDb.Batches.findOne({ where: { id } });
    if (!batch) {
      return;
    }
    batch = batch.toJSON();
    batch.chart = ensureJson(batch.chart);

    const statements = await this.sequelizeDb.Statements.findAll({
      where: { batchId: id },
      order: [['sequence', 'ASC']],
    });

    batch.statements = [];
    for (let s of statements) {
      s = s.toJSON();
      s.columns = ensureJson(s.columns);
      s.error = ensureJson(s.error);

      // qyery connection info
      // eslint-disable-next-line no-await-in-loop
      let connection = await this.sequelizeDb.Connections.findOne({
        where: { id: s.connectionId },
      });
      if (connection) {
        connection = connection.toJSON();
        s.connectionName = connection.name;
      }

      batch.statements.push(s);
    }

    return batch;
  }

  async findAllForUser(user) {
    let items = await this.sequelizeDb.Batches.findAll({
      where: { userId: user.id },
    });
    items = items.map((item) => item.toJSON());
    return items;
  }

  /**
   * Create a new batch (and statements)
   * selectedText is parsed out into statements
   * @param {object} batch
   */
  async create(batch) {
    let createdBatch;

    const queryText = batch.selectedText || batch.batchText;

    // sqlLimiter could fail at parsing the SQL text
    // If this happens the error is captured and reported as if it were a query error

    let error;
    let statementTexts = [queryText];
    try {
      statementTexts = sqlLimiter
        .getStatements(queryText)
        .map((s) => sqlLimiter.removeTerminator(s))
        .filter((s) => s && s.trim() !== '');
    } catch (e) {
      error = e;
    }

    await this.sequelizeDb.sequelize.transaction(async (transaction) => {
      const createData = { ...batch };
      if (error) {
        createData.status = 'error';
      }
      createdBatch = await this.sequelizeDb.Batches.create(createData, {
        transaction,
      });

      // scan schema info
      const docs = await this.sequelizeDb.Cache.findAll({
        where: { name: 'schema cache' },
      });

      const statements = [];
      let i = 0;

      for (let statementText of statementTexts) {
        // TODO: parse table name from statementText
        let tableName = 'person';

        for (let doc of docs) {
          const schemas = ensureJson(doc.data).schemas;
          for (let db of schemas) {
            for (let table of db.tables) {
              if (table.name === tableName) {
                statements.push({
                  batchId: createdBatch.id,
                  sequence: i++,
                  statementText,
                  status: error ? 'error' : 'queued',
                  error: error && { title: error.message },
                  connectionId: doc.connectionId,
                  database: db.name,
                });
              }
            }
          }
        }
      }

      await this.sequelizeDb.Statements.bulkCreate(statements, { transaction });
    });

    return this.findOneById(createdBatch.id);
  }

  /**
   * Update batch object
   * Statements are not updated through this method
   * @param {string} id
   * @param {data} data
   */
  async update(id, data) {
    await this.sequelizeDb.Batches.update(data, { where: { id } });
    return this.findOneById(id);
  }
}

module.exports = Batches;
