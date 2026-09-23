import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiffString, parsePorcelainBlame } from '../server/gitService';

describe('GitService: Diff and Blame Parsers', () => {
  test('parseUnifiedDiffString parses additions, deletions, and hunks', () => {
    const rawDiff = `diff --git a/hello.txt b/hello.txt
index 0000000..e69de29 100644
--- a/hello.txt
+++ b/hello.txt
@@ -1,3 +1,4 @@
 line 1
-line 2 old
+line 2 new
+line 3 added
 line 4
`;

    const files = parseUnifiedDiffString(rawDiff);
    assert.equal(files.length, 1);
    const file = files[0];
    assert.equal(file.filename, 'hello.txt');
    assert.equal(file.status, 'modified');
    assert.equal(file.additions, 2);
    assert.equal(file.deletions, 1);
    assert.equal(file.hunks?.length, 1);
    assert.equal(file.lines.length, 5);
  });

  test('parsePorcelainBlame parses porcelain output correctly', () => {
    const rawPorcelain = `18481c1fd4f200d222acdd86ee1f6d1f1c16d60d 1 1 2
author Alice
author-mail <alice@sourcehub.local>
author-time 1790108292
author-tz -0500
committer Alice
committer-mail <alice@sourcehub.local>
committer-time 1790108292
committer-tz -0500
summary Initial commit
filename test.txt
\tfirst line of code
18481c1fd4f200d222acdd86ee1f6d1f1c16d60d 2 2
\tsecond line of code
326f5aee0bf4837d179f615bff79275e1ef3cd31 1 3 1
author Bob
author-mail <bob@sourcehub.local>
author-time 1790109000
summary Add third line
filename test.txt
\tthird line from Bob
`;

    const blame = parsePorcelainBlame(rawPorcelain);
    assert.equal(blame.length, 3);

    assert.equal(blame[0].lineNumber, 1);
    assert.equal(blame[0].shortSha, '18481c1');
    assert.equal(blame[0].author, 'Alice');
    assert.equal(blame[0].authorEmail, 'alice@sourcehub.local');
    assert.equal(blame[0].content, 'first line of code');

    // Line 2 reuses cached commit metadata from commit 1
    assert.equal(blame[1].lineNumber, 2);
    assert.equal(blame[1].shortSha, '18481c1');
    assert.equal(blame[1].author, 'Alice');
    assert.equal(blame[1].content, 'second line of code');

    // Line 3 from Bob
    assert.equal(blame[2].lineNumber, 3);
    assert.equal(blame[2].shortSha, '326f5ae');
    assert.equal(blame[2].author, 'Bob');
    assert.equal(blame[2].content, 'third line from Bob');
  });

  test('parsePorcelainBlame returns empty array on empty input', () => {
    assert.deepEqual(parsePorcelainBlame(''), []);
  });
});
