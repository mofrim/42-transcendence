import React, { useState, useEffect } from 'react';
import { Checkbox, type CheckboxProps, Modal, Button } from 'antd';

// ----------------------------=[ Modal stuff ]=---------------------------- //

type AgreementModalProps = {
    title: string;
    isModalOpen: boolean;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    content: React.ReactNode;
};

export const AgreementModal: React.FC<AgreementModalProps> = (
    props: AgreementModalProps
) => {
    const handleOk = () => {
        props.setIsModalOpen(false);
    };

    return (
        <Modal
            title={props.title}
            open={props.isModalOpen}
            closable={false}
            centered={true}
            onOk={handleOk}
            zIndex={100001}
            okText='OK'
            footer={(_, { OkBtn }) => (
                <>
                    <OkBtn />
                </>
            )}
        >
            {props.content}
        </Modal>
    );
};

// PrivacyPolicy content
const PPcontent: React.ReactNode = (
    <>
        <p>
            <strong>Last updated: October 7, 2026</strong>
        </p>

        <p>
            This Privacy Policy explains how ft_transcendence collects and uses
            information when you create an account and use our online
            multiplayer gaming platform developed as part of the 42 Wolfsburg
            curriculum.
        </p>

        <h3>Information We Collect</h3>
        <ul>
            <li>
                <strong>Account Information:</strong> your nickname, email
                address, and password. Passwords are stored as protected one-way
                hashes and are not readable by the project team.
            </li>

            <li>
                <strong>Profile Information:</strong> your avatar, nickname,
                online status, and friend relationships with other users.
            </li>

            <li>
                <strong>Game Information:</strong> match history, wins, losses,
                scores, rankings, achievements, checklist progress, completed
                tasks, and statistics generated while playing Tic-Tac-Toe and
                Rock-Paper-Scissors.
            </li>

            <li>
                <strong>Technical Information:</strong> authentication cookies,
                login sessions, error logs, and basic technical information
                required to operate and secure the platform.
            </li>
        </ul>

        <h3>How We Use Information</h3>
        <p>
            We use this information to create and secure accounts, authenticate
            users, save game progress, provide real-time multiplayer features,
            maintain rankings, manage friend interactions, track checklist
            progress, and improve the stability and security of the platform.
        </p>

        <p>
            We do not sell personal information or use personal data for
            advertising purposes.
        </p>

        <h3>Sharing and Retention</h3>
        <p>
            Information is shared only with the services required to operate the
            platform, such as the application backend, authentication services,
            and database systems. Account and gameplay data are stored while an
            account remains active or as long as required for the operation of
            the project.
        </p>

        <p>
            Users may request correction or deletion of account data through the
            project team.
        </p>

        <h3>Security and Your Choices</h3>
        <p>
            Reasonable technical measures are used to protect user data.
            Although we strive to keep information secure, no online service can
            guarantee absolute security.
        </p>

        <p>
            The platform uses authentication cookies to keep users signed in.
            Logging out removes the active session from the browser.
        </p>

        <h3>Questions and Changes</h3>
        <p>
            This policy may be updated as the project evolves. The date at the
            top of this page identifies the current version.
        </p>
    </>
);

// TermsOfService content
const TOScontent: React.ReactNode = (
    <>
        <p>
            <strong>Last updated: October 7, 2026</strong>
        </p>

        <p>
            These Terms of Service govern the use of ft_transcendence, an online
            multiplayer gaming and social platform developed as a student
            project at 42 Wolfsburg.
        </p>

        <h3>Your Account</h3>
        <ul>
            <li>
                Provide accurate registration information and keep your login
                credentials secure.
            </li>

            <li>
                You are responsible for all activity performed through your
                account.
            </li>

            <li>
                Do not impersonate another user or access another user's account
                without permission.
            </li>
        </ul>

        <h3>Platform Features</h3>
        <p>
            ft_transcendence includes user profiles, friend management,
            real-time multiplayer interactions, rankings, achievements, task
            progression systems, match history, Tic-Tac-Toe, and
            Rock-Paper-Scissors.
        </p>

        <p>
            Statistics, rankings, completed tasks, and profile information may
            be displayed to other users of the platform.
        </p>

        <h3>Fair and Respectful Use</h3>
        <p>
            Treat other players respectfully. Harassment, threats,
            discrimination, abusive behavior, or intentional disruption of other
            users' experience is prohibited.
        </p>

        <p>
            Users must not cheat, exploit bugs, manipulate scores or rankings,
            use unauthorized automation, disrupt multiplayer sessions, attempt
            to gain unauthorized access to data, or interfere with the operation
            of the platform.
        </p>

        <h3>Intellectual Property</h3>
        <p>
            The source code, visual assets, game content, platform design, and
            related materials belong to their respective contributors and
            licensors. Users may access and use the platform only for its
            intended educational and non-commercial purposes.
        </p>

        <h3>Availability of Service</h3>
        <p>
            ft_transcendence is an educational project. Features may be added,
            modified, reset, or removed during development. Service availability
            is not guaranteed, and interruptions may occur.
        </p>

        <h3>Enforcement and Termination</h3>
        <p>
            Access to an account may be suspended or terminated if these terms
            are violated, if platform security is threatened, or if a user's
            actions negatively affect other users or the service.
        </p>

        <p>
            Users may stop using the platform at any time and may request
            account deletion through the project team.
        </p>

        <h3>Disclaimer</h3>
        <p>
            ft_transcendence is provided on an "as is" and "as available" basis
            as a student project. The project team does not guarantee
            uninterrupted service, preservation of data, or error-free
            operation.
        </p>

        <h3>Changes to These Terms</h3>
        <p>
            These Terms may be updated as the project evolves. Continued use of
            the platform after updates constitutes acceptance of the revised
            Terms of Service.
        </p>
    </>
);
// Partially evaluated components for nicer DevX in Entrance component:

type PartialModalProps = Omit<AgreementModalProps, 'title' | 'content'>;

export const PPModal: React.FC<PartialModalProps> = (props) => (
    <AgreementModal {...props} title='Privacy Policy' content={PPcontent} />
);

export const TOSModal: React.FC<PartialModalProps> = (props) => (
    <AgreementModal {...props} title='Terms of Service' content={TOScontent} />
);

// ----------------------=[ The checkboxes sub-compo ]=---------------------- //

type AgreementCheckboxProps = {
    id: string;
    linkText: string;
    checked: boolean;
    setChecked: React.Dispatch<React.SetStateAction<boolean>>;
    modalContent: React.ReactNode;
    modalTitle: string;
};

const AgreementCheckbox: React.FC<AgreementCheckboxProps> = (
    props: AgreementCheckboxProps
) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const showModal = () => {
        setIsModalOpen(true);
    };

    const onChange: CheckboxProps['onChange'] = (e) => {
        props.setChecked(e.target.checked);
    };

    return (
        <span className='terms'>
            <label>
                <Checkbox
                    id={props.id}
                    checked={props.checked}
                    onChange={onChange}
                ></Checkbox>
                <span className='terms-copy'>
                    I agree to the
                    <Button
                        className='terms-link terms-checkbox-link'
                        color='default'
                        variant='link'
                        onClick={showModal}
                    >
                        {props.linkText}
                    </Button>
                </span>
            </label>
            <AgreementModal
                title={props.modalTitle}
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                content={props.modalContent}
            />
        </span>
    );
};

// ------------------=[ kinda the main component here... ]=------------------ //

type AgreementsProps = {
    setAgreed: (v: boolean) => Promise<void>;
};

export const Agreements: React.FC<AgreementsProps> = (
    props: AgreementsProps
) => {
    const [TOSchecked, setTOSchecked] = useState<boolean>(false);
    const [PPchecked, setPPchecked] = useState<boolean>(false);

    // event though setAgreed is async we do not need to await for it here
    // (which wouldn't be working anyway) as there is no immediate consequence.
    // with catch a rejected Promise is still taken into account by unchecking
    // the boxes.
    useEffect(() => {
        if (TOSchecked && PPchecked) {
            props.setAgreed(true).catch(() => {
                setTOSchecked(false);
                setPPchecked(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [TOSchecked, PPchecked]);

    return (
        <>
            <AgreementCheckbox
                id='privacy-checkbox'
                linkText='Privacy Policy'
                checked={PPchecked}
                setChecked={setPPchecked}
                modalContent={PPcontent}
                modalTitle='Privacy Policy'
            />
            <AgreementCheckbox
                id='tos-checkbox'
                linkText='Terms of Service'
                checked={TOSchecked}
                setChecked={setTOSchecked}
                modalContent={TOScontent}
                modalTitle='Terms of Service'
            />
        </>
    );
};
