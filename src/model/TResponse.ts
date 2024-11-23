export type TResponse<Data extends object = {}, Payload extends object | undefined = undefined> =
    Payload extends undefined
        ? {
            status: "ok";
            serviceName: string;
            clientId: string;
            userId: string;
            token: string;
            data: Data;
            payload?: Payload;
          }
        | {
            status: "error";
            serviceName: string;
            clientId: string;
            userId: string;
            token: string;
            error: string;
            payload?: Payload;
          }
    : {
            status: "ok";
            serviceName: string;
            clientId: string;
            userId: string;
            token: string;
            data: Data;
            payload: Payload;
          }
        | {
            status: "error";
            serviceName: string;
            clientId: string;
            userId: string;
            token: string;
            error: string;
            payload: Payload;
          };

export default TResponse;
