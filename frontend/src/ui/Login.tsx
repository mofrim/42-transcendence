import React from 'react';
import { useLoginContext } from '../hooks/useLoginContext';

// TODO add proper login / auth logic here
export const LoginFields: React.FC = () => {
    return (
        <>
            <input id="email" type="text" placeholder="Email" />
            <input id="password" type="password" placeholder="Password" />
        </>
    )
}

const sanitizeServerAddr = (addrInput: string, portInput: string) => {
    const defaultServerAddress = "localhost";
    const defaultServerPort = "3000";
    const supportedServerProtocols = new Set(["http:", "https:", "ws:", "wss:"]);

    const hasProtocol = (address: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(address);

    const hasExplicitPort = (address: string) => {
        const addressWithoutProtocol = address.replace(/^[a-z][a-z\d+\-.]*:\/\//i, "");
        const authority = addressWithoutProtocol.split(/[/?#]/, 1)[0];
        const host = authority!.slice(authority!.lastIndexOf("@") + 1);

        if (host.startsWith("[")) {
            return /^\[[^\]]+\]:\d+$/.test(host);
        }

        return /:\d+$/.test(host);
    };

    const readServerPort = () => {
        const port = portInput.trim() || defaultServerPort;
        const portNumber = Number(port);

        if (!/^\d+$/.test(port) || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
            alert("Server port must be an integer from 1 to 65535.");
            return null;
        }

        return String(portNumber);
    };

    const composeServerUrl = (): string | null => {
        const address = addrInput.trim() || defaultServerAddress;
        const addressWithProtocol = hasProtocol(address) ? address : `http://${address}`;
        let serverUrl;

        try {
            serverUrl = new URL(addressWithProtocol);
        } catch {
            alert("Enter a valid server address.");
            return null;
        }

        if (!supportedServerProtocols.has(serverUrl.protocol)) {
            alert("Server protocol must be http://, https://, ws://, or wss://.");
            return null;
        }

        if (!hasExplicitPort(address)) {
            const port = readServerPort();

            if (!port) {
                return null;
            }

            serverUrl.port = port;
        }

        return serverUrl.origin;
    };

    const serverUrl: string | null = composeServerUrl();

    if (!serverUrl) {
        return null;
    }

    return serverUrl;
};


export const ServerSettings: React.FC = () => {
    const { serverAddr, setServerAddr, port, setPort, fullAddr, setFullAddr } = useLoginContext();

    // handles the blur event, which is the input field losing focus again. in
    // this case we want the context's state variables to be updated
    const handleBlur = ({ addrInput, portInput }: { addrInput?: string, portInput?: string }) => {
        if (addrInput)
            setServerAddr(addrInput);
        if (portInput)
            setPort(portInput);

        const santizedFullAddr: string | null | undefined = sanitizeServerAddr(addrInput ?
            addrInput :
            serverAddr,
            portInput ? portInput : port);

        if (santizedFullAddr != null)
            setFullAddr(santizedFullAddr);


    };

    console.log(`ServerSettings: serverAddr = ${serverAddr}, port = ${port}, fullAddr=${fullAddr}`);


    return (
        <div className="server-settings" aria-label="Game server settings">
            <div className="server-fields">
                <label className="server-field">
                    <span>Server address</span>
                    <input id="server-address" className="server-address" type="text" placeholder="localhost" autoComplete="off" spellCheck="false" onBlur={(e) => handleBlur({ addrInput: e.target.value })} />
                </label>

                <label className="server-field">
                    <span>Server port</span>
                    <input id="server-port" className="server-port" type="number" placeholder="3000" min="1" max="65535" inputMode="numeric" onBlur={(e) => handleBlur({ portInput: e.target.value })} />
                </label>
            </div>
            <div className="server-help">Default: http://localhost:3000</div>
        </div>
    )
};
