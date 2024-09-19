import { glob } from 'glob';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { parseClickHouseQueryWithoutCursor } from '@gravity-ui/websql-autocomplete/clickhouse';
import { queryTypes } from './shared';

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
		// if (content.length > 20_000) {
		// 	console.log(sqlFile, 'is too fat', content.length);
		// 	fatFiles.push({
		// 		name: sqlFile,
		// 		size: content.length,
		// 	});
		// 	return;
		// }

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
			console.log('scans left:', fileNames.length - index + 1);
		}
	});

	queryTypes.forEach((queryType) => {
		const queryPayloads = queriesByTypeMap[queryType];

		const path = './test-results';
		if (!existsSync(path)) {
			mkdirSync(path);
		}

		const result: {
			query: string;
			fileName: string;
			errors: { message: string }[];
		}[] = [];
		queryPayloads.forEach((queryPayload, index) => {
			const parseResult = parseClickHouseQueryWithoutCursor(queryPayload.query);
			if (parseResult.errors) {
				result.push({
					query: queryPayload.query,
					fileName: queryPayload.fileName,
					errors: parseResult.errors,
				});
			}

			if (index % 100 === 0) {
				console.log(
					queryType + ' queries left:',
					queryPayloads.length - index + 1
				);
			}
		});

		writeFileSync(
			path.concat('/' + queryType + '.json'),
			JSON.stringify({
				total: queryPayloads.length,
				result,
			}),
			{ encoding: 'utf-8' }
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
