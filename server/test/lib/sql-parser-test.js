const { Parser } = require('node-sql-parser');

describe('parsesql', function () {
  it('ast', function () {
    const parser = new Parser();
    const ast = parser.astify("update person set name='aaa2'");
    // eslint-disable-next-line no-console
    console.log(ast);
  });
});
