const { Parser } = require('node-sql-parser');

describe('parsesql', function () {
  it('ast', function () {
    const parser = new Parser();
    const ast = parser.astify('show create table tree;');
    // eslint-disable-next-line no-console
    console.log(ast);
  });
});
