import axios, { type AxiosRequestConfig } from 'axios';
import { Logger, type ILogObj } from 'tslog';
import { mintInternalToken } from 'ftr-common/internalAuth';
import type {
    PersistentSaveGameSnapshot,
    PlayerPosition,
    User,
} from 'ftr-common/sharedTypes';

/**
 * A wrapper class for handling token caching and internal requests to
 * userService. This is can also be taken as a template / example on how to
 * implement other classes..
 *
 * NOTE: It might be this would even be for once a useful place to use
 * inheritance! BC if there was more internal com to do, which would need other
 * methods, some would basic props will definitely shared among all other
 * serviceClient classes.
 */
export class UserServiceClient {
    private cachedToken: string | null = null;
    private cachedExp: number = 0;
    private axiosCfg: AxiosRequestConfig | null = null;

    private uid: number;
    private secretKey: string;
    private endpoint: string;
    private log: Logger<ILogObj>;

    constructor(
        uid: number,
        endpoint: string,
        key: string,
        log: Logger<ILogObj>
    ) {
        this.uid = uid;
        this.secretKey = key;
        this.endpoint = endpoint;
        this.log = log;
    }

    /**
     * The heart of the token caching mechanism. Checks if we are 30s away from
     * InternalTokenLifetime, if so mints a new one and stores it in class
     * props. Else: does nothing.
     */

    private refreshToken() {
        if (!this.cachedToken || Date.now() > this.cachedExp - 30_000) {
            this.cachedToken = mintInternalToken(
                'connService',
                'userService',
                {
                    actingForUID: this.uid,
                },
                this.secretKey
            );
            this.cachedExp = Date.now() + 5 * 60_000;
            this.axiosCfg = {
                headers: { Cookie: `token=${this.cachedToken}` },
            };
        }
    }

    /**
     * Get the user state from DB.
     */
    async getUserState(): Promise<User | undefined> {
        this.refreshToken();
        const res = await axios.get(this.endpoint, this.axiosCfg!);
        return res.data.data as User;
    }

    /**
     * Sync user-presence to DB. Fails only with internal log-msg.
     */
    async updateUserPresence(isLoggedIn: boolean): Promise<void> {
        this.refreshToken();
        try {
            await axios.patch(this.endpoint, { isLoggedIn }, this.axiosCfg!);
        } catch (err) {
            this.log.error(
                'Failed updating presence for UID',
                this.uid,
                err as Error
            );
        }
    }

    /**
     * Sync user-state to DB. Fails only with internal log-msg.
     */
    async updateUserState(
        position: PlayerPosition,
        blackHoleSecondsRemaining: number
    ): Promise<void> {
        this.refreshToken();
        const snap: PersistentSaveGameSnapshot = {
            position,
            blackHoleSecondsRemaining,
        };
        try {
            await axios.patch(this.endpoint, { snap: snap }, this.axiosCfg!);
        } catch (err) {
            this.log.error(
                'Failed updating state for UID',
                this.uid,
                err as Error
            );
        }
    }
}
