import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { getQueriesByTypeMap, QueryType, queryTypes } from './shared';

const maxTestCasesToGenerate = 1000;
async function main(): Promise<void> {
	const queriesByTypeMap = await getQueriesByTypeMap();
	const path = './generated';
	if (!existsSync(path)) {
		mkdirSync(path);
	}

	const filesToGenerate: Record<string, string> = {};

	queryTypes.forEach((queryType) => {
		if (queryType === 'other') {
			return;
		}

		const content: string[] = [getTestCaseHeader()];
		const fileName = path.concat(`/${queryType}.test.ts`);
		const queries = queriesByTypeMap[queryType].slice(
			0,
			maxTestCasesToGenerate
		);

		if (queries.length === 0) {
			return;
		}

		const testCasesContent = queries.map(({ query }, index) =>
			makeTestCase(queryType, query, index)
		);
		filesToGenerate[fileName] = content.concat(testCasesContent).join('\n\n');
	});

	const entries = Object.entries(filesToGenerate);
	entries.forEach(([fileName, content], index) => {
		if (index % 5 === 0) {
			console.log('files left: ', entries.length - index + 1);
		}

		writeFileSync(fileName, content);
	});
}

function makeTestCase(
	queryType: QueryType,
	query: string,
	index: number
): string {
	return [
		`test('should pass without errors ${queryType}: ${index + 1}', () => {`,
		`	const query = \`${query}\``,
		'',
		'	const autocompleteResult = parseClickHouseQueryWithoutCursor(query);',
		'	expect(autocompleteResult.errors).toHaveLength(0);',
		`})`,
	].join('\n');
}

function getTestCaseHeader(): string {
	return [
		'/* eslint no-useless-escape: "off" */',
		"import {parseClickHouseQueryWithoutCursor} from '../../index';",
	].join('\n');
}

main();
