const sqlLimiter = require('sql-limiter');
const ensureJson = require('./ensure-json');
const { Parser } = require('node-sql-parser');

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

      const parser = new Parser();

      for (let statementText of statementTexts) {
        // parse table name from statementText
        // usage: https://www.npmjs.com/package/node-sql-parser
        statementText = statementText.trim();
        let prefixDbPattern = statementText.match(/^\/\*(.+)\*\//);
        let databaseInComment = null;
        let connectionNameInComment = null;
        let connectionIdInComment = null;
        if (prefixDbPattern) {
          databaseInComment = prefixDbPattern[1].trim();
          if (databaseInComment.indexOf(',') !== -1) {
            connectionNameInComment = databaseInComment.split(',')[0].trim();
            databaseInComment = databaseInComment.split(',')[1].trim();
            // query connection id by name
            // eslint-disable-next-line no-await-in-loop
            let connection = await this.sequelizeDb.Connections.findOne({
              where: { name: connectionNameInComment },
            });
            if (connection) {
              connectionIdInComment = connection.id;

              statements.push({
                batchId: createdBatch.id,
                sequence: i++,
                statementText,
                status: error ? 'error' : 'queued',
                error: error && { title: error.message },
                connectionId: connectionIdInComment,
                database: databaseInComment,
              });
              // eslint-disable-next-line no-continue
              continue;
            }
          }
        }
        let ast;
        try {
          ast = parser.astify(statementText); // mysql sql grammer parsed by default
        } catch (e) {
          error = e;
          statements.push({
            batchId: createdBatch.id,
            sequence: i++,
            statementText,
            status: error ? 'error' : 'queued',
            error: error && { title: error.message },
            connectionId: batch.connectionId,
          });

          break;
        }

        if (ast.type === 'select') {
          let tableName = ast.from[0].table;
          let dbName = ast.from[0].db || databaseInComment;

          for (let doc of docs) {
            const schemas = ensureJson(doc.data).schemas;
            for (let db of schemas) {
              if (dbName && db.name !== dbName) {
                // eslint-disable-next-line no-continue
                continue;
              }
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
                  break;
                }
              }
            }
          }
        } else {
          let dbName = ast.table[0].db || databaseInComment;
          let tableName = ast.table[0].table;
          if (!dbName) {
            // 修改sql必须指定db.
            statements.push({
              batchId: createdBatch.id,
              sequence: i++,
              statementText,
              status: 'error',
              error: { title: 'No Database Specified.' },
              connectionId: batch.connectionId,
            });
            break;
          }

          for (let doc of docs) {
            const schemas = ensureJson(doc.data).schemas;
            for (let db of schemas) {
              if (dbName && db.name !== dbName) {
                // eslint-disable-next-line no-continue
                continue;
              }
              for (let table of db.tables) {
                if (table.name === tableName) {
                  statements.push({
                    batchId: createdBatch.id,
                    sequence: i++,
                    statementText,
                    status: error ? 'error' : 'queued',
                    error: error && { title: error.message },
                    connectionId: doc.connectionId,
                    database: dbName,
                  });
                  break;
                }
              }
            }
          }
        }
      }

      if (statements.length === 0) {
        statements.push({
          batchId: createdBatch.id,
          sequence: i++,
          statementText: queryText,
          status: 'error',
          error: { title: 'Database or Table not Found.' },
          connectionId: batch.connectionId,
        });
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
