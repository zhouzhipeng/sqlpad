const Sequelize = require('sequelize');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {import('../lib/config')} config
 * @param {import('../lib/logger')} appLog
 * @param {object} sequelizeDb - sequelize instance
 */
// eslint-disable-next-line no-unused-vars
async function up(queryInterface, config, appLog, sequelizeDb) {
  await queryInterface.addColumn('cache', 'connection_id', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn('statements', 'connection_id', {
    type: Sequelize.STRING,
    allowNull: true,
  });

  await queryInterface.addColumn('statements', 'database', {
    type: Sequelize.STRING,
    allowNull: true,
  });
}

module.exports = {
  up,
};
