import trycatch, { CATCH_SYMBOL } from "src/utils/hof/trycatch";

type RequestInfo = string | URL | Request;

interface Request {
    method?: string; // HTTP method (e.g., 'GET', 'POST')
    url: string;     // URL of the request
    headers?: Headers; // Optional headers
    body?: any;      // Optional body
    signal?: AbortSignal; // Optional signal for aborting the request
}

interface IConfig {
    useSymbolException?: boolean;
}

const FETCH_CONFIG: IConfig = {
    useSymbolException: false,
};

/**
 * Represents an error that occurs during a fetch request.
 *
 * @class
 * @extends Error
 */
export class FetchError extends Error {
    constructor(
        readonly originalError: any,
        readonly request: RequestInfo,
        readonly response: Response | undefined,
        readonly statusCode: number,
        readonly info?: RequestInfo | URL | null,
        readonly init?: RequestInit | null
    ) {
        super(originalError.message || 'FetchError');
    }
};

const PAYLOAD_METHODS: any[] = ['POST', 'PUT', 'PATCH'];

/**
 * Makes an asynchronous HTTP request using the Fetch API.
 *
 * @param input - The resource URL or an instance of the URL class.
 * @param [init] - The request options.
 * @returns - The response data as a Promise.
 * @throws - If an error occurs during the request.
 */
export const fetchApi = async <T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
    const request = input instanceof URL ? input.toString() : input;
    let response: Response | undefined = undefined;
    try {
        response = await fetch(<any>request, {
            ...init,
            headers: {
                ...(PAYLOAD_METHODS.includes(init?.method?.toUpperCase()) && {
                    "Content-Type": "application/json",
                }),
                ...init?.headers,
            },
        });
        if (!response.ok) {
            const responseText = await trycatch(response.text, { defaultValue: null })();
            const requestInfo = trycatch(JSON.stringify, { defaultValue: null })(input);
            const requestInit = trycatch(JSON.stringify, { defaultValue: null })(init);
            throw new Error(`fetchApi response not ok. Info: ${requestInfo}, Init: ${requestInit}, Status: ${response.status}, Message: ${responseText}`);
        }
        return await response.json() as unknown as T;
    } catch (error: any) {
        if (FETCH_CONFIG.useSymbolException) {
            return CATCH_SYMBOL as never;
        }
        throw new FetchError(
            error,
            request,
            response,
            response?.status || 0,
            input || null,
            init || null
        );
    }
};

fetchApi.config = (config: Partial<IConfig>) => {
    Object.assign(FETCH_CONFIG, config);
};

export default fetchApi;
