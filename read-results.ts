import { writeFileSync } from 'fs';
import {
	errorTypes,
	getErrorType,
	getQueryTypeFromResultFile,
	getResultFiles,
	readResultFileContent,
} from './shared';

type ErrorStats = Record<(typeof errorTypes)[number], number>;

async function main(): Promise<void> {
	const resultFiles = await getResultFiles();

	const result = resultFiles
		.map((resultFile) => {
			const queryType = getQueryTypeFromResultFile(resultFile);

			const stats = getResultStats(resultFile);
			return [
				queryType,
				{
					...stats,
				},
			];
		})
		// @ts-ignore
		.sort((a, b) => a[1]?.errorPercentage - b[1]?.errorPercentage);

	writeFileSync(
		'./statistics.json',
		JSON.stringify(Object.fromEntries(result), null, 2)
	);
	console.log('reading done');
}

// @ts-ignore
function getResultStats(fileName: string): ErrorStats {
	const content = readResultFileContent(fileName);

	// @ts-ignore
	const errorStats: Record<ErrorStats> = Object.fromEntries(
		errorTypes.map((errorType) => [errorType, 0])
	);
	content.result.forEach((row) => {
		if (row?.errors?.length) {
			errorStats.totalErrorCases++;
		}

		row?.errors.forEach((error) => {
			const errorType = getErrorType(error.message);
			errorStats[errorType]++;
			errorStats.totalErrors++;
		});
	});

	return {
		...errorStats,
		totalCases: content.total,
		successCases: content.total - errorStats.totalErrorCases,
		errorPercentage: (errorStats.totalErrorCases / content.total) * 100,
	};
}

main();
