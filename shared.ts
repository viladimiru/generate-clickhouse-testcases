import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

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

export const errorTypes = [
	'noViableAlternative',
	'mismatchedInput',
	'extraneousInput',
	'missing',
	'unknown',
] as const;

export function getErrorType(
	errorMessage: string
): (typeof errorTypes)[number] {
	for (const errorType of errorTypes) {
		switch (errorType) {
			case 'noViableAlternative':
				if (errorMessage.startsWith('no viable alternative')) {
					return 'noViableAlternative';
				}
				break;
			case 'extraneousInput':
				if (errorMessage.startsWith('extraneous input')) {
					return 'extraneousInput';
				}
				break;
			case 'mismatchedInput':
				if (errorMessage.startsWith('mismatched input')) {
					return 'mismatchedInput';
				}
				break;
			case 'missing':
				if (errorMessage.startsWith('missing')) {
					return 'missing';
				}
				break;
			case 'unknown':
				return 'unknown';
		}
	}
	return 'unknown';
}

export type QueryType = (typeof queryTypes)[number];

type Result = {
	total: number;
	result: { query: string; fileName: string; errors: { message: string }[] }[];
};

export function readResultFileContent(fileName: string): Result {
	return JSON.parse(readFileSync(fileName, { encoding: 'utf-8' }));
}

export async function getResultFiles(): Promise<string[]> {
	return glob('test-results/*.json');
}

export function getQueryTypeFromResultFile(fileName: string): QueryType {
	const queryTypeMatch = fileName.match(/(?<type>\w+)\.json/);
	// @ts-ignore
	const queryType: (typeof queryTypes)[number] = queryTypeMatch?.groups?.type;
	if (!queryType) {
		throw new Error('unexpected');
	}

	return queryType;
}

interface QueryPayload {
	fileName: string;
	query: string;
}

type QueriesByTypeMap = Record<(typeof queryTypes)[number], QueryPayload[]>;

const invalidCharactersQueries: string[] = [];
export async function getQueriesByTypeMap(): Promise<QueriesByTypeMap> {
	// @ts-ignore
	const queriesByTypeMap: QueriesByTypeMap = Object.fromEntries(
		queryTypes.map((queryType) => [queryType, []])
	);

	const fileNames = await glob(
		'../ClickHouse/tests/queries/0_stateless/*.sql',
		{}
	);
	let totalDuplicateQueries = 0;
	const uniqueQueries = new Set();
	fileNames.forEach((sqlFile, index) => {
		let content = readFileSync(sqlFile, 'ascii');
		content = transformContent(content);

		let queries: string[] = getQueries(content);
		queries.forEach((query) => {
			const queryFormatted = query.replace(/\n+/m, ' ').replace(/^ +/gm, '');
			const queryLowerCase = queryFormatted.toLowerCase();
			const oldUniqueQueriesSize = uniqueQueries.size;
			uniqueQueries.add(queryLowerCase);
			if (oldUniqueQueriesSize === uniqueQueries.size) {
				totalDuplicateQueries++;
				return;
			}

			if (
				!/^[a-z-!@#$%^&*()_+ \/\|><\.,а-яА-Я\n\;='0-9%:{}`\[\]\"\\\t&?~]+$/i.test(
					queryFormatted
				)
			) {
				console.log('invalid characters');
				invalidCharactersQueries.push(queryFormatted);
				return;
			}

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
			console.log('scans left:', fileNames.length - index + 1);
		}
	});
	console.log('total invalid chars', invalidCharactersQueries.length);
	writeFileSync(
		'invalid-chars.json',
		JSON.stringify(invalidCharactersQueries, null, 2)
	);
	console.log('total duplicate queries', totalDuplicateQueries);
	return queriesByTypeMap;
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
		.replace(/　/g, ' ')
		.replace(/\/\*(.|\n)+\*\//gm, '')
		.replace(/`/gm, '\\'.concat('`'))
		.replace(/\$/gm, '\\'.concat('$'))
		.replace(/\n\n(\n|)+/gm, '\n');
}
