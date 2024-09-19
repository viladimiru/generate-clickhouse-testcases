import { existsSync, mkdirSync, writeFileSync } from 'fs';
import {
	errorTypes,
	getErrorType,
	getQueryTypeFromResultFile,
	getResultFiles,
	QueryType,
	queryTypes,
	readResultFileContent,
} from './shared';

type ErrorType = (typeof errorTypes)[number];

async function main(): Promise<void> {
	const resultFiles = await getResultFiles();
	const contents = resultFiles.map((resultFile) => {
		const queryType = getQueryTypeFromResultFile(resultFile);
		return {
			...readResultFileContent(resultFile),
			queryType,
		};
	});

	// @ts-ignore
	const errorByTypeMap: Record<
		QueryType,
		Record<ErrorType, { query: string; fileName: string; error: string }[]>
	> = Object.fromEntries(
		queryTypes.map((queryType) => [
			queryType,
			Object.fromEntries(errorTypes.map((errorType) => [errorType, []])),
		])
	);

	contents.forEach((content) => {
		content.result.forEach((value) => {
			value.errors.forEach((error) => {
				const errorType = getErrorType(error.message);
				errorByTypeMap[content.queryType][errorType].push({
					query: value.query,
					fileName: value.fileName,
					error: error.message,
				});
			});
		});
	});

	const path = './grouped-test-results';
	if (!existsSync(path)) {
		mkdirSync(path);
	}

	queryTypes.forEach((queryType) => {
		errorTypes.forEach((errorType) => {
			writeFileSync(
				path
					.concat('/')
					.concat(queryType + '_' + errorType)
					.concat('.json'),
				JSON.stringify(errorByTypeMap[queryType][errorType])
			);
		});
	});

	console.log('grouping done');
}

main();
