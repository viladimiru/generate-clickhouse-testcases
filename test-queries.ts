import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { parseClickHouseQueryWithoutCursor } from '@gravity-ui/websql-autocomplete/clickhouse';
import { getQueriesByTypeMap, queryTypes } from './shared';

async function main(): Promise<void> {
	const queriesByTypeMap = await getQueriesByTypeMap();
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

main();
