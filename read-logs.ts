import { glob } from 'glob';
import { readFileSync } from 'fs';
import { queryTypes } from '.';

const totalCases: Record<(typeof queryTypes)[number], number> = {
	select: 5000,
	create: 5000,
	insert: 5000,
	delete: 59,
	drop: 5000,
	with: 770,
	grant: 33,
	set: 1407,
	system: 382,
	alter: 1227,
	show: 568,
	truncate: 67,
	optimize: 324,
	explain: 953,
	use: 26,
	exchange: 10,
	rename: 58,
	describe: 227,
	desc: 318,
	detach: 173,
	attach: 182,
	undrop: 9,
	update: 0,
	replace: 11,
	kill: 1,
	check: 22,
	begin: 3,
	rollback: 2,
	exists: 20,
	revoke: 15,
	other: 844,
};

const errorTypes = [
	'noViableAlternative',
	'mismatchedInput',
	'extraneousInput',
	'missing',
	'unknown',
	'totalErrorCases',
	'totalErrors',
] as const;

type ErrorStats = Record<(typeof errorTypes)[number], number>;

// @ts-ignore
const errorStats: Record<ErrorStats> = Object.fromEntries(
	errorTypes.map((errorType) => [errorType, 0])
);

async function main(): Promise<void> {
	const logFiles = await glob('**/logs*.log');

	const result = logFiles
		.map((logFile) => {
			const queryTypeMatch = logFile.match(/logs\.(?<type>\w+)/);
			// @ts-ignore
			const groupType: (typeof queryTypes)[number] =
				queryTypeMatch?.groups?.type;
			if (!groupType) {
				throw new Error('lol');
			}

			const stats = getLogStats(logFile);
			return [
				groupType,
				{
					...stats,
					totalCases: totalCases[groupType],
					successCases: totalCases[groupType] - stats.totalErrorCases,
					errorPercentage:
						(stats.totalErrorCases / totalCases[groupType]) * 100,
				},
			];
		})
		// @ts-ignore
		.sort((a, b) => a[1]?.errorPercentage - b[1]?.errorPercentage);

	console.log(Object.fromEntries(result));
}

// @ts-ignore
function getLogStats(fileName: string): ErrorStats {
	const content = readFileSync(fileName, { encoding: 'utf-8' });

	const rows = content.split('\n');
	const transformedRows = rows.map(transformRow).filter(Boolean);

	// @ts-ignore
	const errorStats: Record<ErrorStats> = Object.fromEntries(
		errorTypes.map((errorType) => [errorType, 0])
	);
	transformedRows.forEach((transformedRow) => {
		if (transformedRow?.errors?.length) {
			errorStats.totalErrorCases++;
		}

		transformedRow?.errors.forEach((error) => {
			const errorType = getErrorType(error.message);
			errorStats[errorType]++;
			errorStats.totalErrors++;
		});
	});

	return errorStats;
}

function transformRow(
	row: string
): { query: string; errors: { message: string }[] } | undefined {
	// get rid of comma at the end
	const validRow = row.slice(0, row.length - 1);
	if (!validRow) {
		return;
	}

	let object: { query: string; error: string };
	try {
		object = JSON.parse(validRow);
	} catch (error) {
		console.log(validRow, row);
		console.log('parse error' + validRow);
		throw error;
	}
	const errorMatch = object.error.match(/\[{.+}]/);

	if (!errorMatch) {
		throw new Error('invalid match. ' + object.error);
	}

	const errors: { message: string }[] = JSON.parse(errorMatch[0]);
	return { query: object.query, errors };
}

function getErrorType(errorMessage: string): (typeof errorTypes)[number] {
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

main();
