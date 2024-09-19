import { glob } from 'glob';
import {
	readFileSync,
	writeFile,
	mkdir,
	existsSync,
	writeFileSync,
	mkdirSync,
} from 'fs';

export const queryTypes = [
	'select',
	'create',
	'insert',
	'delete',
	'update',
	'drop',
	'with',
	'grant',
	'set',
	'system',
	'alter',
	'show',
	'truncate',
	'optimize',
	'explain',
	'use',
	'exchange',
	'rename',
	'describe',
	'desc',
	'detach',
	'attach',
	'undrop',
	'replace',
	'kill',
	'check',
	'begin',
	'rollback',
	'exists',
	'revoke',

	// should be last
	'other',
] as const;

interface QueryPayload {
	fileName: string;
	query: string;
}

// @ts-ignore
const queriesByTypeMap: Record<(typeof queryTypes)[number], QueryPayload[]> =
	Object.fromEntries(queryTypes.map((queryType) => [queryType, []]));

async function main(): Promise<void> {
	const fatFiles: { name: string; size: number }[] = [];

	const fileNames = await glob(
		'../ClickHouse/tests/queries/0_stateless/*.sql',
		{}
	);
	fileNames.forEach((sqlFile, index) => {
		let content = readFileSync(sqlFile, 'utf8');
		content = transformContent(content);
		if (content.length > 20_000) {
			console.log(sqlFile, 'is too fat', content.length);
			fatFiles.push({
				name: sqlFile,
				size: content.length,
			});
			return;
		}

		let queries: string[] = getQueries(content);

		queries.forEach((query) => {
			const queryFormatted = query.replace(/\n+/m, ' ').replace(/^ +/gm, '');
			const queryLowerCase = queryFormatted.toLowerCase();
			for (const queryType of queryTypes) {
				if (queryType === 'other') {
					queriesByTypeMap.other.push({
						fileName: sqlFile,
						query: queryFormatted,
					});
					return;
				}

				if (queryLowerCase.startsWith(queryType)) {
					queriesByTypeMap[queryType].push({
						fileName: sqlFile,
						query: queryFormatted,
					});
					break;
				}
			}
		});

		if (index % 100 === 0) {
			console.log('FILES LEFT:', fileNames.length - index + 1);
		}
	});

	queryTypes.forEach((queryType) => {
		const folderPath = `./generated/${queryType}`;
		if (!existsSync(folderPath)) {
			mkdirSync(folderPath, {
				recursive: true,
			});
		}

		writeFileSync(
			folderPath.concat('/test.ts'),
			generateTestFile(queryType, queriesByTypeMap[queryType])
		);
	});
}

function getQueries(content: string): string[] {
	const queries = content.match(/^(.|\n)+?;( |)+$/gm);
	if (queries) {
		return queries;
	}

	return [content];
}

function transformContent(content: string): string {
	return content
		.replace(/^ +/gm, '')
		.replace(/^--(.|)+/gm, '')
		.replace(/\\/gm, '\\\\')
		.replace(/^(\n|\\n)+/gm, '')
		.replace(/\/\*(.|\n)+\*\//gm, '')
		.replace(/`/gm, '\\'.concat('`'))
		.replace(/\$/gm, '\\'.concat('$'))
		.replace(/\n\n(\n|)+/gm, '\n');
}

main();

function generateTestFile(testName: string, queries: QueryPayload[]): string {
	if (!queries.length) {
		return '// no queries';
	}
	const head = [
		"import {parseClickHouseQuery} from '../../../index';",
		"import {appendFile} from 'fs'",
	].join('\n');

	const generateTestCase = (query: QueryPayload, index: number): string =>
		[
			`test('should parse without errors: ${testName} ${query.fileName} ${index + 1}', () => {`,
			`	const query = \`${query.query}\`;`,
			'	try {',
			`		const autocompleteResult = parseClickHouseQuery(query, {line: 0, column: 0});`,
			'		expect(autocompleteResult.errors).toHaveLength(0);',
			'	} catch (error) {',
			'		// @ts-ignore',
			"		if (error?.message.includes('Received')) {",
			`			appendFile('./logs.${testName}.log', JSON.stringify({query, error: String(error)}) + ',\\n', () => {});`,
			'		} else {',
			"			appendFile('./logs.unexpected.log', String(error), () => {});",
			'		}',
			'		throw error;',
			'	}',
			'})',
		].join('\n');

	const uniqueQueries = new Set();
	const uniqueTestCases = queries
		.filter((query) => {
			const currentUniqueQueriesLength = uniqueQueries.size;
			uniqueQueries.add(query.query);
			return currentUniqueQueriesLength !== uniqueQueries.size;
		})
		.slice(0, 5000);

	console.log(testName, 'total test cases', uniqueTestCases.length);

	return [
		head,
		uniqueTestCases
			.map((query, index) => generateTestCase(query, index))
			.join('\n\n'),
	].join('\n\n');
}

async function mkdirAsync(dir: string): Promise<void> {
	return new Promise((resolve, reject) => {
		mkdir(dir, { recursive: true }, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

async function writeFileAsync(
	fileName: string,
	content: string
): Promise<void> {
	return new Promise((resolve, reject) => {
		writeFile(fileName, content, (error) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}
