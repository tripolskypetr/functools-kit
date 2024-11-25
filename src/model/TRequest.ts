export type TRequest<Data extends object = {}, Payload extends object | undefined = undefined> =
    Payload extends undefined
        ? {
            serviceName: string;
            clientId: string;
            userId: string;
            requestId: string;
            token: string;
            data: Data;
            payload?: Payload;
        }
        : {
            serviceName: string;
            clientId: string;
            userId: string;
            requestId: string;
            token: string;
            data: Data;
            payload: Payload;
        };

export default TRequest;
