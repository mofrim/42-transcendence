import { UserInfo } from './UserInfo';
import { CharacterPreview } from './PreviewCharacter';
import { MapPreview } from './PreviewMap';
import { PlayerSelect } from './PlayerSelect';
import { Agreements, PPModal, TOSModal } from './Agreements';
import { API_USER, type ApiResponse } from 'ftr-common/sharedTypes';
import axios from 'axios';
import { showErrMsg, showSuccessMsg } from '../../lib/antdUtils';
import { Button } from 'antd';

import React, { useState, useEffect } from 'react';

type EntranceProps = {
    title: string;
    subtitle: React.ReactNode;
    setIsSpectator: React.Dispatch<React.SetStateAction<boolean>>;
    setGameRunning: React.Dispatch<React.SetStateAction<boolean>>;
};

type AgreementStatus = 'loading' | 'accepted' | 'not_accepted';

export const Entrance: React.FC<EntranceProps> = (props: EntranceProps) => {
    const [status, setStatus] = useState<AgreementStatus>('loading');
    const [isTOSModalOpen, setIsTOSModalOpen] = useState<boolean>(false);
    const [isPPModalOpen, setIsPPModalOpen] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await axios.get<ApiResponse<boolean>>(
                    API_USER.tospp,
                    {
                        withCredentials: true,
                    }
                );
                if (!cancelled) {
                    setStatus(res.data.data ? 'accepted' : 'not_accepted');
                }
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setStatus('not_accepted');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    /**
     * Function for setting the tospp state asyncly. We re-throw the Error here
     * because it will be caught as a rejected Promise in the Agreements compo.
     */
    const setAgreed = async (v: boolean) => {
        if (v) {
            try {
                await axios.post(API_USER.tospp, {
                    withCredentials: true,
                });
                showSuccessMsg('You are ready to enter :)');
                console.log('[Entrance] stored TOSPP state in DB');
            } catch (err) {
                showErrMsg('Storing agreement failed!');
                console.log(
                    '[Entrance] storing TOSPP state in DB failed:',
                    err
                );
                throw err;
            }
        }
        setStatus(v ? 'accepted' : 'not_accepted');
    };

    const showAgreements = () => {
        if (status === 'loading') {
            return <p>Loading…</p>;
        }

        if (status === 'not_accepted') {
            return <Agreements setAgreed={setAgreed} />;
        }

        return (
            <>
                <p style={{ fontSize: '14px' }}>
                    <Button
                        className='terms-link'
                        style={{ margin: 'auto -10px', fontSize: '14px' }}
                        color='default'
                        variant='link'
                        onClick={() => setIsTOSModalOpen(true)}
                    >
                        TOS
                    </Button>
                    &
                    <Button
                        className='terms-link'
                        style={{ margin: 'auto -10px', fontSize: '14px' }}
                        color='default'
                        variant='link'
                        onClick={() => setIsPPModalOpen(true)}
                    >
                        Privacy Policy
                    </Button>
                    already accepted.
                </p>
                <PPModal
                    isModalOpen={isPPModalOpen}
                    setIsModalOpen={setIsPPModalOpen}
                />
                <TOSModal
                    isModalOpen={isTOSModalOpen}
                    setIsModalOpen={setIsTOSModalOpen}
                />
            </>
        );
    };

    return (
        <>
            <MapPreview />
            <div id='login-ui'>
                <div className='login-title'>{props.title}</div>
                <div className='login-subtitle'>{props.subtitle}</div>
                <UserInfo />
                <PlayerSelect />
                <CharacterPreview />
                {showAgreements()}
                <button
                    disabled={status === 'not_accepted'}
                    id='start-btn'
                    onClick={() => {
                        props.setIsSpectator(false);
                        props.setGameRunning(true);
                    }}
                >
                    ENTER
                </button>
            </div>
        </>
    );
};
