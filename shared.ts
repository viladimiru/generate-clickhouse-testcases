import { readFileSync } from 'fs';
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
	'totalErrorCases',
	'totalErrors',
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
