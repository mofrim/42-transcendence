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
            Well... the ony info that we store and gather from our users is for
            some reason the eMail-adress. This we keep and if the user wants to
            delete the account it is deleted again. That's it.
        </p>
    </>
);

// TermsOfService content
const TOScontent: React.ReactNode = (
    <>
        <p> Please be nice with each other! </p>
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
