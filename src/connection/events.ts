import { Connection, Input, Output } from '../rete';

declare module '../rete/events' {
    interface EventsTypes {
        connectionpath: {
            points: number[];
            connection: Connection;
            d: string;
        };
        connectiondrop: Input | Output;
        connectionpick: Input | Output;
        resetconnection: void;
    }
}