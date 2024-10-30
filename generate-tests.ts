import { mkdirSync, rmdirSync, writeFileSync } from 'fs';
import { getQueriesByTypeMap, QueryType, queryTypes } from './shared';

const maxTestCasesForFile = 7000;
async function main(): Promise<void> {
	const queriesByTypeMap = await getQueriesByTypeMap();
	const path = './generated';
	rmdirSync(path, {
		recursive: true,
	});
	mkdirSync(path);

	const filesToGenerate: Record<string, string> = {};

	queryTypes.forEach((queryType) => {
		if (queryType === 'other') {
			return;
		}

		const fileNameSuffix = '.test.ts';
		const queries = queriesByTypeMap[queryType];

		if (queries.length === 0) {
			return;
		}

		const testCasesContent = queries.map(({ query }, index) =>
			makeTestCase(queryType, query, index)
		);

		if (testCasesContent.length > maxTestCasesForFile) {
			const testCasesFolderPath = path.concat(`/${queryType}`);
			mkdirSync(testCasesFolderPath);
			for (
				let index = 0;
				index < testCasesContent.length / maxTestCasesForFile;
				index++
			) {
				const fileName = testCasesFolderPath
					.concat(`/chunk-${index + 1}`)
					.concat(fileNameSuffix);
				filesToGenerate[fileName] = [getTestCaseHeader(true)]
					.concat(
						testCasesContent.slice(index, (index + 1) * maxTestCasesForFile)
					)
					.join('\n\n')
					.concat('\n');
			}
			return;
		}

		const fileName = path.concat(`/${queryType}`.concat(fileNameSuffix));
		filesToGenerate[fileName] = [getTestCaseHeader()]
			.concat(testCasesContent)
			.join('\n\n')
			.concat('\n');
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
		`test('[${queryType.toUpperCase()}] should pass without errors: ${index + 1}', () => {`,
		`    const query = \`${query}\`;`,
		'',
		'    const autocompleteResult = parseClickHouseQueryWithoutCursor(query);',
		'    expect(autocompleteResult.errors).toHaveLength(0);',
		`});`,
	].join('\n');
}

function getTestCaseHeader(hasSubFolder?: boolean): string {
	return [
		'/* eslint no-useless-escape: "off" */',
		'/* eslint filenames/match-regex: "off" */',
		'/* eslint no-irregular-whitespace: "off" */',
		`import {parseClickHouseQueryWithoutCursor} from '${'../'.concat(hasSubFolder ? '../' : '')}../index';`,
	].join('\n');
}
