import { writeFileSync } from 'fs';
import {
	errorTypes,
	getErrorType,
	getQueryTypeFromResultFile,
	getResultFiles,
	readResultFileContent,
} from './shared';

type ErrorStats = Record<(typeof errorTypes)[number], number>;

export async function main(): Promise<void> {
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
		// sort by error percentage
		// .sort((a, b) =>
		// 	// @ts-ignore
		// 	(a[1]?.errorPercentage || 0) > (b[1]?.errorPercentage || 0) ? -1 : 1
		// );
		// sort by total test cases
		.sort((a, b) =>
			// @ts-ignore
			(a[1]?.totalCases || 0) > (b[1]?.totalCases || 0) ? -1 : 1
		);

	writeFileSync(
		'./statistics.json',
		JSON.stringify(Object.fromEntries(result), null, 2)
	);
	console.log('reading done');
}

// @ts-ignore
function getResultStats(
	fileName: string
): ErrorStats & { totalErrors: number; totalErrorCases: number } {
	const content = readResultFileContent(fileName);

	// @ts-ignore
	const errorByTypeStats: Record<ErrorStats> = Object.fromEntries(
		errorTypes.map((errorType) => [errorType, 0])
	);

	const errorStats = {
		totalErrors: 0,
		totalErrorCases: 0,
	};

	content.result.forEach((row) => {
		if (row?.errors?.length) {
			errorStats.totalErrorCases++;
		}

		row?.errors.forEach((error) => {
			const errorType = getErrorType(error.message);
			errorByTypeStats[errorType]++;
			errorStats.totalErrors++;
		});
	});

	return {
		...errorByTypeStats,
		totalCases: content.total,
		successCases: content.total - errorStats.totalErrorCases,
		errorPercentage: (errorStats.totalErrorCases / content.total) * 100,
	};
}
